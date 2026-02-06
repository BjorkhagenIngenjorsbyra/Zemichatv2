// Zemichat v2 – Call type definitions

// ============================================================
// ENUMS
// ============================================================

export enum CallState {
  IDLE = 'idle',
  INITIATING = 'initiating',
  RINGING = 'ringing',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ENDED = 'ended',
}

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
}

export enum SignalType {
  RING = 'ring',
  CANCEL = 'cancel',
  DECLINE = 'decline',
  BUSY = 'busy',
}

// ============================================================
// VIDEO CALL LIMITS
// ============================================================

/** Maximum duration for video calls in seconds (60 minutes) */
export const VIDEO_CALL_MAX_DURATION_SECONDS = 60 * 60;

/** Warning time before video call ends in seconds (at 55 minutes) */
export const VIDEO_CALL_WARNING_SECONDS = 55 * 60;

/** Time remaining when warning is shown (5 minutes) */
export const VIDEO_CALL_WARNING_REMAINING_SECONDS = 5 * 60;

// ============================================================
// INTERFACES
// ============================================================

export interface CallParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  isScreenSharing: boolean;
}

export interface ActiveCall {
  callLogId: string;
  chatId: string;
  callType: CallType;
  state: CallState;
  initiatorId: string;
  participants: CallParticipant[];
  startedAt: Date;
  connectedAt?: Date;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMinimized: boolean;
}

export interface IncomingCall {
  callLogId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: CallType;
  signalId: string;
}

export interface CallSignal {
  id: string;
  chat_id: string;
  call_log_id: string;
  caller_id: string;
  signal_type: SignalType;
  expires_at: string;
  created_at: string;
}

// ============================================================
// AGORA TYPES (for reference without full SDK import)
// ============================================================

export interface AgoraToken {
  token: string;
  appId: string;
  channel: string;
  uid: number;
}

// ============================================================
// CONTEXT TYPES
// ============================================================

export interface CallContextState {
  activeCall: ActiveCall | null;
  incomingCall: IncomingCall | null;
  isAgoraReady: boolean;
  callDuration: number;
}

export interface CallContextActions {
  initiateCall: (chatId: string, callType: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleMinimize: () => void;
}

export interface CallContextValue extends CallContextState, CallContextActions {}
