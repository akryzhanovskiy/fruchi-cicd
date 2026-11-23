import { getCategories } from '@fruchi/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { trackPageView } from '../lib/analytics';
import { SITE } from '../lib/site';
import { useBump } from '../lib/useBump';
import { useCart, useCartCount } from '../store/cart';
import { CartDrawer } from './CartDrawer';
import { BagIcon, CloseIcon, FacebookIcon, InstagramIcon, MenuIcon } from './Icons';
import styles from './Layout.module.css';
import { LogoMark } from './Logo';

const NAV = [
  { href: '/#catalog', label: 'Каталог' },
  { href: '/#how', label: 'Як ми сушимо' },
  { href: '/delivery', label: 'Доставка й оплата' },
];

/**
 * Scrolls smoothly to `#hash` targets after navigation, or to the top on a new page.
 * Depends on the location key, so a second click on the same "/#catalog" link scrolls again.
 */
function useScrollOnNavigate() {
  const { pathname, hash, key } = useLocation();
  useEffect(() => {
    if (hash) {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash, key]);
}

function CartButton() {
  const count = useCartCount();
  const open = useCart((s) => s.open);
  const pop = useBump(count) ? 'anim-pop' : '';
  return (
    <>
      <button
        type="button"
        className={styles.cartButton}
        aria-label={`Кошик, товарів: ${count}`}
        onClick={open}
      >
        <BagIcon />
        Кошик
        <span className={`${styles.cartCount} ${pop}`}>{count}</span>
      </button>
      <button
        type="button"
        className={styles.cartIcon}
        aria-label={`Кошик, товарів: ${count}`}
        onClick={open}
      >
        <BagIcon size={24} />
        {count > 0 && <span className={`${styles.cartBadge} ${pop}`}>{count}</span>}
      </button>
    </>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location]);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Меню"
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
        </button>
        <Link to="/" className={styles.brand} aria-label="Fruchi — на головну">
          <LogoMark />
          <span className={styles.brandName}>Fruchi</span>
        </Link>
        <nav
          id="main-nav"
          className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`}
          aria-label="Головне меню"
        >
          {NAV.map((item) => (
            <Link key={item.href} to={item.href}>
              {item.label}
            </Link>
          ))}
          <div className={styles.navSocial}>
            <a href={SITE.instagram} className="btn btn-dark">
              Instagram
            </a>
            {SITE.facebook && (
              <a href={SITE.facebook} className="btn btn-outline-dark">
                Facebook
              </a>
            )}
          </div>
        </nav>
        <div className={styles.actions}>
          <a href={SITE.instagram} className={styles.social} aria-label="Fruchi в Instagram">
            <InstagramIcon />
          </a>
          {SITE.facebook && (
            <a href={SITE.facebook} className={styles.social} aria-label="Fruchi у Facebook">
              <FacebookIcon />
            </a>
          )}
          <CartButton />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerTop}`}>
        <div className={styles.footerBrand}>
          <div className={styles.brand}>
            <LogoMark size={44} inverted />
            <span className={styles.footerName}>Fruchi</span>
          </div>
          <p>Сушені фрукти та корисні ласощі.</p>
        </div>
        <nav aria-label="Магазин" className={styles.footerNav}>
          <span>Магазин</span>
          {categories.data?.length ? (
            categories.data.map((c) => (
              <Link key={c.slug} to={`/catalog/${c.slug}`}>
                {c.name}
              </Link>
            ))
          ) : (
            <Link to="/#catalog">Каталог</Link>
          )}
          <Link to="/delivery">Доставка й оплата</Link>
          <Link to="/offer">Договір оферти</Link>
        </nav>
        <nav aria-label="Контакти" className={styles.footerNav}>
          <span>Контакти</span>
          <a href={SITE.phoneHref}>{SITE.phone}</a>
          <a href={SITE.emailHref}>{SITE.email}</a>
          <a href={SITE.instagram}>Instagram</a>
          {SITE.facebook && <a href={SITE.facebook}>Facebook</a>}
        </nav>
      </div>
      <div className={`container ${styles.footerBottom}`}>
        <span>© {new Date().getFullYear()} Fruchi</span>
        <Link to="/privacy">Політика конфіденційності</Link>
      </div>
    </footer>
  );
}

/** Page views for analytics; runs after the page has set its title. */
function usePageViews() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    // Let the page finish rendering (and set document.title) first.
    const timer = window.setTimeout(() => trackPageView(pathname + search), 300);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);
}

export function Layout() {
  useScrollOnNavigate();
  usePageViews();
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
