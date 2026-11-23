import { Badge } from '@mantine/core';

import { CATALOG_STATUS, ORDER_STATUS, PAYMENT_STATUS } from '../lib/labels';
import type { CatalogStatus, OrderStatus, PaymentStatus } from '../lib/types';

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Badge color={ORDER_STATUS[status].color} variant="light">
    {ORDER_STATUS[status].label}
  </Badge>
);

export const PaymentBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge color={PAYMENT_STATUS[status].color} variant="dot">
    {PAYMENT_STATUS[status].label}
  </Badge>
);

export const CatalogStatusBadge = ({ status }: { status: CatalogStatus }) => (
  <Badge color={CATALOG_STATUS[status].color} variant="light">
    {CATALOG_STATUS[status].label}
  </Badge>
);
