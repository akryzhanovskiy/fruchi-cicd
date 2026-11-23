import {
  Badge,
  Card,
  Group,
  Pagination,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { OrderStatusBadge, PaymentBadge } from '../components/StatusBadges';
import { api } from '../lib/api';
import {
  formatDateTime,
  formatMoney,
  formatPhone,
  ORDER_STATUS,
  PAYMENT_STATUS,
} from '../lib/labels';
import type { OrderStatus } from '../lib/types';

const PAGE_SIZE = 20;
const STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[];

export function OrdersPage() {
  const navigate = useNavigate();
  // Filters live in the URL so the list survives opening an order and coming back.
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const payment = params.get('payment_status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [debouncedSearch] = useDebouncedValue(search, 350);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedSearch !== q) update({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to typing only
  }, [debouncedSearch]);

  const orders = useQuery({
    queryKey: ['orders', status, payment, q, page],
    queryFn: () =>
      api.orders({
        status,
        payment_status: payment,
        q,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const counts = orders.data?.status_counts;

  return (
    <Stack>
      <Title order={2}>Замовлення</Title>
      <Card withBorder padding={0}>
        <Tabs value={status || 'all'} onChange={(v) => update({ status: v === 'all' ? '' : v! })}>
          <Tabs.List px="sm">
            <Tabs.Tab value="all">Усі</Tabs.Tab>
            {STATUSES.map((s) => (
              <Tabs.Tab
                key={s}
                value={s}
                rightSection={
                  counts?.[s] ? (
                    <Badge
                      size="xs"
                      variant={s === 'new' ? 'filled' : 'light'}
                      color={ORDER_STATUS[s].color}
                    >
                      {counts[s]}
                    </Badge>
                  ) : null
                }
              >
                {ORDER_STATUS[s].label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        <Group p="sm" gap="sm">
          <TextInput
            placeholder="Номер, ім’я або телефон"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={280}
          />
          <Select
            placeholder="Оплата"
            clearable
            value={payment || null}
            onChange={(v) => update({ payment_status: v ?? '' })}
            data={Object.entries(PAYMENT_STATUS).map(([value, { label }]) => ({ value, label }))}
            w={200}
          />
        </Group>
        <Table.ScrollContainer minWidth={820}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Номер</Table.Th>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Клієнт</Table.Th>
                <Table.Th>Місто</Table.Th>
                <Table.Th>Сума</Table.Th>
                <Table.Th>Оплата</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orders.data?.items.map((order) => (
                <Table.Tr
                  key={order.id}
                  style={{ cursor: 'pointer' }}
                  fw={order.status === 'new' ? 700 : undefined}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <Table.Td>{order.number}</Table.Td>
                  <Table.Td>{formatDateTime(order.created_at)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" fw="inherit">
                      {order.customer_name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatPhone(order.phone)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{order.city}</Table.Td>
                  <Table.Td>
                    {formatMoney(order.items_total)}
                    <Text size="xs" c="dimmed">
                      {order.items_count} шт.
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <PaymentBadge status={order.payment_status} />
                  </Table.Td>
                  <Table.Td>
                    <OrderStatusBadge status={order.status} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {orders.data && orders.data.items.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Замовлень не знайдено
          </Text>
        )}
        {orders.data && orders.data.total > PAGE_SIZE && (
          <Group justify="center" p="sm">
            <Pagination
              total={Math.ceil(orders.data.total / PAGE_SIZE)}
              value={page}
              onChange={(p) => update({ page: String(p) })}
            />
          </Group>
        )}
      </Card>
    </Stack>
  );
}
