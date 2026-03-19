import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/auth';
import jwt from 'jsonwebtoken';

const ADMIN_JWT_SECRET = process.env.JWT_SECRET || 'nalla-admin-secret-key-2024';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Authenticate - try unified auth first (driver tokens), then admin tokens
    let userId: string | null = null;

    const user = authenticateRequest(request);
    if (user) {
      userId = String(user.user_id);
    } else {
      // Try admin secret as fallback
      const authHeader = request.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        try {
          const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
          userId = decoded.userId;
        } catch {
          // Invalid token
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { latitude, longitude, accuracy, speed, heading } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
    }

    // Upsert driver location (insert or update)
    const { error } = await supabase
      .from('driver_locations')
      .upsert({
        driver_id: userId,
        latitude,
        longitude,
        accuracy: accuracy || null,
        speed: speed || null,
        heading: heading || null,
        is_online: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'driver_id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Location update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - fetch all driver locations (for admin tracking page)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('driver_locations')
      .select('*, driver:users(id, display_name, phone)')
      .order('last_seen', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Location fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - mark driver as offline
export async function PATCH(request: NextRequest) {
  try {
    let userId: string | null = null;

    const user = authenticateRequest(request);
    if (user) {
      userId = String(user.user_id);
    } else {
      const authHeader = request.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        try {
          const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
          userId = decoded.userId;
        } catch {
          // Invalid token
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('driver_locations')
      .update({ is_online: false, updated_at: new Date().toISOString() })
      .eq('driver_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
