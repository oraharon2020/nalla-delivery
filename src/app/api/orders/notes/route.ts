import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createWooCommerceAPI } from '@/lib/woocommerce';
import { logActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'אין טוקן הרשאה' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { order_id, store_id, note, customer_note } = body;

    if (!order_id || !note || !store_id) {
      return NextResponse.json(
        { success: false, message: 'שדות חסרים' },
        { status: 400 }
      );
    }

    const api = createWooCommerceAPI(store_id);
    const addedNote = await api.addOrderNote(order_id, note, customer_note || false);

    // Log activity
    await logActivity({
      driverId: user.user_id,
      driverName: user.username,
      action: 'note_added',
      orderId: order_id,
      storeId: store_id,
      details: { note_text: note.substring(0, 200) },
    });

    return NextResponse.json({
      success: true,
      data: addedNote,
    });
  } catch (error) {
    console.error('Add note error:', error);
    const message = error instanceof Error ? error.message : 'שגיאה בהוספת הערה';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
