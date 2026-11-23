import { getProducts, type Illustration } from '@fruchi/api-client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { CardIcon, ChatIcon, FacebookIcon, InstagramIcon, TruckIcon } from '../components/Icons';
import { ProductCard } from '../components/ProductCard';
import { Slice } from '../components/Slice';
import { SITE } from '../lib/site';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './HomePage.module.css';

// Slice composition in the hero circle: [fruit, left %, top %, size %, rotation deg].
const HERO_SLICES: [Illustration, number, number, number, number][] = [
  ['apple', 30, 30, 40, 0],
  ['orange', 37, 1, 26, -12],
  ['pineapple', 71, 26, 26, 18],
  ['lemon', 58, 66, 26, -8],
  ['banana', 16, 66, 26, 10],
  ['pear', 3, 26, 26, -20],
];

const STEPS = [
  ['Обираємо стиглі фрукти', 'Беремо лише ті, які й свіжими з’їли б із задоволенням.'],
  ['Нарізаємо тонко', 'Скибки однакової товщини сохнуть рівномірно й гарно хрумтять.'],
  ['Сушимо до хрусту', 'Повільно, без поспіху: смак фрукта стає яскравішим.'],
];

const DELIVERY = [
  { icon: TruckIcon, title: 'Нова пошта по Україні', text: 'У відділення або поштомат.' },
  {
    icon: CardIcon,
    title: 'Оплата як зручно',
    text: 'При отриманні або переказом на картку.',
  },
  { icon: ChatIcon, title: 'Є питання?', text: 'Телефонуйте або пишіть у Direct в Instagram.' },
];

function Hero() {
  return (
    <section aria-labelledby="hero-title" className={`container ${styles.hero}`}>
      <div className={styles.heroText}>
        <h1 id="hero-title" className={styles.heroTitle}>
          Фрукти, що хрумтять
        </h1>
        <p className={styles.heroLead}>
          Тонко нарізані й висушені фруктові чіпси: яблуко, груша, банан, апельсин, лимон та ананас.
          Смаколик, який легко взяти з собою на роботу, в школу чи в дорогу.
        </p>
        <div className={styles.heroActions}>
          <Link to="/#catalog" className="btn btn-lg btn-primary">
            Обрати чіпси
          </Link>
          <Link to="/#how" className={`btn btn-lg btn-outline ${styles.secondaryCta}`}>
            Як ми сушимо
          </Link>
        </div>
      </div>
      <div className={styles.heroArt}>
        <div className={styles.heroCircle}>
          {HERO_SLICES.map(([fruit, left, top, size, rotate]) => (
            <div
              key={fruit}
              className={styles.heroSlice}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${size}%`,
                transform: `rotate(${rotate}deg)`,
              }}
            >
              <Slice fruit={fruit} decorative />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Catalog() {
  const products = useQuery({ queryKey: ['products'], queryFn: () => getProducts() });

  return (
    <section id="catalog" aria-labelledby="catalog-title" className={`container ${styles.catalog}`}>
      <div className={styles.catalogHead}>
        <h2 id="catalog-title" className="section-title">
          Фруктові чіпси
        </h2>
      </div>
      {products.isPending ? (
        <p className={styles.state}>Завантажуємо смаки…</p>
      ) : products.isError ? (
        <p className={styles.state} role="alert">
          Не вдалося завантажити каталог. Спробуйте оновити сторінку.
        </p>
      ) : products.data.length === 0 ? (
        <p className={styles.state}>Скоро тут з’являться наші чіпси.</p>
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

function HowWeMake() {
  return (
    <section id="how" aria-labelledby="how-title" className={styles.how}>
      <div className={`container ${styles.howInner}`}>
        <h2 id="how-title" className="section-title">
          Як ми робимо чіпси
        </h2>
        <ol className={styles.steps}>
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span aria-hidden="true" className={styles.stepNo}>
                {i + 1}
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Delivery() {
  return (
    <section
      id="delivery"
      aria-labelledby="delivery-title"
      className={`container ${styles.delivery}`}
    >
      <h2 id="delivery-title" className="section-title">
        Доставка й оплата
      </h2>
      <div className={styles.deliveryGrid}>
        {DELIVERY.map(({ icon: Icon, title, text }) => (
          <div key={title} className={styles.deliveryItem}>
            <span className={styles.deliveryIcon}>
              <Icon size={26} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Social() {
  return (
    <section aria-labelledby="insta-title" className={styles.social}>
      <div className={`container ${styles.socialInner}`}>
        <div className={styles.socialHead}>
          <div>
            <h2 id="insta-title" className="section-title">
              Fruchi в соцмережах
            </h2>
            <p>Нові смаки, ідеї для перекусу та розіграші — {SITE.instagramHandle}</p>
          </div>
          <div className={styles.socialLinks}>
            <a href={SITE.instagram} className="btn btn-dark">
              <InstagramIcon size={20} />
              Instagram
            </a>
            {SITE.facebook && (
              <a href={SITE.facebook} className="btn btn-outline-dark">
                <FacebookIcon size={20} />
                Facebook
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  useDocumentTitle(undefined);
  return (
    <>
      <Hero />
      <Catalog />
      <HowWeMake />
      <Delivery />
      <Social />
    </>
  );
}
