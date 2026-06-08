/**
 * Simulation harness — Agent abstraction.
 *
 * An Agent wraps one authenticated user (Owner / Super / Texter) and exposes the
 * actions a real person takes in the app, plus eventually-consistent read helpers
 * that poll briefly (the local Supabase stack can lag a read just after a write).
 *
 * Built on the RLS test world (getTestWorld) so agents act through real RLS — what
 * an Agent can see/do is exactly what the policies allow for that role.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import { getTestWorld, type TestUser, type TestWorld } from '../rls/helpers/setup';

export type Role = 'owner' | 'super' | 'texter';

type DbResult<T> = { data: T | null; error: { message: string; code?: string } | null };

export interface SimMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
}

const DEFAULT_POLL = { tries: 15, delayMs: 120 };

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Agent {
  constructor(
    public readonly name: string,
    public readonly id: string,
    public readonly role: Role,
    public readonly client: SupabaseClient<Database>,
  ) {}

  /**
   * Send a message into a chat. Returns the PostgREST result (data or error).
   * Pass `opts.id` (a client UUID) to exercise optimistic/idempotent sends.
   */
  async sendMessage(
    chatId: string,
    content: string,
    opts: { type?: string; id?: string } = {},
  ): Promise<DbResult<SimMessage>> {
    const { type = 'text', id } = opts;
    const row: Record<string, unknown> = { chat_id: chatId, sender_id: this.id, type, content };
    if (id) row.id = id;
    return this.client
      .from('messages')
      .insert(row)
      .select()
      .single() as unknown as Promise<DbResult<SimMessage>>;
  }

  /** Soft-delete a message ("delete for everyone"). Transparency: still visible to Owner. */
  async deleteMessage(messageId: string): Promise<DbResult<SimMessage>> {
    return this.client
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), deleted_by: this.id })
      .eq('id', messageId)
      .select()
      .single() as unknown as Promise<DbResult<SimMessage>>;
  }

  /** Messages this agent can currently see in a chat, oldest-first. */
  async visibleMessages(chatId: string): Promise<SimMessage[]> {
    const res = await this.client
      .from('messages')
      .select('id, chat_id, sender_id, content, type, deleted_at, deleted_by, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    return (res.data ?? []) as unknown as SimMessage[];
  }

  /** Can this agent see a specific message id at all? */
  async canSee(messageId: string): Promise<boolean> {
    const res = await this.client.from('messages').select('id').eq('id', messageId);
    return (res.data?.length ?? 0) > 0;
  }

  /** Raise an SOS / Tillkalla alert (Texter only). Must never be blockable. */
  async sendSos(location?: string): Promise<DbResult<{ id: string }>> {
    return this.client
      .from('sos_alerts')
      .insert({ texter_id: this.id, location: location ?? null })
      .select('id')
      .single() as unknown as Promise<DbResult<{ id: string }>>;
  }

  /**
   * Eventually-consistent read: poll visibleMessages until `predicate` holds or
   * we run out of tries. Returns the last snapshot (so callers can assert on it).
   */
  async waitForMessages(
    chatId: string,
    predicate: (msgs: SimMessage[]) => boolean,
    opts: { tries?: number; delayMs?: number } = {},
  ): Promise<SimMessage[]> {
    const { tries, delayMs } = { ...DEFAULT_POLL, ...opts };
    let snapshot: SimMessage[] = [];
    for (let i = 0; i < tries; i++) {
      snapshot = await this.visibleMessages(chatId);
      if (predicate(snapshot)) return snapshot;
      await sleep(delayMs);
    }
    return snapshot;
  }
}

export interface SimWorld {
  world: TestWorld;
  team1: { owner: Agent; super: Agent; texter: Agent };
  team2: { owner: Agent; super: Agent; texter: Agent };
}

function agentFrom(user: TestUser, role: Role, label: string): Agent {
  return new Agent(label, user.id, role, user.client);
}

/** Build the simulation world (authenticated agents over the seeded RLS world). */
export async function getSimWorld(): Promise<SimWorld> {
  const world = await getTestWorld();
  return {
    world,
    team1: {
      owner: agentFrom(world.team1.owner, 'owner', 'Owner-1'),
      super: agentFrom(world.team1.super, 'super', 'Super-1'),
      texter: agentFrom(world.team1.texter, 'texter', 'Texter-1'),
    },
    team2: {
      owner: agentFrom(world.team2.owner, 'owner', 'Owner-2'),
      super: agentFrom(world.team2.super, 'super', 'Super-2'),
      texter: agentFrom(world.team2.texter, 'texter', 'Texter-2'),
    },
  };
}
