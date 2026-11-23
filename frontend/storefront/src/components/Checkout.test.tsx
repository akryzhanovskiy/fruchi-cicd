import { fireEvent, screen, waitFor } from '@testing-library/react';

import { useCart } from '../store/cart';
import { makeProduct, renderWithProviders } from '../test-utils';
import { Checkout } from './Checkout';

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  useCart.getState().clear();
  useCart.getState().add(makeProduct(), 2);
});

test('shows validation errors and does not submit an incomplete form', () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  renderWithProviders(<Checkout onStockConflict={() => {}} />);

  fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));

  expect(screen.getByText('Вкажіть ім’я та прізвище')).toBeInTheDocument();
  expect(screen.getByText(/Вкажіть номер повністю/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('submits the order and clears the cart', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ number: 'FR-000007', items_total: 178, payment_method: 'cod', items: [] }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
  vi.stubGlobal('fetch', fetchMock);
  renderWithProviders(<Checkout onStockConflict={() => {}} />);

  fill('Ім’я та прізвище', 'Олена Петренко');
  fill('Телефон', '0671234567');
  fill('Місто', 'Київ');
  fill('Відділення або поштомат', '12');
  expect(screen.getByLabelText('Телефон')).toHaveValue('+380 67 123 45 67');
  fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));

  await waitFor(() => expect(useCart.getState().items).toEqual([]));
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body).toMatchObject({
    customer_name: 'Олена Петренко',
    phone: '+380 67 123 45 67',
    payment_method: 'cod',
    items: [{ slug: 'apple', qty: 2 }],
  });
});

test('stock conflict updates the cart and returns to it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: 'x',
          items: [{ slug: 'apple', name: 'Яблучні', available: 1 }],
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    ),
  );
  const onConflict = vi.fn();
  renderWithProviders(<Checkout onStockConflict={onConflict} />);
  fill('Ім’я та прізвище', 'Олена');
  fill('Телефон', '0671234567');
  fill('Місто', 'Київ');
  fill('Відділення або поштомат', '12');
  fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));

  await waitFor(() => expect(onConflict).toHaveBeenCalled());
  expect(useCart.getState().items[0].maxQty).toBe(1);
});
