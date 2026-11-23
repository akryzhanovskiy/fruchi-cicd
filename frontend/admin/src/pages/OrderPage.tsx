import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  CopyButton,
  Grid,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconArrowLeft, IconCheck, IconCopy, IconPhone } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { OrderStatusBadge, PaymentBadge } from '../components/StatusBadges';
import { api } from '../lib/api';
import {
  formatDateTime,
  formatMoney,
  formatPhone,
  ORDER_ACTION,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from '../lib/labels';
import { notifyError, notifySuccess } from '../lib/notify';
import type { OrderDetail, OrderUpdate } from '../lib/types';

function Copy({ value }: { value: string }) {
  return (
    <CopyButton value={value} timeout={1500}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Скопійовано' : 'Скопіювати'} withArrow>
          <ActionIcon variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy}>
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

function describeEvent(event: OrderDetail['events'][number]): string {
  const { payload } = event;
  switch (event.type) {
    case 'created':
      return 'Замовлення оформлено на сайті';
    case 'status_change':
      return `Статус: ${ORDER_STATUS[payload.from as keyof typeof ORDER_STATUS].label} → ${
        ORDER_STATUS[payload.to as keyof typeof ORDER_STATUS].label
      }`;
    case 'payment':
      return `Оплата: ${PAYMENT_STATUS[payload.to as keyof typeof PAYMENT_STATUS].label}`;
    case 'ttn_set':
      return payload.ttn ? `ТТН: ${payload.ttn}` : 'ТТН видалено';
    case 'note':
      return 'Оновлено нотатку';
  }
}

export function OrderPage() {
  const id = Number(useParams().id);
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ['order', id], queryFn: () => api.order(id) });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [ttn, setTtn] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (order.data) {
      setTtn(order.data.ttn ?? '');
      setNote(order.data.operator_note);
    }
  }, [order.data]);

  const mutation = useMutation({
    mutationFn: (data: OrderUpdate) => api.updateOrder(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['order', id], updated);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifySuccess('Збережено');
    },
    onError: notifyError,
  });

  if (order.isPending) return <Loader />;
  if (order.isError) return <Text c="red">Замовлення не знайдено</Text>;
  const o = order.data;

  const changeStatus = (status: OrderDetail['next_statuses'][number]) => {
    const data: OrderUpdate = { status };
    if (status === 'shipped') data.ttn = ttn.trim();
    if (status === 'cancelled' || status === 'returned') {
      modals.openConfirmModal({
        title: status === 'cancelled' ? 'Скасувати замовлення?' : 'Оформити повернення?',
        children: <Text size="sm">Товари повернуться на склад.</Text>,
        confirmProps: { color: 'red' },
        onConfirm: () => mutation.mutate(data),
      });
    } else {
      mutation.mutate(data);
    }
  };

  const paymentMessage = settings.data?.payment_details
    ? `Замовлення ${o.number} на суму ${formatMoney(o.items_total)}.\n${settings.data.payment_details}`
    : '';

  return (
    <Stack>
      <Group>
        <Button
          component={Link}
          to="/orders"
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
        >
          До списку
        </Button>
      </Group>
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="sm">
            <Title order={2}>{o.number}</Title>
            <OrderStatusBadge status={o.status} />
          </Group>
          <Text c="dimmed" size="sm">
            {formatDateTime(o.created_at)}
          </Text>
        </div>
        <Group>
          {o.next_statuses.map((status) => (
            <Button
              key={status}
              variant={status === 'cancelled' || status === 'returned' ? 'outline' : 'filled'}
              color={
                status === 'cancelled' || status === 'returned' ? 'red' : ORDER_STATUS[status].color
              }
              loading={mutation.isPending && mutation.variables?.status === status}
              onClick={() => changeStatus(status)}
            >
              {ORDER_ACTION[status]}
            </Button>
          ))}
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            <Card withBorder>
              <Title order={4} mb="sm">
                Товари
              </Title>
              <Table>
                <Table.Tbody>
                  {o.items.map((item) => (
                    <Table.Tr key={item.product_name}>
                      <Table.Td>
                        {item.product_name}, {item.weight_g} г
                      </Table.Td>
                      <Table.Td>
                        {formatMoney(item.unit_price)} × {item.qty}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {formatMoney(item.line_total)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td colSpan={2} fw={800}>
                      Разом ({o.items_count} шт.)
                    </Table.Td>
                    <Table.Td ta="right" fw={800} fz="lg">
                      {formatMoney(o.items_total)}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              {o.customer_comment && (
                <Text mt="sm" size="sm">
                  <b>Коментар клієнта:</b> {o.customer_comment}
                </Text>
              )}
            </Card>

            <Card withBorder>
              <Title order={4} mb="sm">
                Доставка
              </Title>
              <Group align="flex-end">
                <TextInput
                  label="Номер ТТН (Нова пошта)"
                  value={ttn}
                  onChange={(e) => setTtn(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  description={
                    o.status === 'confirmed' ? 'Потрібен, щоб позначити відправлення' : undefined
                  }
                />
                <Button
                  variant="light"
                  disabled={ttn.trim() === (o.ttn ?? '')}
                  onClick={() => mutation.mutate({ ttn: ttn.trim() })}
                >
                  Зберегти
                </Button>
              </Group>
            </Card>

            <Card withBorder>
              <Title order={4} mb="sm">
                Нотатка оператора
              </Title>
              <Textarea
                autosize
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
                placeholder="Видно лише в адмінці"
              />
              <Group justify="flex-end" mt="sm">
                <Button
                  variant="light"
                  disabled={note === o.operator_note}
                  onClick={() => mutation.mutate({ operator_note: note })}
                >
                  Зберегти нотатку
                </Button>
              </Group>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack>
            <Card withBorder>
              <Title order={4} mb="sm">
                Клієнт
              </Title>
              <Text fw={700}>{o.customer_name}</Text>
              <Group gap={4}>
                <IconPhone size={16} />
                <Anchor href={`tel:${o.phone}`}>{formatPhone(o.phone)}</Anchor>
                <Copy value={o.phone} />
              </Group>
              <Text mt="sm" size="sm" c="dimmed">
                Нова пошта
              </Text>
              <Group gap={4} wrap="nowrap" align="flex-start">
                <Text>
                  {o.city}, {o.np_branch}
                </Text>
                <Copy value={`${o.city}, ${o.np_branch}`} />
              </Group>
            </Card>

            <Card withBorder>
              <Title order={4} mb="sm">
                Оплата
              </Title>
              <Group justify="space-between">
                <Text>{PAYMENT_METHOD[o.payment_method]}</Text>
                <PaymentBadge status={o.payment_status} />
              </Group>
              <Select
                mt="sm"
                label="Статус оплати"
                value={o.payment_status}
                allowDeselect={false}
                onChange={(v) =>
                  v && mutation.mutate({ payment_status: v as OrderUpdate['payment_status'] })
                }
                data={Object.entries(PAYMENT_STATUS).map(([value, { label }]) => ({
                  value,
                  label,
                }))}
              />
              {o.payment_method === 'card_transfer' && (
                <Stack gap={4} mt="sm">
                  {paymentMessage ? (
                    <>
                      <Text size="sm" c="dimmed">
                        Повідомлення з реквізитами для клієнта:
                      </Text>
                      <Card bg="gray.0" p="xs">
                        <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                          {paymentMessage}
                        </Text>
                      </Card>
                      <CopyButton value={paymentMessage}>
                        {({ copied, copy }) => (
                          <Button
                            variant="light"
                            color={copied ? 'green' : 'apple'}
                            leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                            onClick={copy}
                          >
                            {copied ? 'Скопійовано' : 'Скопіювати реквізити'}
                          </Button>
                        )}
                      </CopyButton>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Реквізити для оплати ще не вказані —{' '}
                      <Anchor component={Link} to="/settings">
                        додайте їх у налаштуваннях
                      </Anchor>
                      .
                    </Text>
                  )}
                </Stack>
              )}
            </Card>

            <Card withBorder>
              <Title order={4} mb="sm">
                Історія
              </Title>
              <Timeline bulletSize={14} lineWidth={2}>
                {o.events.map((event, i) => (
                  <Timeline.Item key={i} title={describeEvent(event)}>
                    <Text size="xs" c="dimmed">
                      {formatDateTime(event.created_at)}
                      {event.user_name && ` · ${event.user_name}`}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
