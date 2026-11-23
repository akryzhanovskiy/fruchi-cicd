/**
 * Shared HTTP client for the storefront and the admin panel.
 *
 * All requests go to the relative `/api` path: in development Vite proxies it to the
 * backend, in containers nginx does — so built images don't depend on the API URL.
 * Typed endpoint schemas are generated from the backend OpenAPI spec (`npm run generate`).
 */

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body: unknown = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throw new ApiError(response.status, body);
  }
  return body as T;
}

export interface ApiStatus {
  environment: string;
  checks: Record<string, boolean>;
}

export const getApiStatus = () => apiFetch<ApiStatus>('/status');

// --- Catalog ---

export type Illustration = 'apple' | 'pear' | 'banana' | 'orange' | 'lemon' | 'pineapple';

export interface ProductImage {
  url: string;
  alt: string;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  /** Page title for search results, without the site name. */
  meta_title: string;
  meta_description: string;
}

export interface ProductCard {
  slug: string;
  name: string;
  short_desc: string;
  category: string;
  price: number;
  weight_g: number;
  accent_color: string;
  illustration: Illustration | null;
  image: ProductImage | null;
  in_stock: boolean;
  /** Upper bound for the quantity picker (0 when out of stock). */
  max_qty: number;
}

export interface ProductDetail extends ProductCard {
  description: string;
  composition: string;
  nutrition: string;
  storage: string;
  images: ProductImage[];
  /** Page title for search results, without the site name. */
  meta_title: string;
  meta_description: string;
}

export const getCategories = () => apiFetch<Category[]>('/categories');

export const getProducts = (category?: string) =>
  apiFetch<ProductCard[]>(
    category ? `/products?category=${encodeURIComponent(category)}` : '/products',
  );

export const getProduct = (slug: string) =>
  apiFetch<ProductDetail>(`/products/${encodeURIComponent(slug)}`);

// --- Cart & orders ---

export type PaymentMethod = 'cod' | 'card_transfer';

export interface OrderCreate {
  customer_name: string;
  phone: string;
  city: string;
  np_branch: string;
  payment_method: PaymentMethod;
  comment?: string;
  items: { slug: string; qty: number }[];
  /** Honeypot — must stay empty. */
  website?: string;
}

export interface OrderCreated {
  number: string;
  items_total: number;
  payment_method: PaymentMethod;
  items: { name: string; weight_g: number; unit_price: number; qty: number; line_total: number }[];
}

export interface UnavailableItem {
  slug: string;
  name: string | null;
  /** Packs that can still be ordered; 0 — sold out or no longer sold. */
  available: number;
}

/** Body of a 409 response from `createOrder`. */
export interface OutOfStockBody {
  detail: string;
  items: UnavailableItem[];
}

export const validateCart = (slugs: string[]) =>
  apiFetch<ProductCard[]>('/cart/validate', { method: 'POST', body: JSON.stringify({ slugs }) });

export const createOrder = (order: OrderCreate) =>
  apiFetch<OrderCreated>('/orders', { method: 'POST', body: JSON.stringify(order) });
