import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushToTarget } from '@/lib/push-server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const adminToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!adminToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, body, target, url } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const result = await sendPushToTarget(title, body, target || 'all', url);

    return NextResponse.json({ success: true, ...result });
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
