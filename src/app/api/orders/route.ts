import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createWooCommerceAPI } from '@/lib/woocommerce';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'אין טוקן הרשאה' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');
    const storeId = searchParams.get('store_id');

    if (!orderId || !storeId) {
      return NextResponse.json(
        { success: false, message: 'מזהה הזמנה ומזהה חנות נדרשים' },
        { status: 400 }
      );
    }

    console.log(`[Orders API] GET order_id=${orderId}, store_id=${storeId}`);
    const api = createWooCommerceAPI(storeId);
    const order = await api.getOrderWithNotes(orderId);

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        store_info: {
          id: storeId,
        },
      },
    });
  } catch (error) {
    console.error('Orders API error:', error);
    const message = error instanceof Error ? error.message : 'שגיאה בטעינת ההזמנה';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'אין טוקן הרשאה' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { order_id, store_id, status } = body;

    if (!order_id || !status || !store_id) {
      return NextResponse.json(
        { success: false, message: 'שדות חסרים' },
        { status: 400 }
      );
    }

    const api = createWooCommerceAPI(store_id);
    const order = await api.updateOrderStatus(order_id, status);

    // Sync status to Supabase delivery_assignments
    const isCompleted = status.includes('done') || status === 'completed';
    const supabaseUpdate: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (isCompleted) {
      supabaseUpdate.completed_at = new Date().toISOString();
    }

    await supabase
      .from('delivery_assignments')
      .update(supabaseUpdate)
      .eq('order_id', order_id)
      .eq('store_id', store_id);

    // Log activity
    await logActivity({
      driverId: user.user_id,
      driverName: user.username,
      action: 'status_change',
      orderId: order_id,
      storeId: store_id,
      details: { from_status: body.previous_status, to_status: status },
    });

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Update status error:', error);
    const message = error instanceof Error ? error.message : 'שגיאה בעדכון הסטטוס';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
