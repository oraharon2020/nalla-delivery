import { StoreId } from './config';
import { supabase } from './supabase';
import { WCOrder, WCNote, ApiResponse } from '@/types';

interface StoreConfig {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  name: string;
}

// Store cache to avoid repeated Supabase queries
const storeCache = new Map<string, StoreConfig>();

async function resolveStoreConfig(storeId: StoreId): Promise<StoreConfig> {
  // Check cache first
  const cached = storeCache.get(storeId);
  if (cached) return cached;

  // Resolve from Supabase stores table (admin settings)
  const { data: store, error } = await supabase
    .from('stores')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (store) {
    const cfg: StoreConfig = {
      url: store.url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      name: store.name,
    };
    storeCache.set(storeId, cfg);
    console.log(`[WC] Store "${storeId}" loaded: ${store.url}`);
    return cfg;
  }

  console.error(`[WC] Store "${storeId}" not found in settings.`, error);
  throw new Error(`חנות "${storeId}" לא נמצאה בהגדרות`);
}

export class WooCommerceAPI {
  private storeId: StoreId;
  private baseUrl: string = '';
  private auth: string = '';
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(storeId: StoreId) {
    this.storeId = storeId;
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      const storeConfig = await resolveStoreConfig(this.storeId);
      this.baseUrl = `${storeConfig.url}/wp-json/wc/v3`;
      this.auth = Buffer.from(
        `${storeConfig.consumerKey}:${storeConfig.consumerSecret}`
      ).toString('base64');
      this.initialized = true;
    })();
    
    return this.initPromise;
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    data?: unknown
  ): Promise<T> {
    await this.ensureInitialized();
    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WooCommerce API Error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async getOrder(orderId: string): Promise<WCOrder> {
    return this.request<WCOrder>(`/orders/${orderId}`);
  }

  async getOrderWithNotes(orderId: string): Promise<WCOrder> {
    const order = await this.getOrder(orderId);
    const notes = await this.getOrderNotes(orderId);
    return { ...order, notes };
  }

  async getOrderNotes(orderId: string): Promise<WCNote[]> {
    return this.request<WCNote[]>(`/orders/${orderId}/notes`);
  }

  async addOrderNote(
    orderId: string,
    note: string,
    customerNote: boolean = false
  ): Promise<WCNote> {
    return this.request<WCNote>(`/orders/${orderId}/notes`, 'POST', {
      note,
      customer_note: customerNote,
    });
  }

  async updateOrderStatus(orderId: string, status: string): Promise<WCOrder> {
    return this.request<WCOrder>(`/orders/${orderId}`, 'PUT', { status });
  }

  async getOrders(params: { status?: string; per_page?: number } = {}): Promise<WCOrder[]> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.set('status', params.status);
    if (params.per_page) queryParams.set('per_page', params.per_page.toString());

    const queryString = queryParams.toString();
    const endpoint = `/orders${queryString ? `?${queryString}` : ''}`;
    return this.request<WCOrder[]>(endpoint);
  }

  async getOrderStatuses(): Promise<Array<{ slug: string; name: string; total: number }>> {
    return this.request<Array<{ slug: string; name: string; total: number }>>(
      '/reports/orders/totals'
    );
  }
}

export function createWooCommerceAPI(storeId: StoreId): WooCommerceAPI {
  return new WooCommerceAPI(storeId);
}
