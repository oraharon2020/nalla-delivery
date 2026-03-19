import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const status = searchParams.get('status');
    const dateRange = searchParams.get('date_range') || 'recent';
    const search = searchParams.get('search');

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    // Get store credentials from Supabase
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Build WooCommerce API URL
    let baseUrl = store.url.replace(/\/$/, '');
    // Ensure URL has protocol
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }
    let apiUrl = `${baseUrl}/wp-json/wc/v3/orders?`;

    // Add filters
    const params = new URLSearchParams();
    params.append('per_page', '100');
    params.append('orderby', 'date');
    params.append('order', 'desc');

    if (status) {
      params.append('status', status);
    }

    // Date range filter
    const now = new Date();
    let afterDate: Date | null = null;

    switch (dateRange) {
      case 'recent':
        afterDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '3months':
        afterDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6months':
        afterDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case 'year':
        afterDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
    }

    if (afterDate) {
      params.append('after', afterDate.toISOString());
    }

    if (search) {
      params.append('search', search);
    }

    // Make request to WooCommerce API
    const response = await fetch(`${apiUrl}${params.toString()}`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString('base64'),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WooCommerce API error:', errorText);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: response.status });
    }

    const orders = await response.json();

    // Get existing assignments for these orders
    const orderIds = orders.map((o: any) => o.id);
    const { data: assignments } = await supabase
      .from('delivery_assignments')
      .select('order_id, driver_id, delivery_date, time_slot, status')
      .in('order_id', orderIds)
      .eq('store_id', storeId);

    const assignmentMap = new Map(assignments?.map((a: any) => [a.order_id, a]) || []);

    // Enrich orders with assignment info
    const enrichedOrders = orders.map((order: any) => ({
      ...order,
      assignment: assignmentMap.get(order.id) || null,
    }));

    return NextResponse.json({ orders: enrichedOrders });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
