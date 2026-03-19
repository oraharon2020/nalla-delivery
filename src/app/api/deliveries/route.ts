import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Delivery } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'אין טוקן הרשאה' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { success: false, message: 'נדרש להעביר תאריך' },
        { status: 400 }
      );
    }

    // Read directly from Supabase delivery_assignments
    const { data: assignments, error } = await supabase
      .from('delivery_assignments')
      .select('*')
      .eq('driver_id', user.user_id)
      .eq('delivery_date', date)
      .order('sequence');

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { success: false, message: 'שגיאה בטעינת המשלוחים' },
        { status: 500 }
      );
    }

    const deliveries: Delivery[] = (assignments || []).map((row: any) => ({
      id: row.id,
      order_id: String(row.order_id),
      store_id: row.store_id || '1',
      store_name: row.store_name || 'לא ידוע',
      order_number: row.order_number || String(row.order_id),
      shipping_address: row.shipping_address || 'לא זמין',
      phone: row.phone || 'לא זמין',
      time_slot: row.time_slot || 'לא נקבע',
      customer_name: row.customer_name || 'לא זמין',
      status: row.status || 'pending',
      total_items: row.total_items || 0,
      products: typeof row.products === 'string' ? JSON.parse(row.products) : (row.products || []),
      notes: row.notes || '',
      delivery_cost: row.delivery_cost || 0,
      service_type: row.service_type || 'delivery',
      completed_at: row.completed_at || null,
    }));

    return NextResponse.json({
      success: true,
      data: deliveries,
    });
  } catch (error) {
    console.error('Deliveries API error:', error);
    return NextResponse.json(
      { success: false, message: 'שגיאה בטעינת המשלוחים' },
      { status: 500 }
    );
  }
}
