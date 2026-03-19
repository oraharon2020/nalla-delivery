import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let initialized = false;

function initWebPush() {
  if (initialized) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }
  webpush.setVapidDetails(
    'mailto:admin@nalladriver.co.il',
    publicKey,
    privateKey
  );
  initialized = true;
}

export async function sendPushToTarget(
  title: string,
  body: string,
  target: string = 'all',
  url?: string
): Promise<{ sent: number; failed: number; total: number }> {
  initWebPush();

  let query = supabase.from('push_subscriptions').select('*');
  if (target === 'drivers') query = query.eq('user_type', 'driver');
  else if (target === 'admins') query = query.eq('user_type', 'admin');

  const { data: subscriptions, error } = await query;
  if (error) throw error;
  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const payload = JSON.stringify({ title, body, url: url || '/' });

  let sentCount = 0;
  let failedCount = 0;
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sentCount++;
      } catch (err: unknown) {
        failedCount++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
  }

  // Log
  await supabase.from('push_notifications_log').insert({
    title,
    body,
    target,
    sent_count: sentCount,
    failed_count: failedCount,
    sent_by: 'system',
  });

  return { sent: sentCount, failed: failedCount, total: subscriptions.length };
}
