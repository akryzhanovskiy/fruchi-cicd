import type { PaymentMethod } from '@fruchi/api-client';

import type { CatalogStatus, OrderStatus, PaymentStatus, Role } from './types';

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: 'Нове', color: 'red' },
  confirmed: { label: 'Підтверджене', color: 'blue' },
  shipped: { label: 'Відправлене', color: 'violet' },
  delivered: { label: 'Отримане', color: 'green' },
  cancelled: { label: 'Скасоване', color: 'gray' },
  returned: { label: 'Повернення', color: 'orange' },
};

/** Button captions for moving an order to a status. */
export const ORDER_ACTION: Record<OrderStatus, string> = {
  new: 'Нове',
  confirmed: 'Підтвердити',
  shipped: 'Відправлено',
  delivered: 'Отримано',
  cancelled: 'Скасувати',
  returned: 'Повернення',
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cod: 'При отриманні',
  card_transfer: 'На картку',
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; color: string }> = {
  not_required: { label: 'Накладений платіж', color: 'gray' },
  awaiting: { label: 'Очікує оплати', color: 'yellow' },
  paid: { label: 'Оплачено', color: 'green' },
};

export const CATALOG_STATUS: Record<CatalogStatus, { label: string; color: string }> = {
  active: { label: 'У продажу', color: 'green' },
  coming_soon: { label: 'Скінчився', color: 'orange' },
  hidden: { label: 'Приховано', color: 'gray' },
};

export const ROLE: Record<Role, string> = { admin: 'Адміністратор', operator: 'Оператор' };

const money = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
export const formatMoney = (value: number) => `${money.format(value)} ₴`;

const dateTime = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** +380671234567 → +380 67 123 45 67 */
export const formatPhone = (phone: string) =>
  phone.replace(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/, '+380 $1 $2 $3 $4');
