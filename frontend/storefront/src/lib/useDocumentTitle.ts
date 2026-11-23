import { usePageMeta } from './usePageMeta';

/** Shortcut for pages that only need a title. */
export function useDocumentTitle(title: string | undefined, noindex = false) {
  usePageMeta({ title, noindex });
}
