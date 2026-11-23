import type { OrderCreated } from '@fruchi/api-client';
import { Link, useLocation, useParams } from 'react-router-dom';

import { CheckIcon } from '../components/Icons';
import { formatPrice, formatWeight } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './OrderSuccessPage.module.css';

export function OrderSuccessPage() {
  const { number } = useParams();
  // Order details come from navigation state; after a page reload only the number is known.
  const order = useLocation().state as OrderCreated | null;
  useDocumentTitle('Дякуємо за замовлення', true);

  return (
    <section className={`container ${styles.page}`}>
      <span className={styles.badge} aria-hidden="true">
        <CheckIcon size={40} />
      </span>
      <h1>Дякуємо за замовлення!</h1>
      <p className={styles.number}>
        Номер замовлення: <strong>{number}</strong>
      </p>
      <p className={styles.lead}>
        Оператор зателефонує найближчим часом, щоб підтвердити замовлення.
        {order?.payment_method === 'card_transfer' &&
          ' Під час підтвердження він надішле реквізити для оплати на картку.'}
        {order?.payment_method === 'cod' && ' Оплата — при отриманні у Новій пошті.'}
      </p>

      {order && (
        <div className={styles.summary}>
          <ul>
            {order.items.map((item) => (
              <li key={item.name}>
                <span>
                  {item.name}, {formatWeight(item.weight_g)} × {item.qty}
                </span>
                <span>{formatPrice(item.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className={styles.total}>
            <span>Разом</span>
            <span>{formatPrice(order.items_total)}</span>
          </div>
          <p>+ доставка за тарифами Нової пошти</p>
        </div>
      )}

      <Link to="/" className="btn btn-lg btn-primary">
        Повернутися до магазину
      </Link>
    </section>
  );
}
