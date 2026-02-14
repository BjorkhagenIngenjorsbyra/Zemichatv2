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
} from '../types/call';
import { SignalType, CallStatus } from '../types/database';
import {
  createAgoraClient,
  getAgoraToken,
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
  const mapCallError = useCallback((err: Error | null): string => {
    const msg = err?.message?.toLowerCase() || '';
    if (msg.includes('not configured') || msg.includes('agora')) return 'call.serviceUnavailable';
    if (msg.includes('permission denied')) return 'call.permissionDenied';
    if (msg.includes('not a member')) return 'call.permissionDenied';
    return 'call.error';
  }, []);

  // ============================================================
  // CLEANUP HELPER
  // ============================================================

  const cleanupCall = useCallback(async () => {
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

  async function fetchOtherMember(chatId: string, myId: string): Promise<{
    id: string;
    displayName: string;
    avatarUrl?: string;
  } | null> {
    // Get all member IDs in this chat
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', chatId)
      .is('left_at', null) as { data: Array<{ user_id: string }> | null };

    if (!members) return null;

    const otherId = members.find((m) => m.user_id !== myId)?.user_id;
    if (!otherId) return null;

    // Fetch the other user's profile
    const { data: user } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('id', otherId)
      .single() as { data: { id: string; display_name: string; avatar_url: string | null } | null };

    if (!user) return null;

    return {
      id: user.id,
      displayName: user.display_name || 'Unknown',
      avatarUrl: user.avatar_url || undefined,
    };
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

    // 2. Fetch other participant info
    const otherMember = await fetchOtherMember(chatId, profile.id);

    // 3. Create call log
    const { callLog, error: logError } = await createCallLog(chatId, callType);
    if (logError || !callLog) {
      setCallError('call.error');
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
    ];

    if (otherMember) {
      participants.push({
        id: otherMember.id,
        displayName: otherMember.displayName,
        avatarUrl: otherMember.avatarUrl,
        hasVideo: false,
        hasAudio: false,
        isScreenSharing: false,
      });
    }

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
        setCallError(mapCallError(tokenError));
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

      // Create local tracks
      const { audioTrack, videoTrack, error: trackError } = await createLocalTracks(
        callType === CallType.VIDEO
      );
      if (trackError) {
        setCallError('call.error');
        setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
        setTimeout(() => cleanupCall(), 2500);
        return;
      }

      audioTrackRef.current = audioTrack;
      videoTrackRef.current = videoTrack;

      // Join channel
      const { error: joinError } = await joinChannel(client, token.appId, token.token, token.channel, token.uid);
      if (joinError) {
        setCallError('call.error');
        setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
        setTimeout(() => cleanupCall(), 2500);
        return;
      }

      // Publish tracks
      await publishTracks(client, audioTrack, videoTrack);

      setIsAgoraReady(true);

      // Send ring signal to other participant
      await sendCallSignal(chatId, callLog.id, SignalType.RING);

      // Push notification for background/killed app
      sendCallPush(chatId, callLog.id, callType, 'ring');
    } catch (err) {
      console.error('Call setup failed:', err);
      setCallError('call.error');
      setActiveCall((prev) => prev ? { ...prev, state: CallState.ENDED } : prev);
      setTimeout(() => cleanupCall(), 2500);
    }
  }, [profile, cleanupCall]);

  const answerCall = useCallback(async () => {
    if (!incomingCall || !profile) return;

    setCallError(null);

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
        setCallError('call.error');
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

      const { audioTrack, videoTrack, error: trackError } = await createLocalTracks(
        incomingCall.callType === CallType.VIDEO
      );
      if (trackError) {
        setCallError('call.error');
        await cleanupCall();
        return;
      }

      audioTrackRef.current = audioTrack;
      videoTrackRef.current = videoTrack;

      const { error: joinError } = await joinChannel(client, token.appId, token.token, token.channel, token.uid);
      if (joinError) {
        setCallError('call.error');
        await cleanupCall();
        return;
      }

      await publishTracks(client, audioTrack, videoTrack);
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
      console.error('Answer call failed:', err);
      setCallError('call.error');
      reportCallEnded(incomingCall.callLogId, 'failed');
      await cleanupCall();
    }
  }, [incomingCall, profile, cleanupCall]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    dismissNativeCallNotification();
    reportCallEnded(incomingCall.callLogId, 'declinedElsewhere');
    await updateCallStatus(incomingCall.callLogId, CallStatus.DECLINED);
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

  const toggleVideo = useCallback(async () => {
    if (!clientRef.current) return;
    const newEnabled = !activeCall?.isVideoEnabled;

    if (newEnabled && !videoTrackRef.current) {
      const { videoTrack } = await createLocalTracks(true);
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

  useEffect(() => {
    if (!activeCall || activeCall.state !== CallState.CONNECTED) return;

    if (remoteUsers.size === 0 && activeCall.connectedAt) {
      endCall();
    }
  }, [activeCall, remoteUsers.size, endCall]);

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
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
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
  return new Map();
}
