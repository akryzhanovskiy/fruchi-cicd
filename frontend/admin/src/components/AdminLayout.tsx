import {
  AppShell,
  Badge,
  Burger,
  Group,
  Menu,
  NavLink,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCategory,
  IconChevronDown,
  IconLayoutDashboard,
  IconLogout,
  IconPackage,
  IconReceipt,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { NavLink as RouterNavLink, Outlet } from 'react-router-dom';

import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth-context';
import { ROLE } from '../lib/labels';
import { useOrderStream } from '../lib/orderStream';

const NAV_ITEMS = [
  { to: '/', label: 'Дашборд', icon: IconLayoutDashboard },
  { to: '/orders', label: 'Замовлення', icon: IconReceipt, badge: true },
  { to: '/products', label: 'Товари', icon: IconPackage },
  { to: '/categories', label: 'Категорії', icon: IconCategory },
  { to: '/users', label: 'Користувачі', icon: IconUsers, adminOnly: true },
  { to: '/settings', label: 'Налаштування', icon: IconSettings },
];

const BASE_TITLE = 'Fruchi — адмін-панель';

function useNewOrdersCount() {
  // Refreshed instantly by the live stream; polling is the fallback if it's down.
  const { data } = useQuery({
    queryKey: ['orders', 'new-count'],
    queryFn: () => api.orders({ status: 'new', page_size: 1 }),
    refetchInterval: 30_000,
  });
  return data?.status_counts.new ?? 0;
}

function NewOrdersBadge() {
  const count = useNewOrdersCount();
  return count > 0 ? (
    <Badge size="sm" color="red" circle>
      {count}
    </Badge>
  ) : null;
}

export function AdminLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const user = useUser();
  const { logout } = useAuth();
  const newOrders = useNewOrdersCount();
  useOrderStream();

  // "(3) Fruchi — адмін-панель": new orders are visible even from another tab.
  useEffect(() => {
    document.title = newOrders > 0 ? `(${newOrders}) ${BASE_TITLE}` : BASE_TITLE;
  }, [newOrders]);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3} c="apple.6">
              Fruchi · адмін
            </Title>
          </Group>
          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <UnstyledButton>
                <Group gap={6}>
                  <div style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={700}>
                      {user.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {ROLE[user.role]}
                    </Text>
                  </div>
                  <IconChevronDown size={16} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user.email}</Menu.Label>
              <Menu.Item leftSection={<IconLogout size={16} />} onClick={logout}>
                Вийти
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'admin').map((item) => (
          <NavLink
            key={item.to}
            component={RouterNavLink}
            to={item.to}
            end={item.to === '/'}
            label={item.label}
            leftSection={<item.icon size={18} />}
            rightSection={item.badge ? <NewOrdersBadge /> : undefined}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main bg="gray.0">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
