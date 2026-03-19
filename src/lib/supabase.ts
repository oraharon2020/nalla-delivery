import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for database tables
export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: 'admin' | 'driver';
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  store_id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
  email_from?: string;
  email_name?: string;
  is_active: boolean;
  is_default: boolean;
  active_statuses: string[];
  created_at: string;
  updated_at: string;
}

export interface DeliveryAssignment {
  id: string;
  store_id: string;
  store_name?: string;
  order_id: number;
  order_number?: string;
  driver_id?: string;
  delivery_date: string;
  time_slot?: string;
  notes?: string;
  shipping_address?: string;
  phone?: string;
  customer_name?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  sequence: number;
  total_items: number;
  products?: any;
  delivery_cost: number;
  service_type: 'delivery' | 'technician_visit';
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // Joined fields
  driver?: User;
}

export interface DriverStatusSetting {
  id: string;
  driver_id: string;
  store_id: string;
  completion_status?: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

export interface SignedDocument {
  id: string;
  delivery_id: string;
  order_id: number;
  driver_id?: string;
  signature_url?: string;
  document_url?: string;
  photos: string[];
  signed_at: string;
  created_at: string;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  updated_at: string;
  // Joined
  driver?: User;
}

// Helper functions for common queries

export const getStores = async () => {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data as Store[];
};

export const getActiveStores = async () => {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('name');
  
  if (error) throw error;
  return data as Store[];
};

export const getDrivers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'driver')
    .eq('is_active', true)
    .order('display_name');
  
  if (error) throw error;
  return data as User[];
};

export const getDeliveriesByDriver = async (driverId: string, date: string) => {
  const { data, error } = await supabase
    .from('delivery_assignments')
    .select('*, driver:users(*)')
    .eq('driver_id', driverId)
    .eq('delivery_date', date)
    .order('sequence');
  
  if (error) throw error;
  return data as DeliveryAssignment[];
};

export const getDeliveriesByDate = async (date: string, storeId?: string) => {
  let query = supabase
    .from('delivery_assignments')
    .select('*, driver:users(*)')
    .eq('delivery_date', date)
    .order('sequence');
  
  if (storeId) {
    query = query.eq('store_id', storeId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as DeliveryAssignment[];
};

export const getSetting = async (key: string) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error) throw error;
  return data?.value;
};

export const updateSetting = async (key: string, value: any) => {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  
  if (error) throw error;
};

export const createDeliveryAssignment = async (assignment: Partial<DeliveryAssignment>) => {
  const { data, error } = await supabase
    .from('delivery_assignments')
    .insert(assignment)
    .select()
    .single();
  
  if (error) throw error;
  return data as DeliveryAssignment;
};

export const updateDeliveryAssignment = async (id: string, updates: Partial<DeliveryAssignment>) => {
  const { data, error } = await supabase
    .from('delivery_assignments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DeliveryAssignment;
};

export const deleteDeliveryAssignment = async (id: string) => {
  const { error } = await supabase
    .from('delivery_assignments')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Auth helper
export const getUserByEmail = async (email: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error) return null;
  return data as User;
};

export const createUser = async (user: Omit<User, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('users')
    .insert(user)
    .select()
    .single();
  
  if (error) throw error;
  return data as User;
};

export const updateUser = async (id: string, updates: Partial<User>) => {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as User;
};
