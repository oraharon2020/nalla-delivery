import { supabase } from './supabase';

export type ActivityAction = 
  | 'status_change'
  | 'note_added'
  | 'file_uploaded'
  | 'login';

interface LogActivityParams {
  driverId: string;
  driverName: string;
  action: ActivityAction;
  orderId?: string;
  orderNumber?: string;
  storeId?: string;
  details?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams) {
  try {
    await supabase.from('activity_logs').insert({
      driver_id: params.driverId,
      driver_name: params.driverName,
      action: params.action,
      order_id: params.orderId || null,
      order_number: params.orderNumber || null,
      store_id: params.storeId || null,
      details: params.details || {},
    });
  } catch (e) {
    // Silent fail - logging should never break the main flow
    console.error('[Activity Log] Failed to log:', e);
  }
}
