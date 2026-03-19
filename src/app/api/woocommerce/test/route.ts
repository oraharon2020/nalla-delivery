import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url, consumer_key, consumer_secret} = await request.json();

    if (!url || !consumer_key || !consumer_secret) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Ensure URL has protocol
    let baseUrl = url.replace(/\/$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }
    
    const credentials = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
    
    // Test connection with system_status endpoint
    const testUrl = `${baseUrl}/wp-json/wc/v3/system_status`;

    console.log('Testing WooCommerce connection to:', testUrl);

    const response = await fetch(testUrl, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    
    // Check if response is HTML (error page)
    if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html') || responseText.startsWith('<?xml')) {
      console.error('WooCommerce returned HTML instead of JSON:', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'כתובת ה-API לא נכונה או שה-REST API לא מופעל באתר. ודא שה-URL מכיל את הפרוטוקול (https://)' },
        { status: 400 }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON:', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'התשובה מהשרת לא תקינה - בדוק את הגדרות ה-API' },
        { status: 400 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || `Connection failed: ${response.status}` },
        { status: response.status }
      );
    }

    // Fetch all order statuses including custom ones
    let statuses: Array<{value: string; label: string}> = [];
    try {
      const statusesUrl = `${baseUrl}/wp-json/wc/v3/reports/orders/totals`;
      const statusesResponse = await fetch(statusesUrl, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      });
      
      const statusesText = await statusesResponse.text();
      if (!statusesText.startsWith('<!DOCTYPE') && !statusesText.startsWith('<html')) {
        const statusesData = JSON.parse(statusesText);
        if (Array.isArray(statusesData)) {
          statuses = statusesData.map((s: any) => ({
            value: s.slug?.replace('wc-', '') || s.slug,
            label: s.name || s.slug,
          }));
        }
      }
    } catch (e) {
      console.error('Failed to fetch statuses:', e);
      // Use default statuses if we can't fetch custom ones
      statuses = [
        { value: 'pending', label: 'ממתין לתשלום' },
        { value: 'processing', label: 'בטיפול' },
        { value: 'on-hold', label: 'בהמתנה' },
        { value: 'completed', label: 'הושלם' },
        { value: 'cancelled', label: 'בוטל' },
        { value: 'refunded', label: 'הוחזר' },
        { value: 'failed', label: 'נכשל' },
      ];
    }

    return NextResponse.json({
      success: true,
      store_info: {
        wp_version: data.environment?.wp_version,
        wc_version: data.environment?.version,
        currency: data.settings?.currency,
      },
      statuses,
    });
  } catch (error: any) {
    console.error('WooCommerce test error:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בבדיקת החיבור' },
      { status: 500 }
    );
  }
}
