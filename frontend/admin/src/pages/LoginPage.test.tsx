import { fireEvent, screen } from '@testing-library/react';

import { AuthContext } from '../lib/auth-context';
import { jsonResponse, renderWithProviders } from '../test-utils';
import { LoginPage } from './LoginPage';
import { api } from '../lib/api';

function renderLogin() {
  const login = (email: string, password: string) => api.login(email, password).then(() => {});
  renderWithProviders(
    <AuthContext.Provider value={{ user: null, login, logout: async () => {} }}>
      <LoginPage />
    </AuthContext.Provider>,
  );
}

test('shows the server error for wrong credentials', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(jsonResponse({ detail: 'Невірний email або пароль' }, 401)),
  );
  renderLogin();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.ua' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
  expect(await screen.findByText('Невірний email або пароль')).toBeInTheDocument();
});

test('validates empty fields without calling the API', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  renderLogin();
  fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
  expect(await screen.findByText('Вкажіть email')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
