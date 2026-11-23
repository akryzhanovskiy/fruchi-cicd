import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { SITE } from './site';

// Keep in sync with backend/app/services/meta.py (crawlers get the server-rendered version).
export const DEFAULT_TITLE = 'Фруктові чіпси та сушені фрукти з доставкою по Україні | Fruchi';
export const DEFAULT_DESCRIPTION =
  'Fruchi — тонко нарізані й висушені фруктові чіпси без цукру. Доставка Новою поштою по Україні.';

interface PageMeta {
  /** Page name; the site name is appended. Undefined — the home page title. */
  title?: string;
  description?: string;
  /** Absolute or root-relative image for link previews. */
  image?: string | null;
  /** Tell search engines not to index the page (order confirmations etc.). */
  noindex?: boolean;
  ogType?: 'website' | 'product';
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

const absolute = (url: string) => (url.startsWith('http') ? url : `${SITE.url}${url}`);

/**
 * Title, description, canonical URL and Open Graph tags for the current page.
 * Search engines render JS and pick these up; messengers read the static defaults
 * from index.html.
 */
export function usePageMeta({ title, description, image, noindex, ogType = 'website' }: PageMeta) {
  const { pathname } = useLocation();
  useEffect(() => {
    const fullTitle = title ? `${title} | Fruchi` : DEFAULT_TITLE;
    const desc = description?.trim() || DEFAULT_DESCRIPTION;
    const url = `${SITE.url}${pathname}`;
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex' : 'index, follow');
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', absolute(image || '/og-image.png'));
    setCanonical(url);
  }, [title, description, image, noindex, ogType, pathname]);
}
