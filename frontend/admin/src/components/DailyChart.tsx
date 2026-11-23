import { Box, SegmentedControl, Group, Text, Title, Tooltip, VisuallyHidden } from '@mantine/core';
import { useState } from 'react';

import { formatMoney } from '../lib/labels';
import type { Dashboard } from '../lib/types';

type Metric = 'orders' | 'revenue';

const METRICS: Record<Metric, { label: string; format: (v: number) => string }> = {
  orders: { label: 'Замовлення', format: (v) => String(v) },
  revenue: { label: 'Виручка', format: formatMoney },
};

const day = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' });
const weekday = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});
const parse = (iso: string) => new Date(`${iso}T12:00:00`);

/** Rounds the axis maximum up to a "nice" number so gridlines land on round values. */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value)! * magnitude;
  return step * 4;
}

const HEIGHT = 180;

/**
 * Orders or revenue per day for the last 30 days: one series, one axis — the metric is
 * switched rather than drawn on a second scale. Hover/focus a day for exact values.
 */
export function DailyChart({ daily }: { daily: Dashboard['daily'] }) {
  const [metric, setMetric] = useState<Metric>('orders');
  const { label, format } = METRICS[metric];
  const values = daily.map((d) => d[metric]);
  const max = niceMax(Math.max(...values, 0));
  const total = values.reduce((a, b) => a + b, 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  return (
    <Box>
      <Group justify="space-between" mb="xs" wrap="wrap">
        <div>
          <Title order={4}>{label} за 30 днів</Title>
          <Text size="sm" c="dimmed">
            Разом: {format(total)}. Без скасованих і повернених.
          </Text>
        </div>
        <SegmentedControl
          size="xs"
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
          data={[
            { value: 'orders', label: 'Замовлення' },
            { value: 'revenue', label: 'Виручка' },
          ]}
        />
      </Group>

      <Box style={{ display: 'flex', gap: 8 }} aria-hidden>
        {/* Y axis labels */}
        <Box
          style={{
            position: 'relative',
            width: metric === 'revenue' ? 64 : 24,
            height: HEIGHT,
            flex: 'none',
          }}
        >
          {ticks.map((t) => (
            <Text
              key={t}
              size="xs"
              c="dimmed"
              ta="right"
              style={{
                position: 'absolute',
                right: 0,
                bottom: `${(t / max) * 100}%`,
                transform: 'translateY(50%)',
              }}
            >
              {metric === 'revenue' ? Math.round(t).toLocaleString('uk-UA') : t}
            </Text>
          ))}
        </Box>
        {/* Plot */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Box style={{ position: 'relative', height: HEIGHT }}>
            {ticks.map((t) => (
              <Box
                key={t}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${(t / max) * 100}%`,
                  borderTop: `1px ${t === 0 ? 'solid' : 'dashed'} var(--mantine-color-gray-3)`,
                }}
              />
            ))}
            <Box
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}
            >
              {daily.map((d) => {
                const value = d[metric];
                return (
                  <Tooltip
                    key={d.date}
                    label={`${weekday.format(parse(d.date))}: ${METRICS.orders.format(d.orders)} зам., ${formatMoney(d.revenue)}`}
                    withArrow
                  >
                    {/* The whole column is the hover target, wider than the bar itself. */}
                    <Box
                      style={{
                        flex: 1,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        padding: '0 1px',
                      }}
                    >
                      <Box
                        style={{
                          width: '100%',
                          maxWidth: 18,
                          height: value > 0 ? `max(${(value / max) * 100}%, 3px)` : 0,
                          background: 'var(--mantine-color-apple-6)',
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
          {/* X axis: a label every week */}
          <Box style={{ display: 'flex', marginTop: 4 }}>
            {daily.map((d, i) => (
              <Text
                key={d.date}
                size="xs"
                c="dimmed"
                style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'visible' }}
              >
                {(daily.length - 1 - i) % 7 === 0 ? day.format(parse(d.date)) : ''}
              </Text>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Same data as a table for screen readers. */}
      <VisuallyHidden>
        <table>
          <caption>{label} по днях за 30 днів</caption>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Замовлення</th>
              <th>Виручка</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date}>
                <td>{weekday.format(parse(d.date))}</td>
                <td>{d.orders}</td>
                <td>{formatMoney(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </Box>
  );
}
