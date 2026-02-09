import { supabase } from './supabase';
import { SupportRequestType } from '../types/database';

interface DeviceInfo {
  appVersion: string;
  userAgent: string;
  platform: string;
  language: string;
}

interface SubmitSupportRequestData {
  type: SupportRequestType;
  subject: string;
  description: string;
  email: string;
  screenshotFile?: File;
}

export function getDeviceInfo(): DeviceInfo {
  return {
    appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
  };
}

export function buildMailtoUrl(): string {
  const info = getDeviceInfo();
  const subject = encodeURIComponent('Zemichat Support');
  const body = encodeURIComponent(
    `\n\n---\nDevice: ${info.userAgent}\nPlatform: ${info.platform}\nLanguage: ${info.language}\nApp: ${info.appVersion}`
  );
  return `mailto:support@zemichat.com?subject=${subject}&body=${body}`;
}

export async function uploadScreenshot(
  userId: string,
  file: File
): Promise<{ url: string | null; error: Error | null }> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('support-attachments')
    .upload(path, file, { contentType: file.type });

  if (error) {
    return { url: null, error: new Error(error.message) };
  }

  const { data: urlData } = supabase.storage
    .from('support-attachments')
    .getPublicUrl(path);

  return { url: urlData.publicUrl, error: null };
}

export async function submitSupportRequest(
  data: SubmitSupportRequestData
): Promise<{ error: Error | null }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: new Error('Not authenticated') };
  }

  const userId = userData.user.id;
  let screenshotUrl: string | null = null;

  if (data.screenshotFile) {
    const { url, error: uploadError } = await uploadScreenshot(userId, data.screenshotFile);
    if (uploadError) {
      return { error: uploadError };
    }
    screenshotUrl = url;
  }

  const deviceInfo = getDeviceInfo();

  const { error: insertError } = await supabase
    .from('support_requests')
    .insert({
      user_id: userId,
      type: data.type,
      subject: data.subject,
      description: data.description,
      email: data.email,
      screenshot_url: screenshotUrl,
      device_info: deviceInfo,
    } as never);

  if (insertError) {
    return { error: new Error(insertError.message) };
  }

  // Fire-and-forget Edge Function call for email notification
  supabase.functions
    .invoke('send-support-email', {
      body: {
        type: data.type,
        subject: data.subject,
        description: data.description,
        email: data.email,
      },
    })
    .catch(() => {
      // Non-critical: email notification failure should not affect the user
    });

  return { error: null };
}
