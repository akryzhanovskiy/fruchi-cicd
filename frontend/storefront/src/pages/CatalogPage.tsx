import { getCategories, getProducts } from '@fruchi/api-client';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { BackIcon } from '../components/Icons';
import { ProductCard } from '../components/ProductCard';
import { usePageMeta } from '../lib/usePageMeta';
import styles from './HomePage.module.css';
import { NotFoundPage } from './NotFoundPage';

export function CatalogPage() {
  const { category = '' } = useParams();
  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const products = useQuery({
    queryKey: ['products', category],
    queryFn: () => getProducts(category),
  });
  const current = categories.data?.find((c) => c.slug === category);
  usePageMeta({ title: current?.meta_title, description: current?.meta_description });

  if (categories.isSuccess && !current) return <NotFoundPage />;

  return (
    <section aria-labelledby="catalog-title" className={`container ${styles.catalog}`}>
      <Link to="/" className={styles.backLink}>
        <BackIcon size={20} />
        На головну
      </Link>
      <div className={styles.catalogHead}>
        <h1 id="catalog-title" className="section-title">
          {current?.name ?? 'Каталог'}
        </h1>
        {current?.description && <p className={styles.catalogLead}>{current.description}</p>}
      </div>
      {products.isPending || categories.isPending ? (
        <p className={styles.state}>Завантажуємо смаки…</p>
      ) : products.isError || categories.isError ? (
        <p className={styles.state} role="alert">
          Не вдалося завантажити каталог. Спробуйте оновити сторінку.
        </p>
      ) : products.data.length === 0 ? (
        <p className={styles.state}>У цій категорії поки немає товарів.</p>
      ) : (
        <div className={styles.grid}>
          {products.data.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
