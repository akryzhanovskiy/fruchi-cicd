import { ApiError, createOrder, type OutOfStockBody, type PaymentMethod } from '@fruchi/api-client';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { trackPurchase } from '../lib/analytics';
import { formatPrice } from '../lib/format';
import { formatPhone, isCompletePhone } from '../lib/phone';
import { itemsLabel } from '../lib/plural';
import { cartTotal, useCart, useCartCount } from '../store/cart';
import styles from './Checkout.module.css';

const PAYMENTS: { id: PaymentMethod; title: string; note: string }[] = [
  { id: 'cod', title: 'При отриманні', note: 'Накладений платіж у Новій пошті' },
  {
    id: 'card_transfer',
    title: 'Оплата на картку',
    note: 'Оператор надішле реквізити, коли підтвердить замовлення',
  },
];

interface Form {
  name: string;
  phone: string;
  city: string;
  branch: string;
  comment: string;
  payment: PaymentMethod;
  website: string;
}

type Errors = Partial<Record<'name' | 'phone' | 'city' | 'branch', string>>;

function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim().length < 2) errors.name = 'Вкажіть ім’я та прізвище';
  if (!isCompletePhone(form.phone)) errors.phone = 'Вкажіть номер повністю: +380 XX XXX XX XX';
  if (form.city.trim().length < 2) errors.city = 'Вкажіть місто';
  if (!form.branch.trim()) errors.branch = 'Вкажіть номер відділення або поштомата';
  return errors;
}

function Field({
  id,
  label,
  error,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

export function Checkout({ onStockConflict }: { onStockConflict: (message: string) => void }) {
  const items = useCart((s) => s.items);
  const count = useCartCount();
  const { clear, close, applyUnavailable } = useCart.getState();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({
    name: '',
    phone: '+380',
    city: '',
    branch: '',
    comment: '',
    payment: 'cod',
    website: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = submitted ? validate(form) : {};
  const update =
    (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({
        ...f,
        [key]: key === 'phone' ? formatPhone(e.target.value) : e.target.value,
      }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(validate(form)).length > 0) return;

    setSending(true);
    try {
      const order = await createOrder({
        customer_name: form.name.trim(),
        phone: form.phone,
        city: form.city.trim(),
        np_branch: form.branch.trim(),
        payment_method: form.payment,
        comment: form.comment.trim(),
        items: items.map((i) => ({ slug: i.slug, qty: i.qty })),
        website: form.website,
      });
      trackPurchase(order.number, order.items_total, items);
      clear();
      close();
      navigate(`/order/${order.number}`, { state: order });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        applyUnavailable((error.body as OutOfStockBody).items);
        onStockConflict('Поки ви оформлювали, частину товарів розкупили. Перевірте кошик.');
      } else if (error instanceof ApiError && error.status === 429) {
        setServerError('Забагато спроб. Спробуйте за кілька хвилин.');
      } else if (error instanceof ApiError && error.status === 422) {
        setServerError('Перевірте правильність заповнення полів.');
      } else {
        setServerError('Не вдалося надіслати замовлення. Перевірте з’єднання й спробуйте ще раз.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.scroll}>
        <section className={styles.section}>
          <h3>Отримувач</h3>
          <Field
            id="c-name"
            label="Ім’я та прізвище"
            autoComplete="name"
            value={form.name}
            onChange={update('name')}
            error={errors.name}
          />
          <Field
            id="c-phone"
            label="Телефон"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={update('phone')}
            error={errors.phone}
          />
        </section>

        <section className={styles.section}>
          <h3>Доставка Новою поштою</h3>
          <Field
            id="c-city"
            label="Місто"
            autoComplete="address-level2"
            value={form.city}
            onChange={update('city')}
            error={errors.city}
          />
          <Field
            id="c-branch"
            label="Відділення або поштомат"
            placeholder="Номер або адреса"
            value={form.branch}
            onChange={update('branch')}
            error={errors.branch}
          />
        </section>

        <fieldset className={styles.section}>
          <legend>Оплата</legend>
          {PAYMENTS.map((p) => (
            <label key={p.id} className={styles.payment}>
              <input
                type="radio"
                name="payment"
                value={p.id}
                checked={form.payment === p.id}
                onChange={() => setForm((f) => ({ ...f, payment: p.id }))}
              />
              <span className={styles.paymentText}>
                <strong>{p.title}</strong>
                <span>{p.note}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="c-comment">Коментар до замовлення</label>
          <textarea
            id="c-comment"
            rows={2}
            maxLength={1000}
            value={form.comment}
            onChange={update('comment')}
          />
        </div>

        {/* Honeypot: invisible to people, bots fill it in. */}
        <input
          className="visually-hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          name="website"
          value={form.website}
          onChange={update('website')}
        />

        <section className={styles.summary}>
          <div>
            <span>Товари ({itemsLabel(count)})</span>
            <span>{formatPrice(cartTotal(items))}</span>
          </div>
          <div>
            <span>Доставка</span>
            <span className={styles.muted}>за тарифами Нової пошти</span>
          </div>
          <div className={styles.summaryTotal}>
            <span>Разом</span>
            <span>{formatPrice(cartTotal(items))}</span>
          </div>
        </section>
      </div>

      <div className={styles.footer}>
        {serverError && (
          <p className={styles.serverError} role="alert">
            {serverError}
          </p>
        )}
        <button type="submit" className="btn btn-lg btn-primary" disabled={sending}>
          {sending ? 'Надсилаємо…' : 'Підтвердити замовлення'}
        </button>
        <p className={styles.note}>Оператор зателефонує, щоб підтвердити замовлення.</p>
        <p className={styles.note}>
          Підтверджуючи замовлення, ви погоджуєтеся з умовами{' '}
          <a href="/offer" target="_blank" rel="noopener">
            Договору оферти
          </a>{' '}
          та{' '}
          <a href="/privacy" target="_blank" rel="noopener">
            Політикою конфіденційності
          </a>
          .
        </p>
      </div>
    </form>
  );
}
