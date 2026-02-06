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
import { supabase } from '../services/supabase';
import { type CallLog } from '../types/database';

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

  // Timer ref for call duration
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // CLEANUP HELPER
  // ============================================================

  const cleanupCall = useCallback(async () => {
    // Stop duration timer
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    // Close local tracks
    closeLocalTracks(audioTrackRef.current, videoTrackRef.current);
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current.close();
    }

    // Leave channel
    if (clientRef.current) {
      await leaveChannel(clientRef.current);
      clientRef.current = null;
    }

    // Clear refs
    audioTrackRef.current = null;
    videoTrackRef.current = null;
    screenTrackRef.current = null;

    // Reset state
    setRemoteUsers(new Map());
    setCallDuration(0);
    setActiveCall(null);
    setIsAgoraReady(false);
  }, []);

  // ============================================================
  // CALL ACTIONS
  // ============================================================

  const initiateCall = useCallback(async (chatId: string, callType: CallType) => {
    if (!profile) return;

    // Check if user can make this type of call
    const { canCall } = await canMakeCall(profile.id, callType);
    if (!canCall) {
      console.error('User not permitted to make this type of call');
      return;
    }

    // Create call log
    const { callLog, error: logError } = await createCallLog(chatId, callType);
    if (logError || !callLog) {
      console.error('Failed to create call log:', logError);
      return;
    }

    // Set initial call state
    const newCall: ActiveCall = {
      callLogId: callLog.id,
      chatId,
      callType,
      state: CallState.INITIATING,
      initiatorId: profile.id,
      participants: [{
        id: profile.id,
        displayName: profile.display_name || 'You',
        avatarUrl: profile.avatar_url || undefined,
        hasVideo: callType === CallType.VIDEO,
        hasAudio: true,
        isScreenSharing: false,
      }],
      startedAt: new Date(),
      isMuted: false,
      isVideoEnabled: callType === CallType.VIDEO,
      isScreenSharing: false,
      isMinimized: false,
    };
    setActiveCall(newCall);

    // Get Agora token
    const { token, error: tokenError } = await getAgoraToken(chatId, callType);
    if (tokenError || !token) {
      console.error('Failed to get Agora token:', tokenError);
      await cleanupCall();
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

      // Update participants
      setActiveCall((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some((p) => p.id === String(user.uid));
        if (!exists) {
          return {
            ...prev,
            participants: [
              ...prev.participants,
              {
                id: String(user.uid),
                displayName: 'Participant',
                hasVideo: mediaType === 'video',
                hasAudio: mediaType === 'audio',
                isScreenSharing: false,
              },
            ],
          };
        }
        return prev;
      });
    });

    client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      setRemoteUsers((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(String(user.uid));
        if (existing) {
          if (mediaType === 'audio') {
            delete existing.audio;
          } else {
            delete existing.video;
          }
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

      // Update participants
      setActiveCall((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.filter((p) => p.id !== String(user.uid)),
        };
      });
    });

    // Create local tracks
    const { audioTrack, videoTrack, error: trackError } = await createLocalTracks(
      callType === CallType.VIDEO
    );
    if (trackError) {
      console.error('Failed to create local tracks:', trackError);
      await cleanupCall();
      return;
    }

    audioTrackRef.current = audioTrack;
    videoTrackRef.current = videoTrack;

    // Join channel
    const { error: joinError } = await joinChannel(client, token.token, token.channel, token.uid);
    if (joinError) {
      console.error('Failed to join channel:', joinError);
      await cleanupCall();
      return;
    }

    // Publish tracks
    const { error: publishError } = await publishTracks(client, audioTrack, videoTrack);
    if (publishError) {
      console.error('Failed to publish tracks:', publishError);
    }

    setIsAgoraReady(true);

    // Send ring signal
    const { error: signalError } = await sendCallSignal(chatId, callLog.id, SignalType.RING);
    if (signalError) {
      console.error('Failed to send call signal:', signalError);
    }

    // Update state to ringing
    setActiveCall((prev) => prev ? { ...prev, state: CallState.RINGING } : prev);
  }, [profile, cleanupCall]);

  const answerCall = useCallback(async () => {
    if (!incomingCall || !profile) return;

    // Set initial call state
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

    // Get Agora token
    const { token, error: tokenError } = await getAgoraToken(
      incomingCall.chatId,
      incomingCall.callType
    );
    if (tokenError || !token) {
      console.error('Failed to get Agora token:', tokenError);
      await cleanupCall();
      return;
    }

    // Create Agora client with same event setup as initiateCall
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
          if (mediaType === 'audio') {
            delete existing.audio;
          } else {
            delete existing.video;
          }
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

    // Create local tracks
    const { audioTrack, videoTrack, error: trackError } = await createLocalTracks(
      incomingCall.callType === CallType.VIDEO
    );
    if (trackError) {
      console.error('Failed to create local tracks:', trackError);
      await cleanupCall();
      return;
    }

    audioTrackRef.current = audioTrack;
    videoTrackRef.current = videoTrack;

    // Join channel
    const { error: joinError } = await joinChannel(client, token.token, token.channel, token.uid);
    if (joinError) {
      console.error('Failed to join channel:', joinError);
      await cleanupCall();
      return;
    }

    // Publish tracks
    await publishTracks(client, audioTrack, videoTrack);

    // Update call log status to answered
    await updateCallStatus(incomingCall.callLogId, CallStatus.ANSWERED);

    // Delete the ring signal
    await deleteCallSignals(incomingCall.callLogId);

    setIsAgoraReady(true);

    // Start call connected
    setActiveCall((prev) => prev ? {
      ...prev,
      state: CallState.CONNECTED,
      connectedAt: new Date(),
    } : prev);

    // Start duration timer
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, [incomingCall, profile, cleanupCall]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    // Update call log to declined
    await updateCallStatus(incomingCall.callLogId, CallStatus.DECLINED);

    // Delete signals
    await deleteCallSignals(incomingCall.callLogId);

    setIncomingCall(null);
  }, [incomingCall]);

  const endCall = useCallback(async () => {
    if (!activeCall) return;

    // End call log
    if (activeCall.connectedAt) {
      await endCallLog(activeCall.callLogId, activeCall.connectedAt);
    }

    // Create call message in chat
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .eq('id', activeCall.callLogId)
      .single();

    if (data) {
      await createCallMessage(activeCall.chatId, data as unknown as CallLog);
    }

    // Delete any remaining signals
    await deleteCallSignals(activeCall.callLogId);

    // Cleanup Agora
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
      // Create video track if doesn't exist
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

    // Check permission
    const { canShare } = await canScreenShare(profile.id);
    if (!canShare) {
      console.error('User not permitted to screen share');
      return;
    }

    const newSharing = !activeCall?.isScreenSharing;

    if (newSharing) {
      // Start screen share
      const { screenTrack, error } = await createScreenShareTrack();
      if (error || !screenTrack) {
        console.error('Failed to create screen share:', error);
        return;
      }

      // Unpublish camera if active
      if (videoTrackRef.current) {
        await unpublishTracks(clientRef.current, [videoTrackRef.current]);
      }

      screenTrackRef.current = screenTrack;
      await publishTracks(clientRef.current, null, screenTrack);

      // Listen for screen share stop
      screenTrack.on('track-ended', async () => {
        if (screenTrackRef.current) {
          await unpublishTracks(clientRef.current!, [screenTrackRef.current]);
          screenTrackRef.current.close();
          screenTrackRef.current = null;

          // Re-publish camera if video was enabled
          if (videoTrackRef.current && activeCall?.isVideoEnabled) {
            await publishTracks(clientRef.current!, null, videoTrackRef.current);
          }

          setActiveCall((prev) => prev ? { ...prev, isScreenSharing: false } : prev);
        }
      });
    } else {
      // Stop screen share
      if (screenTrackRef.current) {
        await unpublishTracks(clientRef.current, [screenTrackRef.current]);
        screenTrackRef.current.close();
        screenTrackRef.current = null;

        // Re-publish camera if video was enabled
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

  useEffect(() => {
    if (!profile) return;

    const unsubscribe = subscribeToCallSignals((signal, caller) => {
      // Don't show incoming call if already in a call
      if (activeCall) return;

      setIncomingCall({
        callLogId: signal.call_log_id,
        chatId: signal.chat_id,
        callerId: caller.id,
        callerName: caller.display_name || 'Unknown',
        callerAvatar: caller.avatar_url || undefined,
        callType: signal.signal_type === 'ring'
          ? CallType.VOICE // Will be updated when we have call log info
          : CallType.VOICE,
        signalId: signal.id,
      });
    });

    return unsubscribe;
  }, [profile, activeCall]);

  // ============================================================
  // CALL CONNECTED DETECTION
  // ============================================================

  useEffect(() => {
    if (!activeCall || activeCall.state !== CallState.RINGING) return;

    // When a remote user joins, the call is connected
    if (remoteUsers.size > 0) {
      setActiveCall((prev) => prev ? {
        ...prev,
        state: CallState.CONNECTED,
        connectedAt: new Date(),
      } : prev);

      // Update call log status
      updateCallStatus(activeCall.callLogId, CallStatus.ANSWERED);

      // Start duration timer
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

    // If all remote users left and call was connected, end the call
    if (remoteUsers.size === 0 && activeCall.connectedAt) {
      endCall();
    }
  }, [activeCall, remoteUsers.size, endCall]);

  // ============================================================
  // CLEANUP ON UNMOUNT
  // ============================================================

  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
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
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleMinimize,
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

// Export remote users hook for video components
export function useRemoteUsers() {
  // This would need to be in context for real use
  // For now components can use the passed props
  return new Map();
}
