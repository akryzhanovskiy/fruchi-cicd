import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { CatalogStatusBadge } from '../components/StatusBadges';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/notify';
import { slugify } from '../lib/slug';
import type { Category, CategoryInput } from '../lib/types';

const EMPTY: CategoryInput = {
  slug: '',
  name: '',
  description: '',
  seo_title: '',
  seo_description: '',
  status: 'active',
  sort_order: 0,
};

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<CategoryInput>({
    initialValues: category
      ? {
          slug: category.slug,
          name: category.name,
          description: category.description,
          seo_title: category.seo_title,
          seo_description: category.seo_description,
          status: category.status,
          sort_order: category.sort_order,
        }
      : EMPTY,
    validate: {
      name: (v) => (v.trim() ? null : 'Вкажіть назву'),
      slug: (v) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? null : 'Лише латиниця, цифри й дефіси'),
    },
  });
  const save = useMutation({
    mutationFn: (values: CategoryInput) =>
      category ? api.updateCategory(category.id, values) : api.createCategory(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      notifySuccess('Категорію збережено');
      onDone();
    },
    onError: notifyError,
  });
  const nameProps = form.getInputProps('name');

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
      <Stack>
        <TextInput
          label="Назва"
          withAsterisk
          {...nameProps}
          onChange={(e) => {
            nameProps.onChange(e);
            if (!category) form.setFieldValue('slug', slugify(e.currentTarget.value));
          }}
        />
        <TextInput label="Slug" withAsterisk {...form.getInputProps('slug')} />
        <Textarea label="Опис" autosize minRows={2} {...form.getInputProps('description')} />
        <TextInput
          label="SEO-заголовок"
          description="Заголовок у пошуку Google. Порожньо — «Назва — купити з доставкою по Україні»"
          maxLength={200}
          {...form.getInputProps('seo_title')}
        />
        <Textarea
          label="SEO-опис"
          description="Текст під заголовком у пошуку, до 160 символів. Порожньо — з опису"
          autosize
          minRows={2}
          maxLength={400}
          {...form.getInputProps('seo_description')}
        />
        <Select
          label="Статус"
          allowDeselect={false}
          data={[
            { value: 'active', label: 'Показувати' },
            { value: 'coming_soon', label: 'Скоро' },
            { value: 'hidden', label: 'Приховано' },
          ]}
          {...form.getInputProps('status')}
        />
        <NumberInput label="Порядок" allowDecimal={false} {...form.getInputProps('sort_order')} />
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending}>
            Зберегти
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      notifySuccess('Категорію видалено');
    },
    onError: notifyError,
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Категорії</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          Додати категорію
        </Button>
      </Group>
      <Card withBorder padding={0}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Назва</Table.Th>
              <Table.Th>Slug</Table.Th>
              <Table.Th>Товарів</Table.Th>
              <Table.Th>Статус</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {categories.data?.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td fw={700}>{c.name}</Table.Td>
                <Table.Td>{c.slug}</Table.Td>
                <Table.Td>{c.product_count}</Table.Td>
                <Table.Td>
                  {/* For categories coming_soon means "скоро", not "sold out". */}
                  {c.status === 'coming_soon' ? (
                    <Badge color="blue" variant="light">
                      Скоро
                    </Badge>
                  ) : (
                    <CatalogStatusBadge status={c.status} />
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end">
                    <Button size="xs" variant="light" onClick={() => setEditing(c)}>
                      Змінити
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        modals.openConfirmModal({
                          title: `Видалити «${c.name}»?`,
                          confirmProps: { color: 'red' },
                          onConfirm: () => remove.mutate(c.id),
                        })
                      }
                    >
                      Видалити
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Нова категорія' : 'Категорія'}
      >
        {editing !== null && (
          <CategoryForm
            category={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </Stack>
  );
}
