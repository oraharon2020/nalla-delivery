import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createWooCommerceAPI } from '@/lib/woocommerce';
import { StoreId } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Custom statuses for each store
const customStatuses: Record<StoreId, string[]> = {
  '1': [
    'done-sharon', 'done-rafi', 'done-alex', 'done-bachti', 'done-farid', 
    'done-ariel', 'done-lior', 'done-dvir', 'done-nikos', 'done-dima',
    'nikos-toam', 'farid-toam', 'sharon-toam', 'aviel-toam', 'joni-toam',
    'un-adir', 'un-shlomi', 'un-joni', 'un-adam', 'un-warehouse',
    'north-delivery', 'south-delivery', 'shipping-center', 'sharon-delivery', 
    'jerusalem-deliver', 'preparation', 'joni', 'adam', 'mitot', 'adiv', 
    'customer-visit', 'pickup', 'phone-payment'
  ],
  '2': [
    'done-sharon', 'done-alex', 'done-bachti', 'done-farid', 'done-ariel', 
    'done-lior', 'done-dvir', 'done-dima', 'done-nikos',
    'nikos-toam', 'farid-toam', 'sharon-toam', 'aviel-toam', 'joni-toam', 
    'lior-toam', 'dima-toam',
    'un-adir', 'un-shlomi', 'un-joni', 'un-adam', 'un-warehouse', 'un-ben',
    'north-delivery', 'south-delivery', 'shipping-center', 'sharon-delivery', 
    'jerusalem-deliver', 'preparation', 'shipping', 'phone-payment', 
    'happycustomer', 'adam', 'joni', 'nikos', 'change-order-cust',
    'customer-visit', 'late-delivery', 'radom', 'mlay', 'delivey-date', 
    'adiv', 'mitot', 'pickup', 'nikus-fix', 'sharon-fix', 'lior-fix', 
    'betipol-eli-or', 'rapad', 'bid', 'customrt-visit-14', 'ben'
  ],
};

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
    const action = searchParams.get('action');
    const storeId = searchParams.get('store_id') as StoreId;

    if (action === 'get_all_statuses') {
      // Get statuses from both stores
      const api1 = createWooCommerceAPI('1');
      const api2 = createWooCommerceAPI('2');

      let store1Statuses: Array<{ slug: string; name: string }> = [];
      let store2Statuses: Array<{ slug: string; name: string }> = [];

      try {
        const result1 = await api1.getOrderStatuses();
        store1Statuses = result1.map((s) => ({ slug: s.slug.replace('wc-', ''), name: s.name }));
      } catch (e) {
        console.error('Error fetching store 1 statuses:', e);
      }

      try {
        const result2 = await api2.getOrderStatuses();
        store2Statuses = result2.map((s) => ({ slug: s.slug.replace('wc-', ''), name: s.name }));
      } catch (e) {
        console.error('Error fetching store 2 statuses:', e);
      }

      // Build label map from WooCommerce responses
      const labelMap: Record<string, string> = {};
      [...store1Statuses, ...store2Statuses].forEach(s => {
        if (s.name) labelMap[s.slug] = s.name;
      });

      // Merge slugs with custom statuses
      const store1Slugs = store1Statuses.map(s => s.slug);
      const store2Slugs = store2Statuses.map(s => s.slug);
      const bellanoStatuses = [...new Set([...store1Slugs, ...customStatuses['1']])];
      const nallaStatuses = [...new Set([...store2Slugs, ...customStatuses['2']])];

      return NextResponse.json({
        success: true,
        bellano: bellanoStatuses,
        nalla: nallaStatuses,
        labels: labelMap,
      });
    }

    if (action === 'get_store_statuses' && storeId) {
      const api = createWooCommerceAPI(storeId);
      const result = await api.getOrderStatuses();

      const apiStatuses = result.map((s) => ({ slug: s.slug.replace('wc-', ''), name: s.name }));
      const allSlugs = [...new Set([...apiStatuses.map(s => s.slug), ...customStatuses[storeId]])];

      // Build label map
      const labelMap: Record<string, string> = {};
      apiStatuses.forEach(s => {
        if (s.name) labelMap[s.slug] = s.name;
      });

      return NextResponse.json({
        success: true,
        data: allSlugs,
        labels: labelMap,
      });
    }

    return NextResponse.json(
      { success: false, message: 'פעולה לא נתמכת' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Status settings error:', error);
    const message = error instanceof Error ? error.message : 'שגיאה בטעינת הסטטוסים';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
