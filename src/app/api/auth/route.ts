import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity-log';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'אימייל וסיסמה הם שדות חובה' },
        { status: 400 }
      );
    }

    const identifier = username.trim();

    // Try to find driver by email first, then by display_name
    let user = null;

    const { data: byEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', identifier)
      .eq('role', 'driver')
      .single();

    if (byEmail) {
      user = byEmail;
    } else {
      // Try by display_name (case-insensitive)
      const { data: byName } = await supabase
        .from('users')
        .select('*')
        .ilike('display_name', identifier)
        .eq('role', 'driver')
        .single();

      if (byName) {
        user = byName;
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'משתמש לא נמצא' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, message: 'החשבון אינו פעיל' },
        { status: 403 }
      );
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password.trim(), user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, message: 'סיסמה שגויה' },
        { status: 401 }
      );
    }

    // Generate JWT token with Supabase user ID
    const token = generateToken({
      user_id: user.id,
      username: user.display_name,
    });

    // Log login activity
    await logActivity({
      driverId: user.id,
      driverName: user.display_name,
      action: 'login',
    });

    return NextResponse.json({
      success: true,
      token,
      username: user.display_name,
    });
  } catch (error: unknown) {
    console.error('Auth error:', error);

    return NextResponse.json(
      { success: false, message: 'שגיאה בהתחברות' },
      { status: 500 }
    );
  }
}
