import { useState } from 'react';
import type { CSSProperties, ImgHTMLAttributes } from 'react';

const CANONICAL_LOGO = '/flixo-logo.webp?v=20260920';
const FALLBACK_LOGO = '/flixo-favicon.png?v=20260920';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  readonly width?: number;
  readonly height?: number;
  readonly wrapperStyle?: CSSProperties;
};

export function FlixoLogoImage({
  width = 40,
  height = 40,
  alt = 'FLIXO AI Tools',
  wrapperStyle,
  style,
  ...props
}: Props) {
  const [src, setSrc] = useState(CANONICAL_LOGO);
  const fallbackActive = src !== CANONICAL_LOGO;
  const wrapper: CSSProperties = {
    display: 'inline-grid',
    placeItems: 'center',
    width,
    height,
    backgroundImage: `url("${FALLBACK_LOGO}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    ...wrapperStyle,
  };

  return (
    <span aria-hidden={alt ? undefined : true} style={wrapper}>
      <img
        {...props}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="eager"
        decoding="async"
        draggable={false}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', ...style }}
        onError={() => {
          if (!fallbackActive) setSrc(FALLBACK_LOGO);
        }}
      />
    </span>
  );
}
