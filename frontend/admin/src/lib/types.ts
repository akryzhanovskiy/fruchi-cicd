import type { Illustration, PaymentMethod } from '@fruchi/api-client';

export type Role = 'admin' | 'operator';
export type CatalogStatus = 'active' | 'coming_soon' | 'hidden';
export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'not_required' | 'awaiting' | 'paid';
export type OrderEventType = 'created' | 'status_change' | 'payment' | 'ttn_set' | 'note';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  user: User;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  /** Overrides for search results; empty — generated from the name and description. */
  seo_title: string;
  seo_description: string;
  status: CatalogStatus;
  sort_order: number;
  product_count: number;
}

export type CategoryInput = Omit<Category, 'id' | 'product_count'>;

export interface AdminImage {
  id: number;
  url: string;
  alt: string;
  sort_order: number;
}

export interface Product {
  id: number;
  category_id: number;
  category_name: string;
  slug: string;
  name: string;
  short_desc: string;
  description: string;
  composition: string;
  nutrition: string;
  storage: string;
  seo_title: string;
  seo_description: string;
  accent_color: string;
  illustration: Illustration | null;
  weight_g: number;
  price: number;
  sku: string | null;
  stock_qty: number;
  status: CatalogStatus;
  visible: boolean;
  sort_order: number;
  images: AdminImage[];
  created_at: string;
  updated_at: string;
}

export type ProductInput = Omit<
  Product,
  'id' | 'category_name' | 'status' | 'images' | 'created_at' | 'updated_at'
>;

export interface OrderListItem {
  id: number;
  number: string;
  status: OrderStatus;
  created_at: string;
  customer_name: string;
  phone: string;
  city: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  items_total: number;
  items_count: number;
  ttn: string | null;
}

export interface OrderList {
  items: OrderListItem[];
  total: number;
  page: number;
  page_size: number;
  status_counts: Record<OrderStatus, number>;
}

export interface OrderDetail extends OrderListItem {
  np_branch: string;
  customer_comment: string;
  operator_note: string;
  updated_at: string;
  items: {
    product_id: number | null;
    product_name: string;
    weight_g: number;
    unit_price: number;
    qty: number;
    line_total: number;
  }[];
  events: {
    type: OrderEventType;
    payload: Record<string, string | null>;
    created_at: string;
    user_name: string | null;
  }[];
  next_statuses: OrderStatus[];
}

export interface OrderUpdate {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  ttn?: string;
  operator_note?: string;
}

export interface ShopSettingsInput {
  payment_details: string;
  low_stock_threshold: number;
  telegram_chat_id: string;
  /** Google Analytics 4 measurement id, G-XXXXXXX. */
  ga_measurement_id: string;
  meta_pixel_id: string;
  /** `content` of the Search Console / Bing Webmaster verification meta tags. */
  google_site_verification: string;
  bing_site_verification: string;
}

export interface ShopSettings extends ShopSettingsInput {
  /** Whether TELEGRAM_BOT_TOKEN is set on the server (the token itself is never sent). */
  telegram_bot_configured: boolean;
}

/** Live order event from GET /admin/orders/stream. */
export interface OrderStreamEvent {
  type: 'order_created' | 'order_updated';
  id: number;
  number: string;
}

export interface Dashboard {
  orders_today: number;
  new_orders: number;
  awaiting_payment: number;
  orders_30d: number;
  revenue_30d: number;
  status_counts: Record<OrderStatus, number>;
  low_stock: { id: number; name: string; stock_qty: number }[];
  low_stock_threshold: number;
  /** Last 30 days including today, oldest first; without cancelled/returned orders. */
  daily: { date: string; orders: number; revenue: number }[];
  top_products: { product_id: number | null; name: string; qty: number; revenue: number }[];
}
