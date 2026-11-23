import {
  ApiError,
  getProduct,
  getProducts,
  type ProductCard,
  type ProductDetail,
} from '@fruchi/api-client';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BackIcon, CheckIcon } from '../components/Icons';
import { ProductMedia } from '../components/ProductMedia';
import { RichText } from '../components/RichText';
import { QtyStepper } from '../components/QtyStepper';
import { trackViewItem } from '../lib/analytics';
import { formatPrice, formatWeight } from '../lib/format';
import { usePageMeta } from '../lib/usePageMeta';
import { useCart, useCartQty } from '../store/cart';
import { NotFoundPage } from './NotFoundPage';
import styles from './ProductPage.module.css';

function Gallery({ product }: { product: ProductDetail }) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const slides = product.images.length > 0 ? product.images : [null];

  // The photos sit in a horizontal scroll-snap strip: swipe on touch screens,
  // thumbnails / dots scroll it, and scrolling tells which photo is shown.
  const show = (index: number) => {
    setActive(index);
    const el = track.current;
    if (!el) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo?.({ left: index * el.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className={styles.gallery}>
      <div ref={track} className={styles.track} onScroll={onScroll}>
        {slides.map((image, i) => (
          <ProductMedia
            key={image?.url ?? 'illustration'}
            className={styles.mainImage}
            image={image}
            illustration={product.illustration}
            accentColor={product.accent_color}
            sliceSize="62%"
            priority={i === 0}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <div className={styles.thumbs}>
            {product.images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                aria-label={`Фото ${i + 1}`}
                aria-pressed={i === active}
                className={styles.thumb}
                onClick={() => show(i)}
              >
                <img src={img.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <div className={styles.dots} aria-label={`Фото ${active + 1} з ${product.images.length}`}>
            {product.images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                aria-label={`Фото ${i + 1}`}
                className={i === active ? styles.dotActive : undefined}
                onClick={() => show(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BuyBox({ product }: { product: ProductDetail }) {
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.open);
  const inCart = useCartQty(product.slug);
  const available = Math.max(product.max_qty - inCart, 0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const change = (value: number) => {
    setQty(value);
    setAdded(false);
  };
  const submit = () => {
    add(product, qty);
    setQty(1);
    setAdded(true);
  };

  if (!product.in_stock) {
    return (
      <div className={styles.buy}>
        <button type="button" className="btn btn-lg btn-soldout" disabled>
          Скінчився
        </button>
        <p className={styles.note}>Цей смак тимчасово закінчився — скоро повернемо.</p>
      </div>
    );
  }

  // "Added" only while the product is still in the cart: removing it from the drawer
  // brings the regular "Додати в кошик" button back.
  const action =
    added && inCart > 0 ? (
      <button
        type="button"
        className={`btn btn-lg btn-added anim-appear ${styles.cta}`}
        onClick={openCart}
      >
        <CheckIcon size={20} className="anim-check" />
        <span className={styles.ctaLong}>Додано до кошика</span>
        <span className={styles.ctaShort}>Перейти в кошик</span>
      </button>
    ) : (
      <button
        type="button"
        className={`btn btn-lg btn-primary ${styles.cta}`}
        disabled={available === 0}
        onClick={submit}
      >
        {available === 0 ? (
          <span>Усі пачки вже в кошику</span>
        ) : (
          <span>
            <span className={styles.ctaLong}>Додати в кошик</span>
            <span className={styles.ctaShort}>У кошик</span>
          </span>
        )}
        <span className={styles.ctaPrice}>{formatPrice(product.price * qty)}</span>
      </button>
    );

  return (
    <div className={styles.buy}>
      <QtyStepper value={qty} max={Math.max(available, 1)} onChange={change} />
      {action}
    </div>
  );
}

function Details({ product }: { product: ProductDetail }) {
  const sections = [
    ['Склад', product.composition],
    ['Харчова цінність', product.nutrition],
    ['Зберігання', product.storage],
  ].filter(([, text]) => text.trim());

  return (
    <div className={styles.details}>
      {sections.map(([title, text], i) => (
        <details key={title} open={i === 0}>
          <summary>{title}</summary>
          <RichText text={text} className={styles.detailsText} />
        </details>
      ))}
      <details open={sections.length === 0}>
        <summary>Доставка й оплата</summary>
        <p>Новою поштою по Україні. Оплата при отриманні або переказом на картку.</p>
      </details>
    </div>
  );
}

function OtherFlavours({ product }: { product: ProductDetail }) {
  const products = useQuery({
    queryKey: ['products', product.category],
    queryFn: () => getProducts(product.category),
  });
  const others = products.data?.filter((p) => p.slug !== product.slug) ?? [];
  if (others.length === 0) return null;

  return (
    <section aria-labelledby="more-title" className={styles.more}>
      <h2 id="more-title">Інші смаки</h2>
      <div className={styles.moreList}>
        {others.map((p) => (
          <Link key={p.slug} to={`/product/${p.slug}`} className={styles.moreItem}>
            <ProductMedia
              className={styles.moreImage}
              image={p.image}
              illustration={p.illustration}
              accentColor={p.accent_color}
              sliceSize="58%"
            />
            <span className={styles.moreName}>{p.name}</span>
            <span className={styles.morePrice}>
              {p.in_stock ? formatPrice(p.price) : 'Скінчився'}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * The product's card from an already loaded catalog list, shown while the full product
 * loads: the page opens at once with its name, price and photo instead of a blank
 * "loading" state that makes the footer jump up for a moment.
 */
function cardPlaceholder(queryClient: QueryClient, slug: string): ProductDetail | undefined {
  for (const [, list] of queryClient.getQueriesData<ProductCard[]>({ queryKey: ['products'] })) {
    const card = list?.find((p) => p.slug === slug);
    if (card) {
      return {
        ...card,
        description: card.short_desc,
        composition: '',
        nutrition: '',
        storage: '',
        images: card.image ? [card.image] : [],
        meta_title: card.name,
        meta_description: card.short_desc,
      };
    }
  }
  return undefined;
}

export function ProductPage() {
  const { slug = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug),
    placeholderData: () => cardPlaceholder(queryClient, slug),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  // The card placeholder (from the catalog list) has no meta: wait for the full product.
  const detail = query.isPlaceholderData ? undefined : query.data;
  usePageMeta({
    title: detail?.meta_title,
    description: detail?.meta_description,
    image: detail?.images[0]?.url,
    ogType: 'product',
  });
  useEffect(() => {
    if (detail) trackViewItem({ slug: detail.slug, name: detail.name, price: detail.price });
    // Once per product, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.slug]);

  if (query.error instanceof ApiError && query.error.status === 404) {
    return <NotFoundPage />;
  }
  if (query.isPending || query.isError) {
    return (
      <div className={`container ${styles.state}`} role={query.isError ? 'alert' : undefined}>
        {query.isError
          ? 'Не вдалося завантажити товар. Спробуйте оновити сторінку.'
          : 'Завантаження…'}
      </div>
    );
  }

  const product = query.data;
  return (
    <div className={`container ${styles.page}`}>
      <Link to="/#catalog" className={styles.back} aria-label="До каталогу">
        <BackIcon size={20} />
        <span className={styles.backText}>До каталогу</span>
      </Link>

      {/* Remount per product so gallery and quantity state reset on navigation. */}
      <div key={product.slug} className={styles.main}>
        <Gallery product={product} />
        <div className={styles.info}>
          <div className={styles.heading}>
            <h1>{product.name}</h1>
            <RichText
              text={product.description || product.short_desc}
              className={styles.description}
            />
          </div>
          <div className={styles.price}>
            <strong>{formatPrice(product.price)}</strong>
            <span>за {formatWeight(product.weight_g)}</span>
          </div>
          <BuyBox product={product} />
          {!query.isPlaceholderData && <Details product={product} />}
        </div>
      </div>

      <OtherFlavours product={product} />
    </div>
  );
}
