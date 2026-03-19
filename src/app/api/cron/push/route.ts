import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushToTarget } from '@/lib/push-server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Vercel Cron: runs every 15 minutes
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Israel timezone
    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const currentHour = israelTime.getHours();
    const currentMinute = israelTime.getMinutes();
    const currentDay = israelTime.getDay(); // 0=Sun
    const currentDate = israelTime.toISOString().split('T')[0]; // YYYY-MM-DD

    // Time window: current 15-minute block (e.g. 08:00-08:14)
    const timeFrom = `${String(currentHour).padStart(2, '0')}:${String(currentMinute - (currentMinute % 15)).padStart(2, '0')}`;
    const timeTo = `${String(currentHour).padStart(2, '0')}:${String(currentMinute - (currentMinute % 15) + 14).padStart(2, '0')}`;

    // Get active scheduled notifications
    const { data: schedules, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('is_active', true)
      .gte('schedule_time', timeFrom)
      .lte('schedule_time', timeTo);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ message: 'No scheduled notifications due', checked: `${timeFrom}-${timeTo}` });
    }

    const results = [];

    for (const schedule of schedules) {
      // Check if already sent today
      if (schedule.last_sent_at) {
        const lastSent = new Date(schedule.last_sent_at);
        const lastSentDate = new Date(lastSent.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
        if (lastSentDate.toDateString() === israelTime.toDateString()) {
          continue; // Already sent today
        }
      }

      let shouldSend = false;

      if (schedule.schedule_type === 'daily') {
        shouldSend = true;
      } else if (schedule.schedule_type === 'weekly') {
        shouldSend = (schedule.schedule_days || []).includes(currentDay);
      } else if (schedule.schedule_type === 'one_time') {
        shouldSend = schedule.one_time_date === currentDate;
      }

      if (!shouldSend) continue;

      // Send it
      const result = await sendPushToTarget(
        schedule.title,
        schedule.body,
        schedule.target || 'all',
        schedule.url
      );

      // Update last_sent_at
      await supabase
        .from('scheduled_notifications')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', schedule.id);

      // Deactivate one-time notifications after sending
      if (schedule.schedule_type === 'one_time') {
        await supabase
          .from('scheduled_notifications')
          .update({ is_active: false })
          .eq('id', schedule.id);
      }

      results.push({ name: schedule.name, ...result });
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err) {
    console.error('Cron push error:', err);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
