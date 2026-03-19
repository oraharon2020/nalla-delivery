import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CompletionRequest {
  store_id: string;
  order_id: number;
  status: string;
  driver_name: string;
  driver_phone: string;
  customer_name: string;
  order_number: string;
  store_name: string;
  delivery_date: string;
  time_slot?: string;
  service_type?: 'delivery' | 'technician_visit';
}

// Replace template placeholders with actual values
function processNoteTemplate(template: string, data: CompletionRequest): string {
  const now = new Date();
  const replacements: Record<string, string> = {
    '{driver_name}': data.driver_name || '',
    '{driver_phone}': data.driver_phone || '',
    '{customer_name}': data.customer_name || '',
    '{order_number}': data.order_number || '',
    '{store_name}': data.store_name || '',
    '{delivery_date}': data.delivery_date || '',
    '{delivery_time}': now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
    '{scheduled_date}': data.delivery_date || '',
    '{time_slot}': data.time_slot || '',
    '{current_date}': now.toLocaleDateString('he-IL'),
    '{current_time}': now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const data: CompletionRequest = await request.json();
    const { store_id, order_id, status } = data;

    if (!store_id || !order_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'חסרים פרטי חנות או הזמנה' 
      });
    }

    // Get store credentials
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('store_id', store_id)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ 
        success: false, 
        error: 'חנות לא נמצאה' 
      });
    }

    // Determine which template to use based on service_type
    const isTechnicianVisit = data.service_type === 'technician_visit';
    const templateKey = isTechnicianVisit ? 'technician_note_template' : 'completion_note_template';
    
    // Get note template from settings
    const { data: templateSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', templateKey)
      .single();

    // Default templates
    const defaultDeliveryTemplate = `שלום {customer_name},

המשלוח שלך (הזמנה #{order_number}) תואם בהצלחה!

פרטי המסירה:
📅 תאריך: {delivery_date}
⏰ טווח שעות: {time_slot}
🚗 נהג: {driver_name}
📞 טלפון נהג: {driver_phone}

תודה שקנית ב-{store_name}!`;

    const defaultTechnicianTemplate = `שלום {customer_name},

ביקור הטכנאי שלך (הזמנה #{order_number}) הושלם בהצלחה!

פרטי הביקור:
📅 תאריך: {delivery_date}
⏰ טווח שעות: {time_slot}
🔧 טכנאי: {driver_name}
📞 טלפון: {driver_phone}

תודה שבחרת ב-{store_name}!`;

    const defaultTemplate = isTechnicianVisit ? defaultTechnicianTemplate : defaultDeliveryTemplate;
    const noteTemplate = templateSetting?.value || defaultTemplate;
    const note = processNoteTemplate(noteTemplate, data);

    // Determine WooCommerce status
    let wcStatus = status;
    if (status === 'completed') {
      wcStatus = 'completed';
    } else if (status.startsWith('wc-')) {
      wcStatus = status.replace('wc-', '');
    }

    // Build WooCommerce API URL
    const credentials = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString('base64');
    let baseUrl = store.url.replace(/\/$/, '');
    // Ensure URL has protocol
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }
    const apiUrl = `${baseUrl}/wp-json/wc/v3/orders/${order_id}`;

    // Update order status in WooCommerce
    const updateResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: wcStatus,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('WooCommerce update error:', errorText);
      // Continue to try posting the note even if status update fails
    }

    // Post customer note to order
    const noteResponse = await fetch(`${apiUrl}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        note: note,
        customer_note: true, // This will send email to customer
      }),
    });

    if (!noteResponse.ok) {
      const errorText = await noteResponse.text();
      console.error('WooCommerce note error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'שגיאה בשליחת הערה ל-WooCommerce'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'המשלוח סומן כהושלם והודעה נשלחה ללקוח'
    });

  } catch (error) {
    console.error('Complete delivery error:', error);
    return NextResponse.json({
      success: false,
      error: 'שגיאה בעדכון ההזמנה'
    });
  }
}
