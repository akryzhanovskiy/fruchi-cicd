import {
  Avatar,
  Button,
  Card,
  ColorSwatch,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { CatalogStatusBadge } from '../components/StatusBadges';
import { api } from '../lib/api';
import { CATALOG_STATUS, formatMoney } from '../lib/labels';

export function ProductsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search, 300);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const products = useQuery({
    queryKey: ['products', q, categoryId, status],
    queryFn: () => api.products({ q, category_id: categoryId ?? '', status: status ?? '' }),
    placeholderData: keepPreviousData,
  });
  const threshold = settings.data?.low_stock_threshold ?? 5;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Товари</Title>
        <Button component={Link} to="/products/new" leftSection={<IconPlus size={16} />}>
          Додати товар
        </Button>
      </Group>
      <Card withBorder padding={0}>
        <Group p="sm" gap="sm">
          <TextInput
            placeholder="Назва, slug або артикул"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={260}
          />
          <Select
            placeholder="Категорія"
            clearable
            value={categoryId}
            onChange={setCategoryId}
            data={categories.data?.map((c) => ({ value: String(c.id), label: c.name })) ?? []}
            w={200}
          />
          <Select
            placeholder="Статус"
            clearable
            value={status}
            onChange={setStatus}
            data={Object.entries(CATALOG_STATUS).map(([value, { label }]) => ({ value, label }))}
            w={180}
          />
        </Group>
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Товар</Table.Th>
                <Table.Th>Категорія</Table.Th>
                <Table.Th>Вага</Table.Th>
                <Table.Th>Ціна</Table.Th>
                <Table.Th>Залишок</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {products.data?.map((p) => (
                <Table.Tr
                  key={p.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/products/${p.id}`)}
                >
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      {p.images[0] ? (
                        <Avatar src={p.images[0].url} radius="md" size={44} />
                      ) : (
                        <ColorSwatch
                          color={p.accent_color}
                          size={44}
                          radius="md"
                          withShadow={false}
                        />
                      )}
                      <div>
                        <Text fw={700} size="sm">
                          {p.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {p.sku || p.slug}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>{p.category_name}</Table.Td>
                  <Table.Td>{p.weight_g} г</Table.Td>
                  <Table.Td>{formatMoney(p.price)}</Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      fw={p.stock_qty <= threshold ? 800 : undefined}
                      c={
                        p.stock_qty === 0 ? 'red' : p.stock_qty <= threshold ? 'orange' : undefined
                      }
                    >
                      {p.stock_qty} шт.
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <CatalogStatusBadge status={p.status} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {products.data?.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Товарів не знайдено
          </Text>
        )}
      </Card>
    </Stack>
  );
}
