import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useCart } from '../store/cart';
import { makeProduct } from '../test-utils';
import { ProductPage } from './ProductPage';

const product = {
  ...makeProduct(),
  description: 'Опис',
  composition: 'Яблука',
  nutrition: '',
  storage: '',
  images: [],
};

beforeEach(() => {
  useCart.getState().clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => Response.json(url.includes('/products?') ? [product] : product)),
  );
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/product/apple']}>
        <Routes>
          <Route path="/product/:slug" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('"Додано до кошика" turns back into "Додати в кошик" when the item leaves the cart', async () => {
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /Додати в кошик/ }));
  expect(useCart.getState().items[0].qty).toBe(1);

  const added = screen.getByRole('button', { name: /Додано до кошика/ });
  fireEvent.click(added);
  expect(useCart.getState().isOpen).toBe(true);

  act(() => useCart.getState().remove('apple'));
  expect(screen.queryByRole('button', { name: /Додано до кошика/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Додати в кошик/ })).toBeEnabled();
});
