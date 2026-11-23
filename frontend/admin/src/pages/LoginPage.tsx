import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';

import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Вкажіть email'),
      password: (v) => (v ? null : 'Вкажіть пароль'),
    },
  });

  const submit = form.onSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await login(email, password);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Center h="100vh" bg="#FDF3EA">
      <Paper withBorder shadow="sm" p="xl" radius="lg" w={380}>
        <form onSubmit={submit}>
          <Stack>
            <Title order={2} c="apple.6" ta="center">
              Fruchi · адмін
            </Title>
            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}
            <TextInput
              label="Email"
              type="email"
              autoComplete="username"
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Пароль"
              autoComplete="current-password"
              {...form.getInputProps('password')}
            />
            <Button type="submit" loading={form.submitting} fullWidth>
              Увійти
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
