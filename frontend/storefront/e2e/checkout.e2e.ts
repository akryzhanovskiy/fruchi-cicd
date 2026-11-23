import { expect, test } from '@playwright/test';

import { mockApi } from './mock-api';

test('catalog → cart → checkout → thank-you page', async ({ page }) => {
  const orders = await mockApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Додати «Яблучні чіпси» в кошик' }).click();
  await page.getByRole('button', { name: 'Додати ще одну пачку' }).click();
  await expect(page.getByLabel('Кількість: 2')).toBeVisible();

  await page
    .getByRole('button', { name: /Кошик, товарів: 2/ })
    .first()
    .click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Яблучні чіпси')).toBeVisible();
  await drawer.getByRole('button', { name: 'Оформити замовлення' }).click();

  await drawer.getByLabel('Ім’я та прізвище').fill('Олена Петренко');
  await drawer.getByLabel('Телефон').fill('0671234567');
  await drawer.getByLabel('Місто').fill('Київ');
  await drawer.getByLabel('Відділення або поштомат').fill('Відділення 12');
  await drawer.getByText('На картку').first().click();
  await drawer.getByRole('button', { name: 'Підтвердити замовлення' }).click();

  await expect(page.getByRole('heading', { name: 'Дякуємо за замовлення!' })).toBeVisible();
  await expect(page.getByText('FR-000042')).toBeVisible();
  expect(orders).toEqual([
    expect.objectContaining({
      customer_name: 'Олена Петренко',
      payment_method: 'card_transfer',
      items: [{ slug: 'apple', qty: 2 }],
    }),
  ]);
});

test('product page: added state resets when the item is removed from the cart', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/product/pear');
  await page.getByRole('button', { name: /Додати в кошик|У кошик/ }).click();
  await page.getByRole('button', { name: /Додано до кошика|Перейти в кошик/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Видалити «Грушеві чіпси»' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Додати в кошик|У кошик/ })).toBeEnabled();
});
