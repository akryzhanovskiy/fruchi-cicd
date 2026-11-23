import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { mockApi } from './mock-api';

const PAGES = ['/', '/catalog/chips', '/product/apple', '/delivery', '/offer', '/privacy', '/nope'];

for (const path of PAGES) {
  test(`no accessibility violations: ${path}`, async ({ page }) => {
    await mockApi(page);
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(', ')})`),
    ).toEqual([]);
  });
}

test('cart drawer with checkout form is accessible', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Додати «Яблучні чіпси» в кошик' }).click();
  await page
    .getByRole('button', { name: /Кошик, товарів/ })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Оформити замовлення' }).click();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
