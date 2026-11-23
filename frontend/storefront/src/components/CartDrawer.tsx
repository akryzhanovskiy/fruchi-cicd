import { validateCart } from '@fruchi/api-client';
import { useEffect, useRef, useState } from 'react';

import { trackBeginCheckout } from '../lib/analytics';
import { formatPrice, formatWeight } from '../lib/format';
import { itemsLabel } from '../lib/plural';
import { cartTotal, isProblem, useCart, useCartCount, type CartItem } from '../store/cart';
import styles from './CartDrawer.module.css';
import { Checkout } from './Checkout';
import { BackIcon, CloseIcon, MinusIcon, PlusIcon } from './Icons';
import { ProductMedia } from './ProductMedia';
import { Slice } from './Slice';

type Step = 'cart' | 'checkout';

/** Matches the slide-out animation in CartDrawer.module.css. */
const CLOSE_ANIMATION_MS = 220;

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function CartLine({ item }: { item: CartItem }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const soldOut = item.maxQty === 0;
  const tooMany = !soldOut && item.qty > item.maxQty;

  return (
    <li className={`${styles.line} ${soldOut ? styles.lineMuted : ''}`}>
      <ProductMedia
        className={styles.lineImage}
        image={item.imageUrl ? { url: item.imageUrl, alt: '' } : null}
        illustration={item.illustration}
        accentColor={item.accent_color}
        sliceSize="66%"
      />
      <div className={styles.lineBody}>
        <div className={styles.lineTop}>
          <div>
            <div className={styles.lineName}>{item.name}</div>
            <div className={styles.lineMeta}>{formatWeight(item.weight_g)}</div>
          </div>
          <button
            type="button"
            className={styles.remove}
            aria-label={`Видалити «${item.name}»`}
            onClick={() => remove(item.slug)}
          >
            <CloseIcon size={18} />
          </button>
        </div>
        {soldOut ? (
          <p className={styles.lineWarning}>Скінчився — видаліть, щоб оформити замовлення</p>
        ) : (
          <>
            <div className={styles.lineBottom}>
              <div className={styles.stepper}>
                <button
                  type="button"
                  aria-label="Менше"
                  onClick={() => setQty(item.slug, Math.min(item.qty, item.maxQty) - 1)}
                >
                  <MinusIcon size={18} />
                </button>
                <span aria-label={`Кількість: ${item.qty}`}>{item.qty}</span>
                <button
                  type="button"
                  aria-label="Більше"
                  disabled={item.qty >= item.maxQty}
                  onClick={() => setQty(item.slug, item.qty + 1)}
                >
                  <PlusIcon size={18} />
                </button>
              </div>
              <strong>{formatPrice(item.price * item.qty)}</strong>
            </div>
            {tooMany && (
              <p className={styles.lineWarning}>
                В наявності лише {item.maxQty} — зменшіть кількість
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function CartStep({ onCheckout }: { onCheckout: () => void }) {
  const items = useCart((s) => s.items);
  const close = useCart((s) => s.close);
  const hasProblems = items.some(isProblem);

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyArt}>
          <Slice fruit="apple" decorative />
        </div>
        <h3>Кошик порожній</h3>
        <p>Оберіть смак у каталозі — додавати можна одним дотиком.</p>
        <button type="button" className="btn btn-primary" onClick={close}>
          До каталогу
        </button>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <ul className={styles.lines}>
        {items.map((item) => (
          <CartLine key={item.slug} item={item} />
        ))}
      </ul>
      <div className={styles.footer}>
        <div className={styles.total}>
          <span>Разом</span>
          <strong>{formatPrice(cartTotal(items))}</strong>
        </div>
        <p className={styles.hint}>Доставка — за тарифами Нової пошти.</p>
        <button
          type="button"
          className="btn btn-lg btn-primary"
          disabled={hasProblems}
          onClick={onCheckout}
        >
          Оформити замовлення
        </button>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const sync = useCart((s) => s.sync);
  const count = useCartCount();
  const [step, setStep] = useState<Step>('cart');
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // On open: refresh prices/availability, lock page scroll, focus the panel, close on Esc.
  useEffect(() => {
    if (!isOpen) return;
    setStep('cart');
    setNotice(null);
    const slugs = useCart.getState().items.map((i) => i.slug);
    if (slugs.length) {
      validateCart(slugs)
        .then(sync)
        .catch(() => {});
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [isOpen, close, sync]);

  // Stay mounted after `close()` until the slide-out animation ends.
  const [mounted, setMounted] = useState(isOpen);
  if (isOpen && !mounted) setMounted(true);
  if (!isOpen && mounted && prefersReducedMotion()) setMounted(false);
  const closing = mounted && !isOpen;

  // Fallback: `animationend` never fires in a background tab, so don't wait for it forever.
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setMounted(false), CLOSE_ANIMATION_MS + 100);
    return () => clearTimeout(timer);
  }, [closing]);

  if (!mounted) return null;

  const backToCart = (message?: string) => {
    setNotice(message ?? null);
    setStep('cart');
  };

  return (
    <div className={`${styles.root} ${closing ? styles.closing : ''}`}>
      <div className={styles.backdrop} onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        tabIndex={-1}
        onAnimationEnd={(e) => closing && e.target === e.currentTarget && setMounted(false)}
      >
        <header className={styles.header}>
          {step === 'checkout' ? (
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Назад до кошика"
              onClick={() => backToCart()}
            >
              <BackIcon />
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.iconButton} ${styles.mobileOnly}`}
              aria-label="Повернутися до покупок"
              onClick={close}
            >
              <BackIcon />
            </button>
          )}
          <h2 id="cart-title">{step === 'checkout' ? 'Оформлення' : 'Кошик'}</h2>
          <span className={styles.count}>{count > 0 && itemsLabel(count)}</span>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.desktopOnly}`}
            aria-label="Закрити кошик"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </header>
        {notice && (
          <p className={styles.notice} role="alert">
            {notice}
          </p>
        )}
        {step === 'cart' ? (
          <CartStep
            onCheckout={() => {
              trackBeginCheckout(useCart.getState().items);
              setStep('checkout');
            }}
          />
        ) : (
          <Checkout onStockConflict={backToCart} />
        )}
      </div>
    </div>
  );
}
