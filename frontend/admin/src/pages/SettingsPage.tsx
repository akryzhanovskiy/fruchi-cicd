import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  browserNotificationPermission,
  playChime,
  requestBrowserNotifications,
} from '../lib/alerts';
import { api } from '../lib/api';
import { useUser } from '../lib/auth-context';
import { notifyError, notifySuccess } from '../lib/notify';
import type { ShopSettingsInput } from '../lib/types';

const verificationToken = (v: string) =>
  /^[A-Za-z0-9_-]{0,100}$/.test(v.trim()) ? null : 'Вставте лише значення content, без тегу';

export function SettingsPage() {
  const user = useUser();
  const readOnly = user.role !== 'admin';
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const form = useForm<ShopSettingsInput>({
    initialValues: {
      payment_details: '',
      low_stock_threshold: 5,
      telegram_chat_id: '',
      ga_measurement_id: '',
      meta_pixel_id: '',
      google_site_verification: '',
      bing_site_verification: '',
    },
    validate: {
      ga_measurement_id: (v) =>
        !v.trim() || /^G-[A-Z0-9]{4,20}$/.test(v.trim()) ? null : 'Формат: G-XXXXXXXXXX',
      meta_pixel_id: (v) => (!v.trim() || /^\d{5,20}$/.test(v.trim()) ? null : 'Лише цифри'),
      google_site_verification: verificationToken,
      bing_site_verification: verificationToken,
    },
  });

  useEffect(() => {
    if (settings.data) {
      const values = Object.fromEntries(
        Object.keys(form.values).map((key) => [
          key,
          settings.data[key as keyof ShopSettingsInput] ?? '',
        ]),
      ) as unknown as ShopSettingsInput;
      form.setValues(values);
      form.resetDirty(values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data]);

  const save = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      notifySuccess('Налаштування збережено');
    },
    onError: notifyError,
  });

  const testTelegram = useMutation({
    mutationFn: () => api.testTelegram(form.values.telegram_chat_id),
    onSuccess: () => notifySuccess('Тестове повідомлення надіслано — перевірте Telegram'),
    onError: notifyError,
  });

  if (settings.isPending) return <Loader />;

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
      <Stack maw={640}>
        <Title order={2}>Налаштування</Title>
        {readOnly && <Alert color="blue">Змінювати налаштування може лише адміністратор.</Alert>}
        <Card withBorder>
          <Stack>
            <Textarea
              label="Реквізити для оплати на картку"
              description="Оператор копіює їх у повідомлення клієнту разом із номером і сумою замовлення"
              placeholder={'Картка ПриватБанку 0000 0000 0000 0000\nОтримувач: ФОП …'}
              autosize
              minRows={3}
              readOnly={readOnly}
              {...form.getInputProps('payment_details')}
            />
            <NumberInput
              label="Поріг малого залишку, шт."
              description="Товари з таким або меншим залишком підсвічуються"
              min={0}
              allowDecimal={false}
              readOnly={readOnly}
              {...form.getInputProps('low_stock_threshold')}
            />
          </Stack>
        </Card>
        <Card withBorder>
          <Stack>
            <Title order={4}>Сповіщення в Telegram</Title>
            {settings.data && !settings.data.telegram_bot_configured && (
              <Alert color="yellow">
                Бот не підключений: задайте TELEGRAM_BOT_TOKEN у змінних оточення сервера.
                Сповіщення чекатимуть у черзі й надійдуть після підключення.
              </Alert>
            )}
            <TextInput
              label="Telegram chat ID"
              description="Ваш особистий чат з ботом або група операторів. Для групи ID від’ємний, наприклад -100…"
              placeholder="303149141"
              readOnly={readOnly}
              {...form.getInputProps('telegram_chat_id')}
            />
            {!readOnly && (
              <Group>
                <Button
                  variant="light"
                  loading={testTelegram.isPending}
                  disabled={
                    !form.values.telegram_chat_id || !settings.data?.telegram_bot_configured
                  }
                  onClick={() => testTelegram.mutate()}
                >
                  Надіслати тестове повідомлення
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
        <Card withBorder>
          <Stack>
            <Title order={4}>Аналітика та пошукові системи</Title>
            <Text size="sm" c="dimmed">
              Скопіюйте ідентифікатори з кабінетів Google і Meta. Зміни діють на сайті одразу після
              збереження; порожнє поле вимикає відповідний сервіс.
            </Text>
            <TextInput
              label="Google Analytics 4 — ідентифікатор потоку"
              description="Admin → Data streams → Measurement ID"
              placeholder="G-XXXXXXXXXX"
              readOnly={readOnly}
              {...form.getInputProps('ga_measurement_id')}
            />
            <TextInput
              label="Meta Pixel ID"
              description="Events Manager → Data sources → Pixel ID"
              placeholder="1234567890123456"
              readOnly={readOnly}
              {...form.getInputProps('meta_pixel_id')}
            />
            <TextInput
              label="Google Search Console — код підтвердження"
              description='Спосіб «HTML-тег»: значення content з тегу <meta name="google-site-verification" content="…">'
              readOnly={readOnly}
              {...form.getInputProps('google_site_verification')}
            />
            <TextInput
              label="Bing Webmaster — код підтвердження"
              description='Спосіб «Meta tag»: значення content з тегу <meta name="msvalidate.01" content="…">'
              readOnly={readOnly}
              {...form.getInputProps('bing_site_verification')}
            />
          </Stack>
        </Card>
        <BrowserNotificationsCard />
        {!readOnly && (
          <Group justify="flex-end">
            <Button type="submit" loading={save.isPending} disabled={!form.isDirty()}>
              Зберегти
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  );
}

const PERMISSION_TEXT: Record<ReturnType<typeof browserNotificationPermission>, string> = {
  granted: 'Увімкнено: коли вкладка адмінки у фоні, нове замовлення покаже системне сповіщення.',
  default: 'Вимкнено. Увімкніть, щоб бачити нові замовлення, навіть коли адмінка у фоні.',
  denied: 'Заблоковано в браузері. Дозвольте сповіщення для цього сайту в налаштуваннях браузера.',
  unsupported: 'Цей браузер не підтримує системні сповіщення.',
};

/** Per-browser setting: permission for system notifications, plus a sound check. */
function BrowserNotificationsCard() {
  const [permission, setPermission] = useState(browserNotificationPermission);
  return (
    <Card withBorder>
      <Stack>
        <Title order={4}>Сповіщення в цьому браузері</Title>
        <Text size="sm">{PERMISSION_TEXT[permission]}</Text>
        <Group>
          {permission === 'default' && (
            <Button
              variant="light"
              onClick={async () => setPermission(await requestBrowserNotifications())}
            >
              Увімкнути сповіщення
            </Button>
          )}
          <Button variant="subtle" onClick={playChime}>
            Перевірити звук
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
