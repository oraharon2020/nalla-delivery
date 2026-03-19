import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function initWebPush() {
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
}

export async function POST(request: NextRequest) {
  try {
    initWebPush();

    // Verify admin token
    const adminToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!adminToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, body, target, url } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // Get subscriptions based on target
    let query = supabase.from('push_subscriptions').select('*');
    
    if (target === 'drivers') {
      query = query.eq('user_type', 'driver');
    } else if (target === 'admins') {
      query = query.eq('user_type', 'admin');
    }
    // 'all' - no filter

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        sent: 0, 
        failed: 0,
        message: 'No subscriptions found' 
      });
    }

    const payload = JSON.stringify({ title, body, url: url || '/' });

    let sentCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          sentCount++;
        } catch (err: unknown) {
          failedCount++;
          const statusCode = (err as { statusCode?: number })?.statusCode;
          // Remove expired/invalid subscriptions
          if (statusCode === 404 || statusCode === 410) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    // Log the notification
    await supabase.from('push_notifications_log').insert({
      title,
      body,
      target: target || 'all',
      sent_count: sentCount,
      failed_count: failedCount,
      sent_by: 'admin',
    });

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      expired: expiredEndpoints.length,
      total: subscriptions.length,
    });
  } catch (err) {
    console.error('Push send error:', err);
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
  }
}

// GET - get notification history
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('push_notifications_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Also get subscription count
    const { count } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      notifications: data || [],
      subscriberCount: count || 0,
    });
  } catch (err) {
    console.error('Push history error:', err);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
