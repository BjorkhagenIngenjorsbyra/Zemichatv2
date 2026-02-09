import { supabase } from './supabase';

/**
 * Export all personal data for the current user via RPC.
 */
export async function exportUserData(): Promise<{
  data: Record<string, unknown> | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('export_user_data');

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as Record<string, unknown>, error: null };
}

/**
 * Delete the owner's account and entire team via RPC.
 * Only callable by team owners.
 */
export async function deleteOwnerAccount(): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('delete_owner_account');

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Delete a Super user's own account via RPC.
 * Only callable by Super users.
 */
export async function deleteSuperAccount(): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('delete_super_account');

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Update the current user's display name via RPC.
 */
export async function updateUserProfile(displayName: string | null): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('update_user_profile' as never, {
    new_display_name: displayName,
  } as never);

  if (error) {
    return { error: new Error((error as { message: string }).message) };
  }

  return { error: null };
}

/**
 * Download a JSON object as a file.
 */
export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
