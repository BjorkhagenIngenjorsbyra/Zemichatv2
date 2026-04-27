import { supabase } from './supabase';
import {
  type Report,
  type User,
  ReportCategory,
  ReportStatus,
  ReportTargetType,
  UserRole,
} from '../types/database';

// ============================================================
// Types
// ============================================================

const MAX_DESCRIPTION_LENGTH = 2000;

export interface ReportWithReporter extends Report {
  reporter: Pick<User, 'id' | 'display_name' | 'zemi_number'> | null;
  reported_user: Pick<User, 'id' | 'display_name' | 'zemi_number'> | null;
}

interface CreateReportArgs {
  category: ReportCategory;
  description?: string;
  reportedUserId?: string;
  reportedMessageId?: string;
  reportedChatId?: string;
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Map a ReportCategory to a short human-readable string for the legacy
 * `reason` column. Older clients still read this; older rows still
 * write here. Keep in sync with i18n keys when those land.
 */
function categoryLabel(category: ReportCategory): string {
  switch (category) {
    case ReportCategory.INAPPROPRIATE:
      return 'Inappropriate content';
    case ReportCategory.HARASSMENT:
      return 'Harassment';
    case ReportCategory.SPAM:
      return 'Spam';
    case ReportCategory.SELF_HARM:
      return 'Self-harm';
    case ReportCategory.ILLEGAL:
      return 'Illegal content';
    case ReportCategory.OTHER:
      return 'Other';
  }
}

async function createReport(args: CreateReportArgs): Promise<{
  report: Report | null;
  error: Error | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { report: null, error: new Error('Not authenticated') };
  }

  if (
    !args.reportedUserId &&
    !args.reportedMessageId &&
    !args.reportedChatId
  ) {
    return {
      report: null,
      error: new Error('Must report a user, a message, or a chat'),
    };
  }

  const description =
    typeof args.description === 'string'
      ? args.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
      : null;

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      reported_user_id: args.reportedUserId ?? null,
      reported_message_id: args.reportedMessageId ?? null,
      reported_chat_id: args.reportedChatId ?? null,
      category: args.category,
      description: description && description.length > 0 ? description : null,
      // Keep legacy `reason` populated so older clients / mail templates
      // still show something readable.
      reason: categoryLabel(args.category),
      status: ReportStatus.PENDING,
    } as never)
    .select()
    .single();

  if (error) {
    return { report: null, error: new Error(error.message) };
  }

  // Fire-and-forget: notify support / Owner about the new report. The
  // edge function applies its own auth + counts so it's safe to skip
  // on transient errors.
  supabase.functions
    .invoke('report-handler', { body: { reportId: (data as { id: string }).id } })
    .catch(() => {
      // Non-critical: notification failure must not break the user flow.
    });

  return { report: data as unknown as Report, error: null };
}

// ============================================================
// Public API — one entry point per target type, mirroring the PRD.
// ============================================================

export async function reportMessage(
  messageId: string,
  category: ReportCategory,
  description?: string,
): Promise<{ report: Report | null; error: Error | null }> {
  return createReport({
    category,
    description,
    reportedMessageId: messageId,
  });
}

export async function reportChat(
  chatId: string,
  category: ReportCategory,
  description?: string,
): Promise<{ report: Report | null; error: Error | null }> {
  return createReport({
    category,
    description,
    reportedChatId: chatId,
  });
}

export async function reportUser(
  userId: string,
  category: ReportCategory,
  description?: string,
): Promise<{ report: Report | null; error: Error | null }> {
  return createReport({
    category,
    description,
    reportedUserId: userId,
  });
}

// ============================================================
// Reads
// ============================================================

/**
 * Reports submitted by the currently signed-in user.
 */
export async function getMyReports(): Promise<{
  reports: Report[];
  error: Error | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { reports: [], error: new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { reports: [], error: new Error(error.message) };
  }
  return { reports: (data ?? []) as unknown as Report[], error: null };
}

/**
 * All reports involving the Owner's team — either authored by their
 * Texters/Supers or targeting them. Owner-only. RLS still enforces the
 * boundary; this just performs the team-scoped fetch.
 */
export async function getTeamReports(options?: {
  status?: ReportStatus;
  category?: ReportCategory;
  targetType?: ReportTargetType;
  limit?: number;
}): Promise<{
  reports: ReportWithReporter[];
  error: Error | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { reports: [], error: new Error('Not authenticated') };
  }

  const { data: me, error: meError } = await supabase
    .from('users')
    .select('team_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (meError || !me) {
    return { reports: [], error: new Error('Could not load user') };
  }
  const meTyped = me as unknown as { team_id: string; role: UserRole };
  if (meTyped.role !== UserRole.OWNER) {
    return { reports: [], error: new Error('Only owners can list team reports') };
  }

  let query = supabase
    .from('reports')
    .select(
      `
      *,
      reporter:reporter_id (id, display_name, zemi_number),
      reported_user:reported_user_id (id, display_name, zemi_number)
      `,
    )
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.status) query = query.eq('status', options.status);
  if (options?.category) query = query.eq('category', options.category);
  if (options?.targetType) query = query.eq('target_type', options.targetType);

  const { data, error } = await query;
  if (error) {
    return { reports: [], error: new Error(error.message) };
  }
  return {
    reports: (data ?? []) as unknown as ReportWithReporter[],
    error: null,
  };
}

/**
 * Owner moves a report to one of the terminal statuses. The trigger
 * fills in reviewed_at automatically.
 */
export async function setReportStatus(
  reportId: string,
  status: ReportStatus.REVIEWED | ReportStatus.RESOLVED | ReportStatus.DISMISSED,
): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('reports')
    .update({ status, reviewed_by: user.id } as never)
    .eq('id', reportId);

  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/**
 * Stable list of categories for the UI (used by the report modal).
 * Order is intentional: most-likely-used first, "other" last.
 */
export const REPORT_CATEGORY_ORDER: ReportCategory[] = [
  ReportCategory.INAPPROPRIATE,
  ReportCategory.HARASSMENT,
  ReportCategory.SPAM,
  ReportCategory.SELF_HARM,
  ReportCategory.ILLEGAL,
  ReportCategory.OTHER,
];
