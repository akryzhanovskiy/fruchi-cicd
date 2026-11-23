import {
  Anchor,
  Badge,
  Card,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { DailyChart } from '../components/DailyChart';
import { api } from '../lib/api';
import { formatMoney, ORDER_STATUS } from '../lib/labels';
import type { OrderStatus } from '../lib/types';

function Stat({
  label,
  value,
  to,
  accent,
}: {
  label: string;
  value: string | number;
  to?: string;
  accent?: boolean;
}) {
  const content = (
    <Card withBorder>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fz={30} fw={800} c={accent ? 'apple.6' : undefined}>
        {value}
      </Text>
    </Card>
  );
  return to ? (
    <Anchor component={Link} to={to} underline="never" c="inherit">
      {content}
    </Anchor>
  ) : (
    content
  );
}

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    refetchInterval: 30_000,
  });
  const d = dashboard.data;

  return (
    <Stack>
      <Title order={2}>Дашборд</Title>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Stat
          label="Нові замовлення"
          value={d?.new_orders ?? '…'}
          to="/orders?status=new"
          accent={!!d?.new_orders}
        />
        <Stat label="Сьогодні" value={d?.orders_today ?? '…'} />
        <Stat
          label="Очікують оплати"
          value={d?.awaiting_payment ?? '…'}
          to="/orders?payment_status=awaiting"
        />
        <Stat label="Виручка за 30 днів" value={d ? formatMoney(d.revenue_30d) : '…'} />
      </SimpleGrid>
      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder h="100%">
            {d && <DailyChart daily={d.daily} />}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder h="100%">
            <Title order={4} mb="sm">
              Топ товарів за 30 днів
            </Title>
            {d?.top_products.length === 0 ? (
              <Text c="dimmed">Ще немає продажів</Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Товар</Table.Th>
                    <Table.Th ta="right">Пачок</Table.Th>
                    <Table.Th ta="right">Сума</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {d?.top_products.map((p) => (
                    <Table.Tr key={p.product_id ?? p.name}>
                      <Table.Td>
                        {p.product_id ? (
                          <Anchor component={Link} to={`/products/${p.product_id}`}>
                            {p.name}
                          </Anchor>
                        ) : (
                          p.name
                        )}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {p.qty}
                      </Table.Td>
                      <Table.Td ta="right">{formatMoney(p.revenue)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Grid.Col>
      </Grid>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder>
          <Title order={4} mb="sm">
            Замовлення за статусами
          </Title>
          <Stack gap="xs">
            {d &&
              (Object.keys(ORDER_STATUS) as OrderStatus[]).map((status) => (
                <Group key={status} justify="space-between">
                  <Anchor component={Link} to={`/orders?status=${status}`} c="inherit">
                    {ORDER_STATUS[status].label}
                  </Anchor>
                  <Badge color={ORDER_STATUS[status].color} variant="light">
                    {d.status_counts[status]}
                  </Badge>
                </Group>
              ))}
          </Stack>
        </Card>
        <Card withBorder>
          <Title order={4} mb="sm">
            Малий залишок (≤ {d?.low_stock_threshold ?? '…'} шт.)
          </Title>
          {d?.low_stock.length === 0 ? (
            <Text c="dimmed">Усього достатньо</Text>
          ) : (
            <Table>
              <Table.Tbody>
                {d?.low_stock.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/products/${p.id}`}>
                        {p.name}
                      </Anchor>
                    </Table.Td>
                    <Table.Td ta="right" c={p.stock_qty === 0 ? 'red' : 'orange'} fw={700}>
                      {p.stock_qty === 0 ? 'Скінчився' : `${p.stock_qty} шт.`}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
