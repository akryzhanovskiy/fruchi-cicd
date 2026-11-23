import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { api } from '../lib/api';
import { useUser } from '../lib/auth-context';
import { formatDateTime, ROLE } from '../lib/labels';
import { notifyError, notifySuccess } from '../lib/notify';
import type { Role, User } from '../lib/types';

interface FormValues {
  email: string;
  name: string;
  password: string;
  role: Role;
  is_active: boolean;
}

function UserForm({ user, onDone }: { user: User | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const me = useUser();
  const isSelf = user?.id === me.id;
  const form = useForm<FormValues>({
    initialValues: {
      email: user?.email ?? '',
      name: user?.name ?? '',
      password: '',
      role: user?.role ?? 'operator',
      is_active: user?.is_active ?? true,
    },
    validate: {
      email: (v) => (user || /^\S+@\S+\.\S+$/.test(v) ? null : 'Вкажіть email'),
      name: (v) => (v.trim() ? null : 'Вкажіть ім’я'),
      password: (v) =>
        (!user && v.length < 8) || (v && v.length < 8) ? 'Щонайменше 8 символів' : null,
    },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) =>
      user
        ? api.updateUser(user.id, {
            name: v.name,
            role: v.role,
            is_active: v.is_active,
            ...(v.password ? { password: v.password } : {}),
          })
        : api.createUser({ email: v.email, name: v.name, password: v.password, role: v.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifySuccess('Користувача збережено');
      onDone();
    },
    onError: notifyError,
  });

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
      <Stack>
        <TextInput label="Email" disabled={!!user} withAsterisk {...form.getInputProps('email')} />
        <TextInput label="Ім’я" withAsterisk {...form.getInputProps('name')} />
        <PasswordInput
          label={user ? 'Новий пароль' : 'Пароль'}
          description={
            user
              ? 'Залиште порожнім, щоб не змінювати. Після зміни всі сесії завершаться.'
              : undefined
          }
          withAsterisk={!user}
          autoComplete="new-password"
          {...form.getInputProps('password')}
        />
        <Select
          label="Роль"
          allowDeselect={false}
          disabled={isSelf}
          data={Object.entries(ROLE).map(([value, label]) => ({ value, label }))}
          {...form.getInputProps('role')}
        />
        {user && (
          <Switch
            label="Активний"
            disabled={isSelf}
            {...form.getInputProps('is_active', { type: 'checkbox' })}
          />
        )}
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending}>
            Зберегти
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function UsersPage() {
  const me = useUser();
  const users = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: me.role === 'admin' });
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  if (me.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Користувачі</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          Додати користувача
        </Button>
      </Group>
      <Card withBorder padding={0}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ім’я</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Роль</Table.Th>
              <Table.Th>Останній вхід</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.data?.map((u) => (
              <Table.Tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(u)}>
                <Table.Td fw={700}>{u.name}</Table.Td>
                <Table.Td>{u.email}</Table.Td>
                <Table.Td>{ROLE[u.role]}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {u.last_login_at ? formatDateTime(u.last_login_at) : '—'}
                  </Text>
                </Table.Td>
                <Table.Td>{!u.is_active && <Badge color="gray">Вимкнений</Badge>}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Новий користувач' : 'Користувач'}
      >
        {editing !== null && (
          <UserForm user={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </Stack>
  );
}
