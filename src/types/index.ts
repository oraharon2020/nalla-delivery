// WooCommerce Types
export interface WCOrder {
  id: number;
  number: string;
  status: string;
  date_created: string;
  date_modified: string;
  total: string;
  billing: WCBilling;
  shipping: WCShipping;
  line_items: WCLineItem[];
  customer_note: string;
  notes?: WCNote[];
}

export interface WCBilling {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
}

export interface WCShipping {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface WCLineItem {
  id: number;
  name: string;
  product_id: number;
  quantity: number;
  total: string;
  image?: {
    src: string;
  };
}

export interface WCNote {
  id: number;
  date_created: string;
  note: string;
  customer_note: boolean;
}

// Delivery Types
export interface Delivery {
  id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  order_number: string;
  shipping_address: string;
  phone: string;
  time_slot: string;
  customer_name: string;
  status: string;
  total_items: number;
  products: DeliveryProduct[];
  notes?: string;
  delivery_cost?: number;
  service_type?: string;
  completed_at?: string | null;
}

export interface DeliveryProduct {
  name: string;
  quantity: number;
}

// User Types
export interface User {
  id: number;
  username: string;
  email?: string;
}

export interface JWTPayload {
  user_id: string;
  username: string;
  exp: number;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  username?: string;
  message?: string;
}

// Store Types
export interface StoreInfo {
  id: string;
  name: string;
}

export interface StatusConfig {
  label: string;
  enabled: boolean;
  count?: number;
}

export interface AllowedStatuses {
  [key: string]: StatusConfig;
}

// Upload Types
export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  fileId?: string;
  message?: string;
}

export interface UploadedFile {
  name: string;
  url: string;
}

// Form Types
export interface DeliveryFormData {
  customerName: string;
  phone: string;
  address: string;
  products: WCLineItem[];
  signature: string;
  orderId: string;
  storeId: string;
}

export interface RepairFormData {
  customerName: string;
  phone: string;
  address: string;
  repairDescription: string;
  signature: string;
  orderId: string;
  storeId: string;
}
