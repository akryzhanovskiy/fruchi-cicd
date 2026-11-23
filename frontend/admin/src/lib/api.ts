import { API_BASE, ApiError } from '@fruchi/api-client';

import type {
  Category,
  CategoryInput,
  Dashboard,
  OrderDetail,
  OrderList,
  OrderUpdate,
  Product,
  ProductInput,
  ShopSettings,
  ShopSettingsInput,
  TokenResponse,
  User,
} from './types';

/**
 * Admin API client.
 *
 * The access token lives only in memory; the refresh token is an httpOnly cookie the
 * browser sends to /admin/auth/refresh. On a 401 the client refreshes once and retries.
 */
let accessToken: string | null = null;
let refreshing: Promise<TokenResponse | null> | null = null;
let onSessionExpired: () => void = () => {};

export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

async function parse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  return response.headers.get('content-type')?.includes('application/json')
    ? response.json()
    : response.text();
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  return fetch(`${API_BASE}/admin${path}`, { ...init, headers, credentials: 'same-origin' });
}

/** Exchanges the refresh cookie for a new access token; one request at a time. */
export function refreshSession(): Promise<TokenResponse | null> {
  refreshing ??= rawFetch('/auth/refresh', { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) return null;
      const body = (await response.json()) as TokenResponse;
      accessToken = body.access_token;
      return body;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await rawFetch(path, init);
  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      response = await rawFetch(path, init);
    } else {
      accessToken = null;
      onSessionExpired();
    }
  }
  const body = await parse(response);
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}

/**
 * Opens a streaming GET (Server-Sent Events). EventSource can't send the Authorization
 * header, so this is a plain fetch whose body the caller reads as a stream.
 */
export async function openStream(path: string, signal: AbortSignal): Promise<Response> {
  const init: RequestInit = { signal, headers: { Accept: 'text/event-stream' } };
  let response = await rawFetch(path, init);
  if (response.status === 401 && (await refreshSession())) {
    response = await rawFetch(path, init);
  }
  if (!response.ok || !response.body) throw new ApiError(response.status, null);
  return response;
}

/** Human-readable message from an API error (FastAPI `detail`). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = (error.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return 'Перевірте правильність заповнення полів';
    return `Помилка сервера (${error.status})`;
  }
  return 'Немає з’єднання з сервером';
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

const query = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const api = {
  login: async (email: string, password: string) => {
    const body = await adminFetch<TokenResponse>('/auth/login', json('POST', { email, password }));
    accessToken = body.access_token;
    return body;
  },
  logout: async () => {
    accessToken = null;
    await rawFetch('/auth/logout', { method: 'POST' });
  },

  dashboard: () => adminFetch<Dashboard>('/dashboard'),

  orders: (params: Record<string, string | number | undefined>) =>
    adminFetch<OrderList>(`/orders${query(params)}`),
  order: (id: number) => adminFetch<OrderDetail>(`/orders/${id}`),
  updateOrder: (id: number, data: OrderUpdate) =>
    adminFetch<OrderDetail>(`/orders/${id}`, json('PATCH', data)),

  categories: () => adminFetch<Category[]>('/categories'),
  createCategory: (data: CategoryInput) => adminFetch<Category>('/categories', json('POST', data)),
  updateCategory: (id: number, data: CategoryInput) =>
    adminFetch<Category>(`/categories/${id}`, json('PUT', data)),
  deleteCategory: (id: number) => adminFetch<null>(`/categories/${id}`, { method: 'DELETE' }),

  products: (params: Record<string, string | number | undefined> = {}) =>
    adminFetch<Product[]>(`/products${query(params)}`),
  product: (id: number) => adminFetch<Product>(`/products/${id}`),
  createProduct: (data: ProductInput) => adminFetch<Product>('/products', json('POST', data)),
  updateProduct: (id: number, data: ProductInput) =>
    adminFetch<Product>(`/products/${id}`, json('PUT', data)),
  deleteProduct: (id: number) => adminFetch<null>(`/products/${id}`, { method: 'DELETE' }),
  uploadImage: (id: number, file: File, alt = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('alt', alt);
    return adminFetch<Product>(`/products/${id}/images`, { method: 'POST', body: form });
  },
  updateImage: (id: number, imageId: number, alt: string) =>
    adminFetch<Product>(`/products/${id}/images/${imageId}`, json('PATCH', { alt })),
  deleteImage: (id: number, imageId: number) =>
    adminFetch<Product>(`/products/${id}/images/${imageId}`, { method: 'DELETE' }),
  reorderImages: (id: number, ids: number[]) =>
    adminFetch<Product>(`/products/${id}/images/order`, json('PUT', { ids })),

  users: () => adminFetch<User[]>('/users'),
  createUser: (data: { email: string; name: string; password: string; role: User['role'] }) =>
    adminFetch<User>('/users', json('POST', data)),
  updateUser: (
    id: number,
    data: Partial<{ name: string; role: User['role']; is_active: boolean; password: string }>,
  ) => adminFetch<User>(`/users/${id}`, json('PATCH', data)),

  settings: () => adminFetch<ShopSettings>('/settings'),
  updateSettings: (data: Partial<ShopSettingsInput>) =>
    adminFetch<ShopSettings>('/settings', json('PATCH', data)),
  testTelegram: (chatId?: string) =>
    adminFetch<null>('/settings/telegram/test', json('POST', { chat_id: chatId || null })),
};
