import type { Illustration, ProductImage } from '@fruchi/api-client';

import styles from './ProductMedia.module.css';
import { Slice } from './Slice';

interface Props {
  image: ProductImage | null;
  illustration: Illustration | null;
  accentColor: string;
  /** Width of the illustration relative to the tile, e.g. "56%". */
  sliceSize?: string;
  className?: string;
  /** Above-the-fold image: load immediately instead of lazily. */
  priority?: boolean;
}

/** Product photo, or the fruit illustration on its flavour colour while there are no photos. */
export function ProductMedia({
  image,
  illustration,
  accentColor,
  sliceSize = '56%',
  className,
  priority = false,
}: Props) {
  return (
    <div className={`${styles.tile} ${className ?? ''}`} style={{ background: accentColor }}>
      {image ? (
        <img
          className={styles.photo}
          src={image.url}
          alt={image.alt}
          loading={priority ? 'eager' : 'lazy'}
        />
      ) : illustration ? (
        <div style={{ width: sliceSize, aspectRatio: '1 / 1' }}>
          <Slice fruit={illustration} decorative />
        </div>
      ) : null}
    </div>
  );
}
