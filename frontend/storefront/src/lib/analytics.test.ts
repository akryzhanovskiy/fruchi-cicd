import { afterEach, describe, expect, it } from 'vitest';

import {
  initAnalytics,
  resetAnalytics,
  trackAddToCart,
  trackPageView,
  trackPurchase,
} from './analytics';

const apple = { slug: 'apple', name: 'Яблуко', price: 89, qty: 2 };

afterEach(() => {
  resetAnalytics();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

describe('analytics', () => {
  it('does nothing without configured ids', () => {
    initAnalytics(undefined);
    trackPageView('/');
    expect(window.gtag).toBeUndefined();
    expect(window.fbq).toBeUndefined();
    expect(document.head.querySelector('script')).toBeNull();
  });

  it('loads GA4 and sends e-commerce events', () => {
    initAnalytics({ ga: 'G-TEST1' });
    expect(document.head.querySelector('script')?.src).toContain('gtag/js?id=G-TEST1');

    trackAddToCart(apple);
    trackPurchase('F-1001', 178, [apple]);
    const events = window.dataLayer!.map((args) => Array.from(args as ArrayLike<unknown>));
    expect(events).toContainEqual(['config', 'G-TEST1', { send_page_view: false }]);
    expect(events).toContainEqual([
      'event',
      'add_to_cart',
      {
        currency: 'UAH',
        value: 178,
        items: [{ item_id: 'apple', item_name: 'Яблуко', price: 89, quantity: 2 }],
      },
    ]);
    expect(events).toContainEqual([
      'event',
      'purchase',
      expect.objectContaining({ transaction_id: 'F-1001', value: 178, currency: 'UAH' }),
    ]);
  });

  it('queues Meta Pixel events until the script loads', () => {
    initAnalytics({ pixel: '1234567890' });
    trackPageView('/product/apple');
    trackPurchase('F-1001', 178, [apple]);
    expect(window.fbq!.queue).toEqual([
      ['init', '1234567890'],
      ['track', 'PageView', undefined],
      [
        'track',
        'Purchase',
        expect.objectContaining({ value: 178, currency: 'UAH', content_ids: ['apple'] }),
      ],
    ]);
  });
});
