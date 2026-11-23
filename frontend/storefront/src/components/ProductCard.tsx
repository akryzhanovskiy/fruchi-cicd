import type { ProductCard as Product } from '@fruchi/api-client';
import { Link } from 'react-router-dom';

import { formatPrice, formatWeight } from '../lib/format';
import { useCart, useCartQty } from '../store/cart';
import { PlusIcon } from './Icons';
import styles from './ProductCard.module.css';
import { ProductMedia } from './ProductMedia';
import { QtyStepper } from './QtyStepper';

export function ProductCard({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const qty = useCartQty(product.slug);
  const href = `/product/${product.slug}`;
  const atLimit = qty >= product.max_qty;

  return (
    <article className={styles.card}>
      <Link to={href} aria-label={`${product.name} — детальніше`} className={styles.mediaLink}>
        <ProductMedia
          className={styles.media}
          image={product.image}
          illustration={product.illustration}
          accentColor={product.accent_color}
        />
        {!product.in_stock && <span className={styles.badge}>Скінчився</span>}
      </Link>
      <div className={styles.body}>
        <h3 className={styles.name}>
          <Link to={href}>{product.name}</Link>
        </h3>
        <p className={styles.desc}>{product.short_desc}</p>
        <div className={styles.footer}>
          <div className={styles.price}>
            <strong>{formatPrice(product.price)}</strong>
            <span>{formatWeight(product.weight_g)}</span>
          </div>
          {!product.in_stock ? (
            <button
              type="button"
              className={`btn btn-soldout ${styles.action}`}
              aria-label="Скінчився"
              disabled
            >
              <PlusIcon size={20} className={styles.mobileOnly} />
              <span className={styles.desktopOnly}>Скінчився</span>
            </button>
          ) : qty === 0 ? (
            <button
              type="button"
              className={`btn btn-primary ${styles.action}`}
              aria-label={`Додати «${product.name}» в кошик`}
              onClick={() => add(product)}
            >
              <PlusIcon size={20} className={styles.mobileOnly} />
              <span className={styles.desktopOnly}>У кошик</span>
            </button>
          ) : (
            <QtyStepper
              size="sm"
              min={0}
              value={qty}
              max={product.max_qty}
              onChange={(value) => setQty(product.slug, value)}
              decreaseLabel="Прибрати одну пачку"
              increaseLabel={atLimit ? 'Більше немає в наявності' : 'Додати ще одну пачку'}
              className={`${styles.stepper} anim-appear`}
            />
          )}
        </div>
      </div>
    </article>
  );
}
