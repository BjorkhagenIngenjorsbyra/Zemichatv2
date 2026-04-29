import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAuthContext } from './AuthContext';
import {
  type CallContextValue,
  type ActiveCall,
  type IncomingCall,
  type CallParticipant,
  CallState,
  CallType,
  VIDEO_CALL_MAX_DURATION_SECONDS,
  VIDEO_CALL_WARNING_SECONDS,
  MAX_GROUP_CALL_PARTICIPANTS,
} from '../types/call';
import { SignalType, CallStatus } from '../types/database';
import {
  createAgoraClient,
  getAgoraToken,
  requestMediaPermissions,
  createLocalTracks,
  createScreenShareTrack,
  joinChannel,
  leaveChannel,
  publishTracks,
  unpublishTracks,
  closeLocalTracks,
  type IAgoraRTCClient,
  type IMicrophoneAudioTrack,
  type ICameraVideoTrack,
  type ILocalVideoTrack,
  type IRemoteAudioTrack,
  type IRemoteVideoTrack,
  type IAgoraRTCRemoteUser,
} from '../services/agora';
import {
  createCallLog,
  deleteCallLog,
  updateCallStatus,
  endCallLog,
  sendCallSignal,
  deleteCallSignals,
  subscribeToCallSignals,
  createCallMessage,
  canMakeCall,
  canScreenShare,
} from '../services/call';
import {
  sendCallPush,
  getPendingCallAction,
  dismissNativeCallNotification,
  reportCallConnected,
  reportCallEnded,
  registerVoipPushIfNeeded,
} from '../services/callPush';
import { startRingtone, stopRingtone } from '../services/ringtone';
import { setAudioRoute } from '../services/audioRouting';
import { supabase } from '../services/supabase';
import { type CallLog } from '../types/database';

const RING_TIMEOUT_MS = 30_000;

// ============================================================
// CONTEXT
// ============================================================

const CallContext = createContext<CallContextValue | null>(null);

// ============================================================
// PROVIDER
// ============================================================

interface CallProviderProps {
  children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
  const { profile } = useAuthContext();

  // State
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isAgoraReady, setIsAgoraReady] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callError, setCallError] = useState<string | null>(null);

  // Agora references
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);

  // Remote users
  const [remoteUsers, setRemoteUsers] = useState<Map<string, {
    audio?: IRemoteAudioTrack;
    video?: IRemoteVideoTrack;
  }>>(new Map());

  // Timer refs
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCallError = useCallback(() => setCallError(null), []);

  /** Map server/SDK errors to user-friendly i18n keys */
  const mapCallError = useCallback((err: Error | null, step?: string): string => {
    const msg = err?.message?.toLowerCase() || '';
    const name = err?.name?.toLowerCase() || '';
    if (step) console.error(`[Call] ${step} failed:`, { message: err?.message, name: err?.name, error: err });

    // getUserMedia DOMException names take priority over message-string
    // matches. Chromium/WebView's NotAllowedError carries message
    // "Permission denied", which would otherwise mis-map to the
    // server-side 'call.permissionDenied' (Texter/plan denial) bucket.
    if (name === 'notallowederror') return 'call.microphoneError';
    if (name === 'notfounderror' || name === 'notreadableerror') return 'call.microphoneError';
    // The mediaPermission step always means OS-level mic/camera, regardless
    // of what message the browser surfaced.
    if (step === 'requestMediaPermissions' || step === 'answerCall requestMediaPermissions') {
      return 'call.microphoneError';
    }

    // Agora SDK / service / network failures. We deliberately surface the
    // raw error code (e.g. "AgoraRTCException CAN_NOT_GET_GATEWAY_SERVER")
    // instead of the i18n placeholder so on-device diagnostics tell us
    // exactly what failed without needing logcat. The "raw:" prefix makes
    // CallView render the string literally.
    const rawWithStep = `raw:${step ? step + ': ' : ''}${(err?.message || err?.name || 'unknown').slice(0, 200)}`;
    if (msg.includes('not configured')) return 'call.serviceUnavailable';
    if (msg.includes('agora')) return rawWithStep;
    if (msg.includes('operation_aborted') || msg.includes('web_security_restrict')) return rawWithStep;
    if (msg.includes('invalid_operation') || msg.includes('unexpected_response')) return rawWithStep;
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error')) return rawWithStep;
    if (msg.includes('timeout') || msg.includes('timed out')) return rawWithStep;

    // Server-side authorization (Texter call disabled, not a chat member)
    if (msg.includes('not a member')) return 'call.permissionDenied';
    if (msg.includes('call permission denied')) return 'call.permissionDenied';

    // Generic permission/microphone wording from createLocalTracks etc.
    if (msg.includes('notallowederror') || msg.includes('permission denied') || msg.includes('permission_denied')) {
      return 'call.microphoneError';
    }
    if (msg.includes('microphone') || msg.includes('camera')) return 'call.microphoneError';
    if (msg.includes('notfounderror') || msg.includes('notreadableerror')) return 'call.microphoneError';
    if (msg.includes('no audio') || msg.includes('device')) return 'call.microphoneError';

    // Unknown — surface the raw message so we can diagnose. Prefix with
    // "raw:" so CallView knows to render it literally instead of via i18n.
    const rawMsg = (err?.message || err?.name || 'unknown').slice(0, 160);
    return `raw:${step ? step + ': ' : ''}${rawMsg}`;
  }, []);

  // ============================================================
  // CLEANUP HELPER
  // ============================================================

  const cleanupCall = useCallback(async () => {
    stopRingtone();

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    closeLocalTracks(audioTrackRef.current, videoTrackRef.current);
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current.close();
    }

    if (clientRef.current) {
      await leaveChannel(clientRef.current);
      clientRef.current = null;
    }

    audioTrackRef.current = null;
    videoTrackRef.current = null;
    screenTrackRef.current = null;

    setRemoteUsers(new Map());
    setCallDuration(0);
    setActiveCall(null);
    setIsAgoraReady(false);
  }, []);

  // ============================================================
  // FETCH OTHER PARTICIPANT
  // ============================================================

  async function fetchOtherMembers(chatId: string, myId: string): Promise<{
    id: string;
    displayName: string;
    avatarUrl?: string;
  }[]> {
    // Get all member IDs in this chat
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', chatId)
      .is('left_at', null) as { data: Array<{ user_id: string }> | null };

    if (!members) return [];

    const otherIds = members
      .filter((m) => m.user_id !== myId)
      .map((m) => m.user_id);

    if (otherIds.length === 0) return [];

    // Fetch other users' profiles
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', otherIds) as { data: Array<{ id: string; display_name: string; avatar_url: string | null }> | null };

    return (users || []).map((u) => ({
      id: u.id,
      displayName: u.display_name || 'Unknown',
      avatarUrl: u.avatar_url || undefined,
    }));
  }

  // ============================================================
  // CALL ACTIONS
  // ============================================================

  const initiateCall = useCallback(async (chatId: string, callType: CallType) => {
    if (!profile) return;

    setCallError(null);

    // 1. Check permissions
    const { canCall } = await canMakeCall(profile.id, callType);
    if (!canCall) {
      setCallError('call.permissionDenied');
      return;
    }

    // 2. Fetch other participant(s) info
    const otherMembers = await fetchOtherMembers(chatId, profile.id);

    // 2b. Cap-kontroll: Agora gratis-tier tål bara så många deltagare.
    if (1 + otherMembers.length > MAX_GROUP_CALL_PARTICIPANTS) {
      setCallError('call.groupFull');
      return;
    }

    // 3. Create call log
    const { callLog, error: logError } = await createCallLog(chatId, callType);
    if (logError || !callLog) {
      console.error('[Call] createCallLog failed:', logError?.message || 'no callLog returned');
      setCallError(mapCallError(logError, 'createCallLog'));
      return;
    }

    // 4. Build participants list
    const participants: CallParticipant[] = [
      {
        id: profile.id,
        displayName: profile.display_name || 'You',
        avatarUrl: profile.avatar_url || undefined,
        hasVideo: callType === CallType.VIDEO,
        hasAudio: true,
        isScreenSharing: false,
      },
      ...otherMembers.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        hasVideo: false,
        hasAudio: false,
        isScreenSharing: false,
      })),
    ];

    // 5. Show call screen immediately with RINGING state
    const newCall: ActiveCall = {
      callLogId: callLog.id,
      chatId,
      callType,
      state: CallState.RINGING,
      initiatorId: profile.id,
      participants,
      startedAt: new Date(),
      isMuted: false,
      isSpeakerOn: callType === CallType.VIDEO, // Video defaults to speaker, voice to earpiece
      isVideoEnabled: callType === CallType.VIDEO,
      isScreenSharing: false,
      isMinimized: false,
    };
    setActiveCall(newCall);

    // 6. Start 30-second ring timeout
    ringTimeoutRef.current = setTimeout(async () => {
      setActiveCall((prev) => {
        if (prev && prev.state === CallState.RINGING) {
          return { ...prev, state: CallState.ENDED };
        }
        return prev;
      });
      setCallError('call.noAnswer');
      // Auto-cleanup after showing "no answer" for 2s
      setTimeout(() => cleanupCall(), 2500);
    }, RING_TIMEOUT_MS);

    // 7. Agora setup (async — if it fails, show error)
    try {
      // Get Agora token
      const { token, error: tokenError } = await getAgoraToken(chatId, callType);
      if (tokenError || !token) {
        // Initieringen failade innan samtalet kunde nå mottagaren — ta bort
        // den preliminära call_log:en så det inte loggas som "missat samtal".
        await deleteCallLog(callLog.id);
        setCallError(mapCallError(tokenError, 'getAgoraToken'));
        setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
        setTimeout(() => cleanupCall(), 2500);
        return;
      }

      // Create Agora client
      const client = createAgoraClient();
      clientRef.current = client;

      // Set up event listeners
      client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        await client.subscribe(user, mediaType);
        setRemoteUsers((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(String(user.uid)) || {};
          if (mediaType === 'audio') {
            existing.audio = user.audioTrack;
            user.audioTrack?.play();
          } else {
            existing.video = user.videoTrack;
          }
          newMap.set(String(user.uid), existing);
          return newMap;
        });
      });

      client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        setRemoteUsers((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(String(user.uid));
          if (existing) {
            if (mediaType === 'audio') delete existing.audio;
            else delete existing.video;
            newMap.set(String(user.uid), existing);
          }
          return newMap;
        });
      });

      client.on('user-left', (user: IAgoraRTCRemoteUser) => {
        setRemoteUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(String(user.uid));
          return newMap;
        });
        setActiveCall((prev) => {
          if (!prev) return prev;
          return { ...prev, participants: prev.participants.filter((p) => p.id !== String(user.uid)) };
        });
      });

      // Reconnection handling — Agora SDK auto-reconnects, we track state
      client.on('connection-state-change', (curState: string, prevState: string) => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(`[Call] Agora connection: ${prevState} → ${curState}`);
        }
        if (curState === 'RECONNECTING') {
          setCallError('call.reconnecting');
        } else if (curState === 'CONNECTED' && prevState === 'RECONNECTING') {
          setCallError(null); // Reconnected successfully
        } else if (curState === 'DISCONNECTED' && prevState === 'RECONNECTING') {
          // Failed to reconnect — end the call
          setCallError('call.connectionLost');
          setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
          setTimeout(() => cleanupCall(), 2500);
        }
      });

      // Pre-check media permissions before Agora creates tracks
      const withVideo = callType === CallType.VIDEO;
      const permResult = await requestMediaPermissions(withVideo);
      if (!permResult.granted) {
        setCallError(mapCallError(permResult.error || new Error('Media permission denied'), 'requestMediaPermissions'));
        setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
        setTimeout(() => cleanupCall(), 2500);
        return;
      }

      // Create local tracks
      const { audioTrack, videoTrack, error: trackError } = await createLocalTracks(withVideo);
      if (trackError) {
        setCallError(mapCallError(trackError, 'createLocalTracks'));
        setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
        setTimeout(() => cleanupCall(), 2500);
        return;
      }

      audioTrackRef.current = audioTrack;
      videoTrackRef.current = videoTrack;

      // Join channel
      const { error: joinError } = await joinChannel(client, token.appId, token.token, token.channel, token.uid);
      if (joinError) {
        setCallError(mapCallError(joinError, 'joinChannel'));
        setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
        setTimeout(() => cleanupCall(), 2500);
        return;
      }

      // Publish tracks
      const { error: publishError } = await publishTracks(client, audioTrack, videoTrack);
      if (publishError) {
        setCallError(mapCallError(publishError, 'publishTracks'));
        setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
        setTimeout(() => cleanupCall(), 2500);
        return;
      }

      setIsAgoraReady(true);

      // Send ring signal to other participant
      await sendCallSignal(chatId, callLog.id, SignalType.RING);

      // Push notification for background/killed app
      sendCallPush(chatId, callLog.id, callType, 'ring');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setCallError(mapCallError(error, 'initiateCall catch'));
      setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
      setTimeout(() => cleanupCall(), 2500);
    }
  }, [profile, cleanupCall, mapCallError]);

  const answerCall = useCallback(async () => {
    if (!incomingCall || !profile) return;

    setCallError(null);
    stopRingtone();

    // Dismiss native call notification if present
    dismissNativeCallNotification();

    const newCall: ActiveCall = {
      callLogId: incomingCall.callLogId,
      chatId: incomingCall.chatId,
      callType: incomingCall.callType,
      state: CallState.CONNECTING,
      initiatorId: incomingCall.callerId,
      participants: [
        {
          id: incomingCall.callerId,
          displayName: incomingCall.callerName,
          avatarUrl: incomingCall.callerAvatar,
          hasVideo: incomingCall.callType === CallType.VIDEO,
          hasAudio: true,
          isScreenSharing: false,
        },
        {
          id: profile.id,
          displayName: profile.display_name || 'You',
          avatarUrl: profile.avatar_url || undefined,
          hasVideo: incomingCall.callType === CallType.VIDEO,
          hasAudio: true,
          isScreenSharing: false,
        },
      ],
      startedAt: new Date(),
      isMuted: false,
      isSpeakerOn: incomingCall.callType === CallType.VIDEO,
      isVideoEnabled: incomingCall.callType === CallType.VIDEO,
      isScreenSharing: false,
      isMinimized: false,
    };
    setActiveCall(newCall);
    setIncomingCall(null);

    try {
      const { token, error: tokenError } = await getAgoraToken(
        incomingCall.chatId,
        incomingCall.callType
      );
      if (tokenError || !token) {
        setCallError(mapCallError(tokenError, 'answerCall getAgoraToken'));
        await cleanupCall();
        return;
      }

      const client = createAgoraClient();
      clientRef.current = client;

      client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        await client.subscribe(user, mediaType);
        setRemoteUsers((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(String(user.uid)) || {};
          if (mediaType === 'audio') {
            existing.audio = user.audioTrack;
            user.audioTrack?.play();
          } else {
            existing.video = user.videoTrack;
          }
          newMap.set(String(user.uid), existing);
          return newMap;
        });
      });

      client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        setRemoteUsers((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(String(user.uid));
          if (existing) {
            if (mediaType === 'audio') delete existing.audio;
            else delete existing.video;
            newMap.set(String(user.uid), existing);
          }
          return newMap;
        });
      });

      client.on('user-left', (user: IAgoraRTCRemoteUser) => {
        setRemoteUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(String(user.uid));
          return newMap;
        });
      });

      // Pre-check media permissions before Agora creates tracks
      const answerWithVideo = incomingCall.callType === CallType.VIDEO;
      const answerPermResult = await requestMediaPermissions(answerWithVideo);
      if (!answerPermResult.granted) {
        setCallError(mapCallError(answerPermResult.error || new Error('Media permission denied'), 'answerCall requestMediaPermissions'));
        await cleanupCall();
        return;
      }

      const { audioTrack, videoTrack, error: trackError } = await createLocalTracks(answerWithVideo);
      if (trackError) {
        setCallError(mapCallError(trackError, 'answerCall createLocalTracks'));
        await cleanupCall();
        return;
      }

      audioTrackRef.current = audioTrack;
      videoTrackRef.current = videoTrack;

      const { error: joinError } = await joinChannel(client, token.appId, token.token, token.channel, token.uid);
      if (joinError) {
        setCallError(mapCallError(joinError, 'answerCall joinChannel'));
        await cleanupCall();
        return;
      }

      const { error: publishError } = await publishTracks(client, audioTrack, videoTrack);
      if (publishError) {
        setCallError(mapCallError(publishError, 'answerCall publishTracks'));
        await cleanupCall();
        return;
      }
      await updateCallStatus(incomingCall.callLogId, CallStatus.ANSWERED);
      await deleteCallSignals(incomingCall.callLogId);

      setIsAgoraReady(true);
      setActiveCall((prev) => prev ? {
        ...prev,
        state: CallState.CONNECTED,
        connectedAt: new Date(),
      } : prev);

      // Tell CallKit (iOS) that the call is now connected
      reportCallConnected(incomingCall.callLogId);

      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setCallError(mapCallError(error, 'answerCall catch'));
      reportCallEnded(incomingCall.callLogId, 'failed');
      await cleanupCall();
    }
  }, [incomingCall, profile, cleanupCall, mapCallError]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    stopRingtone();
    dismissNativeCallNotification();
    reportCallEnded(incomingCall.callLogId, 'declinedElsewhere');
    await updateCallStatus(incomingCall.callLogId, CallStatus.DECLINED);
    // Skicka DECLINE-signal så att initiator får besked att samtalet
    // avvisades — annars ringer det vidare för dem tills timeout.
    await sendCallSignal(incomingCall.chatId, incomingCall.callLogId, SignalType.DECLINE);
    await deleteCallSignals(incomingCall.callLogId);
    setIncomingCall(null);
  }, [incomingCall]);

  const endCall = useCallback(async () => {
    if (!activeCall) return;

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    // Tell CallKit (iOS) that the call has ended
    reportCallEnded(activeCall.callLogId, 'remoteEnded');

    // Cancel push notification on receiver's device
    sendCallPush(activeCall.chatId, activeCall.callLogId, activeCall.callType, 'cancel');

    if (activeCall.connectedAt) {
      await endCallLog(activeCall.callLogId, activeCall.connectedAt);
    }

    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .eq('id', activeCall.callLogId)
      .single();

    if (data) {
      await createCallMessage(activeCall.chatId, data as unknown as CallLog);
    }

    await deleteCallSignals(activeCall.callLogId);
    await cleanupCall();
  }, [activeCall, cleanupCall]);

  const toggleMute = useCallback(() => {
    if (!audioTrackRef.current) return;
    const newMuted = !activeCall?.isMuted;
    audioTrackRef.current.setMuted(newMuted);
    setActiveCall((prev) => prev ? { ...prev, isMuted: newMuted } : prev);
  }, [activeCall?.isMuted]);

  const toggleSpeaker = useCallback(() => {
    const newSpeaker = !activeCall?.isSpeakerOn;
    setAudioRoute(newSpeaker);
    setActiveCall((prev) => prev ? { ...prev, isSpeakerOn: newSpeaker } : prev);
  }, [activeCall?.isSpeakerOn]);

  const toggleVideo = useCallback(async () => {
    if (!clientRef.current) return;
    const newEnabled = !activeCall?.isVideoEnabled;

    if (newEnabled && !videoTrackRef.current) {
      const { audioTrack: leakedAudio, videoTrack } = await createLocalTracks(true);
      // Close the leaked audio track — we already have one
      if (leakedAudio) leakedAudio.close();
      if (videoTrack) {
        videoTrackRef.current = videoTrack;
        await publishTracks(clientRef.current, null, videoTrack);
      }
    } else if (videoTrackRef.current) {
      videoTrackRef.current.setEnabled(newEnabled);
    }

    setActiveCall((prev) => prev ? { ...prev, isVideoEnabled: newEnabled } : prev);
  }, [activeCall?.isVideoEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!clientRef.current || !profile) return;

    const { canShare } = await canScreenShare(profile.id);
    if (!canShare) return;

    const newSharing = !activeCall?.isScreenSharing;

    if (newSharing) {
      const { screenTrack, error } = await createScreenShareTrack();
      if (error || !screenTrack) return;

      if (videoTrackRef.current) {
        await unpublishTracks(clientRef.current, [videoTrackRef.current]);
      }

      screenTrackRef.current = screenTrack;
      await publishTracks(clientRef.current, null, screenTrack);

      screenTrack.on('track-ended', async () => {
        if (screenTrackRef.current) {
          await unpublishTracks(clientRef.current!, [screenTrackRef.current]);
          screenTrackRef.current.close();
          screenTrackRef.current = null;

          if (videoTrackRef.current && activeCall?.isVideoEnabled) {
            await publishTracks(clientRef.current!, null, videoTrackRef.current);
          }

          setActiveCall((prev) => prev ? { ...prev, isScreenSharing: false } : prev);
        }
      });
    } else {
      if (screenTrackRef.current) {
        await unpublishTracks(clientRef.current, [screenTrackRef.current]);
        screenTrackRef.current.close();
        screenTrackRef.current = null;

        if (videoTrackRef.current && activeCall?.isVideoEnabled) {
          await publishTracks(clientRef.current, null, videoTrackRef.current);
        }
      }
    }

    setActiveCall((prev) => prev ? { ...prev, isScreenSharing: newSharing } : prev);
  }, [activeCall?.isScreenSharing, activeCall?.isVideoEnabled, profile]);

  const toggleMinimize = useCallback(() => {
    setActiveCall((prev) => prev ? { ...prev, isMinimized: !prev.isMinimized } : prev);
  }, []);

  // ============================================================
  // INCOMING CALL SUBSCRIPTION
  // ============================================================

  // Register for VoIP pushes on iOS (PushKit/CallKit)
  useEffect(() => {
    if (!profile) return;
    registerVoipPushIfNeeded();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const unsubscribe = subscribeToCallSignals(async (signal, caller) => {
      // DECLINE-signal — vi är initiator och mottagaren har tackat nej.
      // Stoppa det utgående samtalet och visa "Avvisat".
      if (signal.signal_type === SignalType.DECLINE && activeCall && activeCall.callLogId === signal.call_log_id) {
        if (ringTimeoutRef.current) {
          clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = null;
        }
        setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
        setCallError('call.declined');
        setTimeout(() => cleanupCall(), 2500);
        return;
      }

      if (activeCall) return;

      // Look up call type from the call log (signal itself doesn't carry it)
      let detectedCallType = CallType.VOICE;
      const { data: log } = await supabase
        .from('call_logs')
        .select('type')
        .eq('id', signal.call_log_id)
        .single() as { data: { type: string } | null };
      if (log?.type === 'video') {
        detectedCallType = CallType.VIDEO;
      }

      setIncomingCall({
        callLogId: signal.call_log_id,
        chatId: signal.chat_id,
        callerId: caller.id,
        callerName: caller.display_name || 'Unknown',
        callerAvatar: caller.avatar_url || undefined,
        callType: detectedCallType,
        signalId: signal.id,
      });

      // Start ringtone + vibration for incoming call
      startRingtone();
    });

    return unsubscribe;
  }, [profile, activeCall]);

  // ============================================================
  // NATIVE CALL ANSWER DETECTION
  // ============================================================
  // When the user taps "Answer" on the native incoming call screen,
  // the app opens with pending call data. We detect it and auto-answer.

  useEffect(() => {
    if (!profile) return;

    let cancelled = false;

    const checkNativeCallAction = async () => {
      const action = await getPendingCallAction();
      if (cancelled || !action || action.action !== 'answer') return;

      // Set incoming call state, then immediately answer
      const incoming: IncomingCall = {
        callLogId: action.callLogId,
        chatId: action.chatId,
        callerId: action.callerId,
        callerName: action.callerName,
        callerAvatar: action.callerAvatar || undefined,
        callType: action.callType === 'video' ? CallType.VIDEO : CallType.VOICE,
        signalId: '', // Not needed for answer flow
      };
      setIncomingCall(incoming);
    };

    // Check once on mount and also when app resumes
    checkNativeCallAction();

    // Re-check when the app becomes visible (resume from background)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkNativeCallAction();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [profile]);

  // ============================================================
  // AUTO-ANSWER FROM NATIVE (signalId is empty when opened via native Answer button)
  // ============================================================

  useEffect(() => {
    if (incomingCall && incomingCall.signalId === '') {
      answerCall();
    }
  }, [incomingCall, answerCall]);

  // ============================================================
  // CALL CONNECTED DETECTION
  // ============================================================

  useEffect(() => {
    if (!activeCall || activeCall.state !== CallState.RINGING) return;

    if (remoteUsers.size > 0) {
      // Clear ring timeout
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }

      setActiveCall((prev) => prev ? {
        ...prev,
        state: CallState.CONNECTED,
        connectedAt: new Date(),
      } : prev);

      updateCallStatus(activeCall.callLogId, CallStatus.ANSWERED);

      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
  }, [activeCall, remoteUsers.size]);

  // ============================================================
  // AUTO END CALL WHEN ALL LEAVE
  // ============================================================

  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we've ever seen a remote user. Without this, the auto-end
  // timer fires the first time the call enters CONNECTED if the remote
  // hasn't published yet, killing the call before media has had time to
  // start flowing — observed in v1.5.7 where the answerer's UI sets
  // state=CONNECTED immediately after publishTracks but the publishers
  // haven't synced yet via Agora's SFU.
  const hasHadRemoteRef = useRef(false);

  useEffect(() => {
    if (remoteUsers.size > 0) hasHadRemoteRef.current = true;
  }, [remoteUsers.size]);

  useEffect(() => {
    if (!activeCall) {
      hasHadRemoteRef.current = false;
      return;
    }
    if (activeCall.state !== CallState.CONNECTED) return;

    if (remoteUsers.size === 0 && activeCall.connectedAt && hasHadRemoteRef.current) {
      // Debounce: wait 3 seconds before ending — avoids premature end
      // when remote user briefly disconnects (e.g. toggling video). Only
      // arms when we've previously had a remote, so it doesn't fire if
      // the other party just hasn't published yet.
      autoEndTimerRef.current = setTimeout(() => {
        endCall();
      }, 3000);
    } else if (autoEndTimerRef.current) {
      // Remote user came back — cancel auto-end
      clearTimeout(autoEndTimerRef.current);
      autoEndTimerRef.current = null;
    }

    return () => {
      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
    };
  }, [activeCall, remoteUsers.size, endCall]);

  // ============================================================
  // VIDEO CALL MAX DURATION
  // ============================================================

  useEffect(() => {
    if (!activeCall || activeCall.state !== CallState.CONNECTED) return;
    if (activeCall.callType !== CallType.VIDEO) return;

    if (callDuration >= VIDEO_CALL_MAX_DURATION_SECONDS) {
      endCall();
    } else if (callDuration >= VIDEO_CALL_WARNING_SECONDS && callDuration < VIDEO_CALL_WARNING_SECONDS + 1) {
      // Show warning once at the 55-minute mark
      setCallError('call.videoTimeWarning');
    }
  }, [activeCall, callDuration, endCall]);

  // ============================================================
  // CLEANUP ON UNMOUNT
  // ============================================================

  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      cleanupCall();
    };
  }, [cleanupCall]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value: CallContextValue = {
    activeCall,
    incomingCall,
    isAgoraReady,
    callDuration,
    callError,
    localVideoTrack: videoTrackRef.current,
    screenShareTrack: screenTrackRef.current,
    remoteUsers,
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    toggleScreenShare,
    toggleMinimize,
    clearCallError,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useCallContext(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
}

export function useRemoteUsers() {
  const { remoteUsers } = useCallContext();
  return remoteUsers;
}
