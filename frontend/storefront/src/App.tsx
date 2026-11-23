import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { Layout } from './components/Layout';
import { CatalogPage } from './pages/CatalogPage';
import { HomePage } from './pages/HomePage';
import { DeliveryPage } from './pages/info/DeliveryPage';
import { OfferPage } from './pages/info/OfferPage';
import { PrivacyPage } from './pages/info/PrivacyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { ProductPage } from './pages/ProductPage';

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'catalog/:category', element: <CatalogPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'delivery', element: <DeliveryPage /> },
      { path: 'offer', element: <OfferPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'order/:number', element: <OrderSuccessPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
