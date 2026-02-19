// Zemichat v2 – Database type definitions
// Matches supabase/migrations/initial_schema.sql

// ============================================================
// ENUMS
// ============================================================

// Display names: FREE = 'Start', BASIC = 'Plus', PRO = 'Plus Ringa'
export enum PlanType {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
}

export enum UserRole {
  OWNER = 'owner',
  SUPER = 'super',
  TEXTER = 'texter',
}

export enum FriendshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  VIDEO = 'video',
  DOCUMENT = 'document',
  LOCATION = 'location',
  CONTACT = 'contact',
  SYSTEM = 'system',
  POLL = 'poll',
  GIF = 'gif',
  STICKER = 'sticker',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  ESCALATED = 'escalated',
}

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
}

export enum CallStatus {
  MISSED = 'missed',
  ANSWERED = 'answered',
  DECLINED = 'declined',
}

export enum PlatformType {
  IOS = 'ios',
  ANDROID = 'android',
}

export enum PushTokenType {
  FCM = 'fcm',
  VOIP = 'voip',
}

export enum SupportRequestType {
  BUG = 'bug',
  SUGGESTION = 'suggestion',
  SUPPORT = 'support',
}

// ============================================================
// TABLE INTERFACES
// ============================================================

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  plan: PlanType;
  trial_ends_at: string | null;
  referral_code: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  team_id: string;
  role: UserRole;
  zemi_number: string;
  display_name: string | null;
  avatar_url: string | null;
  status_message: string | null;
  last_seen_at: string | null;
  is_active: boolean;
  is_paused: boolean;
  wall_enabled: boolean;
  consent_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TexterSettings {
  id: string;
  user_id: string;
  can_send_images: boolean;
  can_send_voice: boolean;
  can_send_video: boolean;
  can_send_documents: boolean;
  can_share_location: boolean;
  can_voice_call: boolean;
  can_video_call: boolean;
  can_screen_share: boolean;
  can_access_wall: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_days: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FriendSettings {
  id: string;
  user_id: string;
  friend_user_id: string;
  nickname: string;
  categories: string[];
  created_at: string;
  updated_at: string;
}

export const FRIEND_CATEGORIES = ['family', 'relative', 'friend', 'classmate', 'teammate'] as const;
export type FriendCategory = typeof FRIEND_CATEGORIES[number];

export interface DeniedFriendRequest {
  id: string;
  texter_id: string;
  denied_user_id: string;
  denied_by: string;
  created_at: string;
}

export interface Chat {
  id: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  unread_count: number;
  last_read_at: string | null;
  marked_unread: boolean;
  muted_until: string | null;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  type: MessageType;
  content: string | null;
  media_url: string | null;
  media_metadata: Record<string, unknown> | null;
  reply_to_id: string | null;
  forwarded_from_id: string | null;
  location: unknown | null;
  contact_zemi_number: string | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_for_all: boolean;
  created_at: string;
}

export interface MessageEdit {
  id: string;
  message_id: string;
  old_content: string;
  edited_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface StarredMessage {
  id: string;
  user_id: string;
  message_id: string;
  created_at: string;
}

export interface MessageReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface QuickMessage {
  id: string;
  user_id: string;
  created_by: string;
  content: string;
  sort_order: number;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_message_id: string | null;
  reason: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  escalated_at: string | null;
  created_at: string;
}

export interface SosAlert {
  id: string;
  texter_id: string;
  location: unknown | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
}

export interface CallLog {
  id: string;
  chat_id: string;
  initiator_id: string;
  type: CallType;
  status: CallStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export enum SignalType {
  RING = 'ring',
  CANCEL = 'cancel',
  DECLINE = 'decline',
  BUSY = 'busy',
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

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: PlatformType;
  token_type: PushTokenType;
  created_at: string;
  updated_at: string;
}

export interface SupportRequest {
  id: string;
  user_id: string;
  type: SupportRequestType;
  subject: string;
  description: string;
  email: string;
  screenshot_url: string | null;
  device_info: Record<string, unknown> | null;
  created_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  invited_by: string;
  email: string;
  role: UserRole;
  token: string;
  display_name: string | null;
  expires_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_team_id: string;
  referred_team_id: string;
  reward_granted_at: string | null;
  created_at: string;
}

export interface ReferralStats {
  referral_code: string | null;
  total_referred: number;
  rewards_earned: number;
  pending_rewards: number;
}

// ============================================================
// WALL INTERFACES
// ============================================================

export interface WallPost {
  id: string;
  team_id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  media_metadata: Record<string, unknown> | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WallComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  content: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WallReaction {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// ============================================================
// POLL INTERFACES
// ============================================================

export interface Poll {
  id: string;
  chat_id: string;
  message_id: string | null;
  creator_id: string;
  question: string;
  allows_multiple: boolean;
  is_anonymous: boolean;
  closes_at: string | null;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  sort_order: number;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface PollWithOptions extends Poll {
  options: (PollOption & { votes: PollVote[] })[];
  totalVotes: number;
}

// ============================================================
// SUPABASE DATABASE TYPE MAP
// ============================================================

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: Team;
        Insert: Omit<Team, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Team, 'id'>>;
      };
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at' | 'is_active' | 'is_paused'> & {
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          is_paused?: boolean;
        };
        Update: Partial<Omit<User, 'id'>>;
      };
      texter_settings: {
        Row: TexterSettings;
        Insert: Pick<TexterSettings, 'user_id'> & Partial<Omit<TexterSettings, 'id' | 'user_id'>>;
        Update: Partial<Omit<TexterSettings, 'id' | 'user_id'>>;
      };
      friendships: {
        Row: Friendship;
        Insert: Pick<Friendship, 'requester_id' | 'addressee_id'> & Partial<Omit<Friendship, 'id' | 'requester_id' | 'addressee_id'>>;
        Update: Partial<Omit<Friendship, 'id'>>;
      };
      friend_settings: {
        Row: FriendSettings;
        Insert: Pick<FriendSettings, 'user_id' | 'friend_user_id'> & Partial<Omit<FriendSettings, 'id' | 'user_id' | 'friend_user_id'>>;
        Update: Partial<Omit<FriendSettings, 'id' | 'user_id' | 'friend_user_id'>>;
      };
      denied_friend_requests: {
        Row: DeniedFriendRequest;
        Insert: Omit<DeniedFriendRequest, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DeniedFriendRequest, 'id'>>;
      };
      chats: {
        Row: Chat;
        Insert: Pick<Chat, 'created_by'> & Partial<Omit<Chat, 'id' | 'created_by'>>;
        Update: Partial<Omit<Chat, 'id'>>;
      };
      chat_members: {
        Row: ChatMember;
        Insert: Pick<ChatMember, 'chat_id' | 'user_id'> & Partial<Omit<ChatMember, 'id' | 'chat_id' | 'user_id'>>;
        Update: Partial<Omit<ChatMember, 'id'>>;
      };
      messages: {
        Row: Message;
        Insert: Pick<Message, 'chat_id' | 'sender_id'> & Partial<Omit<Message, 'id' | 'chat_id' | 'sender_id'>>;
        Update: Partial<Omit<Message, 'id'>>;
      };
      message_edits: {
        Row: MessageEdit;
        Insert: Pick<MessageEdit, 'message_id' | 'old_content'> & Partial<Omit<MessageEdit, 'id' | 'message_id' | 'old_content'>>;
        Update: Partial<Omit<MessageEdit, 'id'>>;
      };
      message_reactions: {
        Row: MessageReaction;
        Insert: Pick<MessageReaction, 'message_id' | 'user_id' | 'emoji'> & Partial<Omit<MessageReaction, 'id' | 'message_id' | 'user_id' | 'emoji'>>;
        Update: Partial<Omit<MessageReaction, 'id'>>;
      };
      starred_messages: {
        Row: StarredMessage;
        Insert: Pick<StarredMessage, 'user_id' | 'message_id'> & Partial<Omit<StarredMessage, 'id' | 'user_id' | 'message_id'>>;
        Update: Partial<Omit<StarredMessage, 'id'>>;
      };
      message_read_receipts: {
        Row: MessageReadReceipt;
        Insert: Pick<MessageReadReceipt, 'message_id' | 'user_id'> & Partial<Omit<MessageReadReceipt, 'id' | 'message_id' | 'user_id'>>;
        Update: Partial<Omit<MessageReadReceipt, 'id'>>;
      };
      quick_messages: {
        Row: QuickMessage;
        Insert: Pick<QuickMessage, 'user_id' | 'created_by' | 'content'> & Partial<Omit<QuickMessage, 'id' | 'user_id' | 'created_by' | 'content'>>;
        Update: Partial<Omit<QuickMessage, 'id'>>;
      };
      reports: {
        Row: Report;
        Insert: Pick<Report, 'reporter_id'> & Partial<Omit<Report, 'id' | 'reporter_id'>>;
        Update: Partial<Omit<Report, 'id'>>;
      };
      sos_alerts: {
        Row: SosAlert;
        Insert: Pick<SosAlert, 'texter_id'> & Partial<Omit<SosAlert, 'id' | 'texter_id'>>;
        Update: Partial<Omit<SosAlert, 'id'>>;
      };
      call_logs: {
        Row: CallLog;
        Insert: Pick<CallLog, 'chat_id' | 'initiator_id' | 'type' | 'status'> & Partial<Omit<CallLog, 'id' | 'chat_id' | 'initiator_id' | 'type' | 'status'>>;
        Update: Partial<Omit<CallLog, 'id'>>;
      };
      call_signals: {
        Row: CallSignal;
        Insert: Pick<CallSignal, 'chat_id' | 'call_log_id' | 'caller_id' | 'signal_type' | 'expires_at'> & Partial<Omit<CallSignal, 'id' | 'chat_id' | 'call_log_id' | 'caller_id' | 'signal_type' | 'expires_at'>>;
        Update: Partial<Omit<CallSignal, 'id'>>;
      };
      push_tokens: {
        Row: PushToken;
        Insert: Pick<PushToken, 'user_id' | 'token' | 'platform'> & Partial<Omit<PushToken, 'id' | 'user_id' | 'token' | 'platform'>>;
        Update: Partial<Omit<PushToken, 'id'>>;
        Enums: {
          push_token_type: PushTokenType;
        };
      };
      user_sessions: {
        Row: UserSession;
        Insert: Pick<UserSession, 'user_id'> & Partial<Omit<UserSession, 'id' | 'user_id'>>;
        Update: Partial<Omit<UserSession, 'id'>>;
      };
      team_invitations: {
        Row: TeamInvitation;
        Insert: Pick<TeamInvitation, 'team_id' | 'invited_by' | 'email' | 'token' | 'expires_at'> & Partial<Omit<TeamInvitation, 'id' | 'team_id' | 'invited_by' | 'email' | 'token' | 'expires_at'>>;
        Update: Partial<Omit<TeamInvitation, 'id'>>;
      };
      support_requests: {
        Row: SupportRequest;
        Insert: Pick<SupportRequest, 'user_id' | 'type' | 'subject' | 'description' | 'email'> & Partial<Omit<SupportRequest, 'id' | 'user_id' | 'type' | 'subject' | 'description' | 'email'>>;
        Update: Partial<Omit<SupportRequest, 'id'>>;
      };
      referrals: {
        Row: Referral;
        Insert: Pick<Referral, 'referrer_team_id' | 'referred_team_id'> & Partial<Omit<Referral, 'id' | 'referrer_team_id' | 'referred_team_id'>>;
        Update: Partial<Omit<Referral, 'id'>>;
      };
      wall_posts: {
        Row: WallPost;
        Insert: Pick<WallPost, 'team_id' | 'author_id'> & Partial<Omit<WallPost, 'id' | 'team_id' | 'author_id'>>;
        Update: Partial<Omit<WallPost, 'id'>>;
      };
      wall_comments: {
        Row: WallComment;
        Insert: Pick<WallComment, 'post_id' | 'author_id' | 'content'> & Partial<Omit<WallComment, 'id' | 'post_id' | 'author_id' | 'content'>>;
        Update: Partial<Omit<WallComment, 'id'>>;
      };
      wall_reactions: {
        Row: WallReaction;
        Insert: Pick<WallReaction, 'post_id' | 'user_id' | 'emoji'> & Partial<Omit<WallReaction, 'id' | 'post_id' | 'user_id' | 'emoji'>>;
        Update: Partial<Omit<WallReaction, 'id'>>;
      };
    };
    Enums: {
      plan_type: PlanType;
      user_role: UserRole;
      friendship_status: FriendshipStatus;
      message_type: MessageType;
      report_status: ReportStatus;
      call_type: CallType;
      call_status: CallStatus;
      signal_type: SignalType;
      platform_type: PlatformType;
      push_token_type: PushTokenType;
      support_request_type: SupportRequestType;
    };
    Functions: {
      create_team_with_owner: {
        Args: {
          team_name: string;
          owner_display_name?: string | null;
        };
        Returns: {
          team: Team;
          user: User;
        };
      };
      create_texter: {
        Args: {
          texter_display_name: string;
          texter_password: string;
        };
        Returns: {
          user: User;
          zemi_number: string;
          password: string;
        };
      };
      export_user_data: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      delete_owner_account: {
        Args: Record<string, never>;
        Returns: void;
      };
      delete_super_account: {
        Args: Record<string, never>;
        Returns: void;
      };
      update_user_profile: {
        Args: {
          new_display_name: string | null;
        };
        Returns: void;
      };
      create_super_invitation: {
        Args: {
          invitation_email: string;
          invitation_display_name?: string | null;
        };
        Returns: TeamInvitation;
      };
      claim_super_invitation: {
        Args: {
          invitation_token: string;
        };
        Returns: User;
      };
      get_invitation_public: {
        Args: {
          invitation_token: string;
        };
        Returns: {
          id: string;
          role: string;
          email: string;
          invited_display_name: string | null;
          team_name: string;
          inviter_name: string;
          expires_at: string;
        };
      };
      validate_referral_code: {
        Args: {
          code: string;
        };
        Returns: {
          valid: boolean;
          team_name: string | null;
        };
      };
      submit_referral: {
        Args: {
          code: string;
        };
        Returns: void;
      };
      claim_referral_rewards: {
        Args: Record<string, never>;
        Returns: {
          claimed_count: number;
        };
      };
      get_referral_stats: {
        Args: Record<string, never>;
        Returns: ReferralStats;
      };
    };
  };
}
