import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../lib/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Сторінку не знайдено', true);
  return (
    <section className="container" style={{ padding: '96px var(--gutter)' }}>
      <h1 className="section-title">Сторінку не знайдено</h1>
      <p>Можливо, товар більше не продається або посилання застаріло.</p>
      <Link to="/" className="btn btn-primary">
        На головну
      </Link>
    </section>
  );
}
