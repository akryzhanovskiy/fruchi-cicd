import type { ProductCard, UnavailableItem } from '@fruchi/api-client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { trackAddToCart } from '../lib/analytics';

export interface CartItem {
  slug: string;
  name: string;
  price: number;
  weight_g: number;
  accent_color: string;
  illustration: ProductCard['illustration'];
  imageUrl: string | null;
  /** How many packs can be ordered; 0 — the product is sold out or no longer sold. */
  maxQty: number;
  qty: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Adds `qty` packs, never exceeding the product's max quantity. */
  add: (product: ProductCard, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  /** Refreshes prices and availability from the API; products no longer sold become unavailable. */
  sync: (cards: ProductCard[]) => void;
  /** Applies availability reported by the API when an order was rejected. */
  applyUnavailable: (items: UnavailableItem[]) => void;
}

const clamp = (qty: number, max: number) => Math.max(0, Math.min(qty, max));

const fromCard = (product: ProductCard, qty: number): CartItem => ({
  slug: product.slug,
  name: product.name,
  price: product.price,
  weight_g: product.weight_g,
  accent_color: product.accent_color,
  illustration: product.illustration,
  imageUrl: product.image?.url ?? null,
  maxQty: product.in_stock ? product.max_qty : 0,
  qty,
});

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      add: (product, qty = 1) =>
        set((state) => {
          if (!product.in_stock) return state;
          const existing = state.items.find((i) => i.slug === product.slug);
          const item = fromCard(product, clamp((existing?.qty ?? 0) + qty, product.max_qty));
          const added = item.qty - (existing?.qty ?? 0);
          if (added > 0) {
            trackAddToCart({
              slug: product.slug,
              name: product.name,
              price: product.price,
              qty: added,
            });
          }
          return {
            items: existing
              ? state.items.map((i) => (i.slug === product.slug ? item : i))
              : [...state.items, item],
          };
        }),
      setQty: (slug, qty) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.slug === slug ? { ...i, qty: clamp(qty, i.maxQty) } : i))
            .filter((i) => i.qty > 0),
        })),
      remove: (slug) => set((state) => ({ items: state.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
      sync: (cards) =>
        set((state) => {
          const bySlug = new Map(cards.map((c) => [c.slug, c]));
          return {
            items: state.items.map((item) => {
              const card = bySlug.get(item.slug);
              return card ? fromCard(card, item.qty) : { ...item, maxQty: 0 };
            }),
          };
        }),
      applyUnavailable: (unavailable) =>
        set((state) => {
          const bySlug = new Map(unavailable.map((u) => [u.slug, u.available]));
          return {
            items: state.items.map((item) =>
              bySlug.has(item.slug) ? { ...item, maxQty: bySlug.get(item.slug)! } : item,
            ),
          };
        }),
    }),
    {
      name: 'fruchi-cart',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // The drawer always starts closed.
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export const useCartCount = () => useCart((s) => s.items.reduce((sum, i) => sum + i.qty, 0));

export const useCartQty = (slug: string) =>
  useCart((s) => s.items.find((i) => i.slug === slug)?.qty ?? 0);

/** Item can't be ordered as is: sold out, or more packs than available. */
export const isProblem = (item: CartItem) => item.maxQty === 0 || item.qty > item.maxQty;

export const cartTotal = (items: CartItem[]) =>
  items.filter((i) => !isProblem(i)).reduce((sum, i) => sum + i.price * i.qty, 0);
