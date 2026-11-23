import { jsonResponse } from '../test-utils';
import { adminFetch, api } from './api';

test('refreshes the access token once on 401 and retries the request', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
    .mockResolvedValueOnce(jsonResponse({ access_token: 'new-token', user: {} }))
    .mockResolvedValueOnce(jsonResponse({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);

  await expect(adminFetch('/dashboard')).resolves.toEqual({ ok: true });
  expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/admin/auth/refresh');
  const retryHeaders = fetchMock.mock.calls[2][1].headers as Headers;
  expect(retryHeaders.get('Authorization')).toBe('Bearer new-token');
});

test('uploads images as multipart without a JSON content type', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
  vi.stubGlobal('fetch', fetchMock);
  await api.uploadImage(1, new File(['x'], 'a.png', { type: 'image/png' }));
  const init = fetchMock.mock.calls[0][1];
  expect(init.body).toBeInstanceOf(FormData);
  expect((init.headers as Headers).has('Content-Type')).toBe(false);
});
