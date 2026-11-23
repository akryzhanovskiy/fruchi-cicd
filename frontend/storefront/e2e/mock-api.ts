import type { Page } from '@playwright/test';

const product = (slug: string, name: string, illustration: string, extra = {}) => ({
  slug,
  name,
  short_desc: 'Хрусткі скибочки без цукру',
  category: 'chips',
  price: 89,
  weight_g: 100,
  accent_color: '#F7DCD3',
  illustration,
  image: null,
  in_stock: true,
  max_qty: 5,
  ...extra,
});

export const PRODUCTS = [
  product('apple', 'Яблучні чіпси', 'apple'),
  product('pear', 'Грушеві чіпси', 'pear'),
  product('banana', 'Бананові чіпси', 'banana', { in_stock: false, max_qty: 0 }),
];

const detail = (p: (typeof PRODUCTS)[number]) => ({
  ...p,
  description: `${p.name}: тонкі скибочки, висушені до хрусту.`,
  composition: 'Фрукти — 100%.',
  nutrition: 'Енергетична цінність 340 ккал на 100 г.',
  storage: 'У сухому місці за кімнатної температури.',
  images: [],
  meta_title: `${p.name} — купити`,
  meta_description: `${p.name}: тонкі скибочки.`,
});

/** Answers storefront API calls from fixtures; returns the created orders for assertions. */
export async function mockApi(page: Page) {
  const orders: unknown[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });

    if (path === '/categories') {
      return json([
        {
          slug: 'chips',
          name: 'Фруктові чіпси',
          description: 'Сушені фрукти.',
          meta_title: 'Фруктові чіпси — купити',
          meta_description: 'Сушені фрукти.',
        },
      ]);
    }
    if (path === '/products') return json(PRODUCTS);
    if (path.startsWith('/products/')) {
      const found = PRODUCTS.find((p) => p.slug === path.split('/')[2]);
      return found ? json(detail(found)) : json({ detail: 'Товар не знайдено' }, 404);
    }
    if (path === '/cart/validate') {
      const { slugs } = route.request().postDataJSON() as { slugs: string[] };
      return json(PRODUCTS.filter((p) => slugs.includes(p.slug)));
    }
    if (path === '/orders') {
      const body = route.request().postDataJSON();
      orders.push(body);
      const items = body.items.map((i: { slug: string; qty: number }) => ({
        name: PRODUCTS.find((p) => p.slug === i.slug)!.name,
        weight_g: 100,
        unit_price: 89,
        qty: i.qty,
        line_total: 89 * i.qty,
      }));
      return json(
        {
          number: 'FR-000042',
          payment_method: body.payment_method,
          items_total: items.reduce((s: number, i: { line_total: number }) => s + i.line_total, 0),
          items,
        },
        201,
      );
    }
    return json({ detail: 'Not mocked' }, 404);
  });
  return orders;
}
