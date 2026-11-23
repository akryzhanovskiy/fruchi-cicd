/**
 * Google Analytics 4 and Meta (Facebook / Instagram) Pixel.
 *
 * The ids are set in the admin panel (Налаштування → Аналітика) and come with the
 * server-rendered page as `window.__FRUCHI_ANALYTICS__`; without them nothing is loaded.
 * Events follow the GA4 e-commerce and Pixel standard names, so reports and ad
 * optimisation (purchases) work without extra setup.
 */

interface AnalyticsConfig {
  ga?: string;
  pixel?: string;
}

export interface TrackedItem {
  slug: string;
  name: string;
  price: number;
  qty: number;
}

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    __FRUCHI_ANALYTICS__?: AnalyticsConfig;
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const CURRENCY = 'UAH';
let config: AnalyticsConfig = {};

function loadScript(src: string) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** Loads the trackers configured for the site. Safe to call more than once. */
export function initAnalytics(cfg: AnalyticsConfig | undefined = window.__FRUCHI_ANALYTICS__) {
  if (!cfg || window.gtag || window.fbq) return;
  config = cfg;
  if (cfg.ga) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // gtag.js expects the `arguments` object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    // Page views are sent by trackPageView on every route change.
    window.gtag('config', cfg.ga, { send_page_view: false });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga)}`);
  }
  if (cfg.pixel) {
    // Standard Meta Pixel bootstrap: queue calls until fbevents.js loads.
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }) as Fbq;
    fbq.queue = [];
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = fbq;
    window._fbq = fbq;
    fbq('init', cfg.pixel);
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
  }
}

function ga(event: string, params: Record<string, unknown>) {
  if (config.ga && window.gtag) window.gtag('event', event, params);
}

function pixel(event: string, params?: Record<string, unknown>) {
  if (config.pixel && window.fbq) window.fbq('track', event, params);
}

const gaItems = (items: TrackedItem[]) =>
  items.map((i) => ({ item_id: i.slug, item_name: i.name, price: i.price, quantity: i.qty }));

const total = (items: TrackedItem[]) =>
  Math.round(items.reduce((sum, i) => sum + i.price * i.qty, 0) * 100) / 100;

const pixelParams = (items: TrackedItem[], value = total(items)) => ({
  content_ids: items.map((i) => i.slug),
  content_type: 'product',
  contents: items.map((i) => ({ id: i.slug, quantity: i.qty })),
  num_items: items.reduce((sum, i) => sum + i.qty, 0),
  value,
  currency: CURRENCY,
});

export function trackPageView(path: string) {
  ga('page_view', { page_location: window.location.origin + path, page_title: document.title });
  pixel('PageView');
}

export function trackViewItem(item: Omit<TrackedItem, 'qty'>) {
  const items = [{ ...item, qty: 1 }];
  ga('view_item', { currency: CURRENCY, value: item.price, items: gaItems(items) });
  pixel('ViewContent', pixelParams(items));
}

export function trackAddToCart(item: TrackedItem) {
  const items = [item];
  ga('add_to_cart', { currency: CURRENCY, value: total(items), items: gaItems(items) });
  pixel('AddToCart', pixelParams(items));
}

export function trackBeginCheckout(items: TrackedItem[]) {
  ga('begin_checkout', { currency: CURRENCY, value: total(items), items: gaItems(items) });
  pixel('InitiateCheckout', pixelParams(items));
}

export function trackPurchase(orderNumber: string, value: number, items: TrackedItem[]) {
  ga('purchase', {
    transaction_id: orderNumber,
    currency: CURRENCY,
    value,
    items: gaItems(items),
  });
  pixel('Purchase', pixelParams(items, value));
}

/** For tests. */
export function resetAnalytics() {
  config = {};
  delete window.gtag;
  delete window.fbq;
  delete window._fbq;
  delete window.dataLayer;
}
