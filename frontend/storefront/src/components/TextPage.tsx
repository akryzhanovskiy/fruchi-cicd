import type { ReactNode } from 'react';

import { SITE } from '../lib/site';
import { usePageMeta } from '../lib/usePageMeta';
import styles from './TextPage.module.css';

interface Props {
  title: string;
  description: string;
  /** Shown under the title, e.g. "Редакція від …". */
  meta?: string;
  children: ReactNode;
}

/** Layout for long text pages: delivery terms, offer agreement, privacy policy. */
export function TextPage({ title, description, meta, children }: Props) {
  usePageMeta({ title, description });
  return (
    <article className={`container ${styles.page}`}>
      <h1 className={styles.title}>{title}</h1>
      {meta && <p className={styles.meta}>{meta}</p>}
      <div className={styles.body}>{children}</div>
    </article>
  );
}

/** Seller details (ФОП) — a visible placeholder until they're known. */
export function Seller() {
  return SITE.seller ? <>{SITE.seller}</> : <span className={styles.todo}>[]</span>;
}
