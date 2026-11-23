import {
  ActionIcon,
  Alert,
  Button,
  Card,
  ColorInput,
  Grid,
  Group,
  Image,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconPhotoPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { CatalogStatusBadge } from '../components/StatusBadges';
import { api } from '../lib/api';
import { slugify } from '../lib/slug';
import { notifyError, notifySuccess } from '../lib/notify';
import { PHOTO_MAX_BYTES, PHOTO_TYPES, rejectionMessage } from '../lib/uploads';
import type { Product, ProductInput } from '../lib/types';

// Flavour colours and illustrations from the design.
const FLAVOURS = [
  { value: 'apple', label: 'Яблуко', color: '#F7DCD3' },
  { value: 'pear', label: 'Груша', color: '#E8EDC9' },
  { value: 'banana', label: 'Банан', color: '#F8ECC4' },
  { value: 'orange', label: 'Апельсин', color: '#FBDCC2' },
  { value: 'lemon', label: 'Лимон', color: '#F6F0BE' },
  { value: 'pineapple', label: 'Ананас', color: '#FAE3AE' },
];

const EMPTY: ProductInput = {
  category_id: 0,
  slug: '',
  name: '',
  short_desc: '',
  description: '',
  composition: '',
  nutrition: '',
  storage: '',
  seo_title: '',
  seo_description: '',
  accent_color: '#F3E1CF',
  illustration: null,
  weight_g: 100,
  price: 0,
  sku: '',
  stock_qty: 0,
  visible: true,
  sort_order: 0,
};

const toInput = (p: Product): ProductInput => ({
  category_id: p.category_id,
  slug: p.slug,
  name: p.name,
  short_desc: p.short_desc,
  description: p.description,
  composition: p.composition,
  nutrition: p.nutrition,
  storage: p.storage,
  seo_title: p.seo_title,
  seo_description: p.seo_description,
  accent_color: p.accent_color,
  illustration: p.illustration,
  weight_g: p.weight_g,
  price: p.price,
  sku: p.sku ?? '',
  stock_qty: p.stock_qty,
  visible: p.visible,
  sort_order: p.sort_order,
});

function Images({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const save = (updated: Product) => queryClient.setQueryData(['product', product.id], updated);
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let last = product;
      for (const file of files) last = await api.uploadImage(product.id, file);
      return last;
    },
    onSuccess: (updated) => {
      save(updated);
      notifySuccess('Фото додано');
    },
    onError: notifyError,
  });
  const action = useMutation({
    mutationFn: (fn: () => Promise<Product>) => fn(),
    onSuccess: save,
    onError: notifyError,
  });

  const move = (index: number, shift: number) => {
    const ids = product.images.map((i) => i.id);
    [ids[index], ids[index + shift]] = [ids[index + shift], ids[index]];
    action.mutate(() => api.reorderImages(product.id, ids));
  };

  return (
    <Card withBorder>
      <Title order={4} mb={4}>
        Фото
      </Title>
      <Text size="sm" c="dimmed" mb="sm">
        Перше фото — головне в каталозі. Поки фото немає, на сайті показується ілюстрація смаку.
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} mb="sm">
        {product.images.map((image, i) => (
          <Card key={image.id} withBorder padding="xs">
            <Card.Section>
              <Image src={image.url} alt={image.alt} h={140} fit="cover" />
            </Card.Section>
            <TextInput
              mt="xs"
              size="xs"
              placeholder="Опис фото (alt)"
              defaultValue={image.alt}
              onBlur={(e) =>
                e.currentTarget.value !== image.alt &&
                action.mutate(() => api.updateImage(product.id, image.id, e.currentTarget.value))
              }
            />
            <Group justify="space-between" mt="xs" gap={4}>
              <Group gap={4}>
                <ActionIcon
                  variant="default"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Раніше"
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="default"
                  disabled={i === product.images.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Пізніше"
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Group>
              <Tooltip label="Видалити">
                <ActionIcon
                  color="red"
                  variant="light"
                  aria-label="Видалити фото"
                  onClick={() =>
                    modals.openConfirmModal({
                      title: 'Видалити фото?',
                      confirmProps: { color: 'red' },
                      onConfirm: () => action.mutate(() => api.deleteImage(product.id, image.id)),
                    })
                  }
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
      <Dropzone
        onDrop={(files) => upload.mutate(files)}
        onReject={(rejections) =>
          notifications.show({
            color: 'red',
            title: 'Фото не додано',
            message: rejectionMessage(rejections),
            style: { whiteSpace: 'pre-line' },
          })
        }
        accept={PHOTO_TYPES}
        maxSize={PHOTO_MAX_BYTES}
        loading={upload.isPending}
      >
        <Group justify="center" gap="sm" mih={80} style={{ pointerEvents: 'none' }}>
          <IconPhotoPlus size={32} stroke={1.5} />
          <div>
            <Text fw={700}>Перетягніть фото сюди або натисніть, щоб обрати</Text>
            <Text size="sm" c="dimmed">
              JPEG, PNG або WebP, до 10 МБ
            </Text>
          </div>
        </Group>
      </Dropzone>
    </Card>
  );
}

export function ProductEditPage() {
  const { id } = useParams();
  const productId = id ? Number(id) : null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const product = useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.product(productId!),
    enabled: productId !== null,
  });

  const form = useForm<ProductInput>({
    initialValues: EMPTY,
    validate: {
      name: (v) => (v.trim() ? null : 'Вкажіть назву'),
      slug: (v) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? null : 'Лише латиниця, цифри й дефіси'),
      category_id: (v) => (v ? null : 'Оберіть категорію'),
      weight_g: (v) => (v > 0 ? null : 'Більше нуля'),
      price: (v) => (v >= 0 ? null : 'Не може бути від’ємною'),
      stock_qty: (v) => (v >= 0 ? null : 'Не може бути від’ємним'),
    },
  });

  useEffect(() => {
    if (product.data) {
      form.setValues(toInput(product.data));
      form.resetDirty(toInput(product.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the product loads
  }, [product.data?.id, product.data?.updated_at]);

  useEffect(() => {
    if (!productId && categories.data?.length && !form.values.category_id) {
      form.setFieldValue('category_id', categories.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.data, productId]);

  const save = useMutation({
    mutationFn: (values: ProductInput) => {
      const data = { ...values, sku: values.sku?.trim() || null };
      return productId ? api.updateProduct(productId, data) : api.createProduct(data);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['product', saved.id], saved);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notifySuccess(productId ? 'Товар збережено' : 'Товар створено — тепер додайте фото');
      if (!productId) navigate(`/products/${saved.id}`, { replace: true });
    },
    onError: notifyError,
  });

  const remove = useMutation({
    mutationFn: () => api.deleteProduct(productId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notifySuccess('Товар видалено');
      navigate('/products');
    },
    onError: notifyError,
  });

  if (productId && product.isPending) return <Loader />;
  if (productId && product.isError) return <Text c="red">Товар не знайдено</Text>;

  const nameProps = form.getInputProps('name');
  return (
    <form onSubmit={form.onSubmit((values) => save.mutate(values))}>
      <Stack>
        <Group>
          <Button
            component={Link}
            to="/products"
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
          >
            До списку
          </Button>
        </Group>
        <Group justify="space-between">
          <Group gap="sm">
            <Title order={2}>{productId ? product.data?.name : 'Новий товар'}</Title>
            {product.data && <CatalogStatusBadge status={product.data.status} />}
          </Group>
          <Group>
            {productId && (
              <Button
                color="red"
                variant="subtle"
                onClick={() =>
                  modals.openConfirmModal({
                    title: 'Видалити товар?',
                    children: (
                      <Text size="sm">
                        Товар і його фото буде видалено. Минулі замовлення збережуться. Щоб просто
                        прибрати товар з сайту, вимкніть «Показувати на сайті».
                      </Text>
                    ),
                    confirmProps: { color: 'red' },
                    onConfirm: () => remove.mutate(),
                  })
                }
              >
                Видалити
              </Button>
            )}
            <Button type="submit" loading={save.isPending}>
              {productId ? 'Зберегти' : 'Створити'}
            </Button>
          </Group>
        </Group>

        {categories.data?.length === 0 && (
          <Alert color="yellow">Спершу створіть категорію в розділі «Категорії».</Alert>
        )}

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack>
              <Card withBorder>
                <Stack>
                  <TextInput
                    label="Назва"
                    withAsterisk
                    {...nameProps}
                    onChange={(e) => {
                      nameProps.onChange(e);
                      if (!productId && !form.isDirty('slug')) {
                        form.setFieldValue('slug', slugify(e.currentTarget.value));
                        form.resetDirty({ ...form.values, slug: slugify(e.currentTarget.value) });
                      }
                    }}
                  />
                  <TextInput
                    label="Адреса на сайті (slug)"
                    description={`/product/${form.values.slug || '…'}`}
                    withAsterisk
                    {...form.getInputProps('slug')}
                  />
                  <TextInput
                    label="Короткий опис"
                    description="У картці каталогу, до 300 символів"
                    maxLength={300}
                    {...form.getInputProps('short_desc')}
                  />
                  <Textarea
                    label="Опис"
                    description="На сторінці товару"
                    autosize
                    minRows={3}
                    {...form.getInputProps('description')}
                  />
                  <Textarea
                    label="Склад"
                    autosize
                    minRows={2}
                    {...form.getInputProps('composition')}
                  />
                  <Textarea
                    label="Харчова цінність"
                    placeholder="Калорійність, білки, жири, вуглеводи на 100 г"
                    autosize
                    minRows={2}
                    {...form.getInputProps('nutrition')}
                  />
                  <Textarea
                    label="Зберігання"
                    placeholder="Умови й термін зберігання"
                    autosize
                    minRows={2}
                    {...form.getInputProps('storage')}
                  />
                </Stack>
              </Card>
              <Card withBorder>
                <Stack>
                  <Title order={4}>Пошук Google</Title>
                  <TextInput
                    label="SEO-заголовок"
                    description="Порожньо — «Назва — категорія, вага, купити». Пишіть так, як люди шукають: «Яблучні чіпси без цукру 50 г»"
                    maxLength={200}
                    {...form.getInputProps('seo_title')}
                  />
                  <Textarea
                    label="SEO-опис"
                    description="Текст під заголовком у пошуку, до 160 символів. Порожньо — короткий опис, вага й ціна"
                    autosize
                    minRows={2}
                    maxLength={400}
                    {...form.getInputProps('seo_description')}
                  />
                </Stack>
              </Card>
              {product.data ? (
                <Images product={product.data} />
              ) : (
                <Card withBorder>
                  <Text c="dimmed">Фото можна буде додати після створення товару.</Text>
                </Card>
              )}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack>
              <Card withBorder>
                <Stack>
                  <Switch
                    label="Показувати на сайті"
                    description="Коли залишок 0 — товар видно з позначкою «Скінчився»"
                    {...form.getInputProps('visible', { type: 'checkbox' })}
                  />
                  <Select
                    label="Категорія"
                    withAsterisk
                    allowDeselect={false}
                    data={
                      categories.data?.map((c) => ({ value: String(c.id), label: c.name })) ?? []
                    }
                    value={form.values.category_id ? String(form.values.category_id) : null}
                    onChange={(v) => form.setFieldValue('category_id', Number(v))}
                    error={form.errors.category_id}
                  />
                  <NumberInput
                    label="Ціна, ₴"
                    withAsterisk
                    min={0}
                    decimalScale={2}
                    {...form.getInputProps('price')}
                  />
                  <NumberInput
                    label="Вага пачки, г"
                    withAsterisk
                    min={1}
                    allowDecimal={false}
                    {...form.getInputProps('weight_g')}
                  />
                  <NumberInput
                    label="Залишок на складі, шт."
                    min={0}
                    allowDecimal={false}
                    {...form.getInputProps('stock_qty')}
                  />
                  <TextInput label="Артикул (SKU)" {...form.getInputProps('sku')} />
                  <NumberInput
                    label="Порядок у каталозі"
                    description="Менше число — вище в списку"
                    allowDecimal={false}
                    {...form.getInputProps('sort_order')}
                  />
                </Stack>
              </Card>
              <Card withBorder>
                <Stack>
                  <Select
                    label="Ілюстрація смаку"
                    description="Показується, поки немає фото"
                    clearable
                    data={FLAVOURS.map(({ value, label }) => ({ value, label }))}
                    value={form.values.illustration}
                    onChange={(v) => {
                      form.setFieldValue('illustration', v as ProductInput['illustration']);
                      const flavour = FLAVOURS.find((f) => f.value === v);
                      if (flavour) form.setFieldValue('accent_color', flavour.color);
                    }}
                  />
                  <ColorInput
                    label="Колір фону"
                    format="hex"
                    swatches={FLAVOURS.map((f) => f.color)}
                    {...form.getInputProps('accent_color')}
                  />
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </form>
  );
}
