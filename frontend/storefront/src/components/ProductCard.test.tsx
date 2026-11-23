import { fireEvent, screen } from '@testing-library/react';

import { useCart } from '../store/cart';
import { makeProduct, renderWithProviders } from '../test-utils';
import { ProductCard } from './ProductCard';

beforeEach(() => useCart.getState().clear());

test('adds to cart, then the counter adds and removes packs', () => {
  renderWithProviders(<ProductCard product={makeProduct({ max_qty: 2 })} />);
  fireEvent.click(screen.getByRole('button', { name: /Додати «Яблучні чіпси» в кошик/ }));
  expect(screen.getByLabelText('Кількість: 1')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Додати ще одну пачку' }));
  expect(useCart.getState().items[0].qty).toBe(2);
  expect(screen.getByRole('button', { name: 'Більше немає в наявності' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Прибрати одну пачку' }));
  fireEvent.click(screen.getByRole('button', { name: 'Прибрати одну пачку' }));
  expect(useCart.getState().items).toEqual([]);
  expect(screen.getByRole('button', { name: /в кошик/ })).toBeInTheDocument();
});

test('sold-out product shows badge and disabled button', () => {
  renderWithProviders(<ProductCard product={makeProduct({ in_stock: false, max_qty: 0 })} />);
  expect(screen.getByRole('link', { name: /детальніше/ })).toHaveTextContent('Скінчився');
  expect(screen.getByRole('button', { name: 'Скінчився' })).toBeDisabled();
});
