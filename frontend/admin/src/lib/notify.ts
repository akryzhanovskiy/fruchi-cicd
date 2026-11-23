import { notifications } from '@mantine/notifications';

import { errorMessage } from './api';

export const notifySuccess = (message: string) =>
  notifications.show({ color: 'green', message, autoClose: 2500 });

export const notifyError = (error: unknown) =>
  notifications.show({ color: 'red', title: 'Помилка', message: errorMessage(error) });
