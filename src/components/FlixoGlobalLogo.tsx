import { useRef } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { FlixoLogoImage } from './FlixoLogoImage';

const ADMIN_ENTRY_PATH = '/admin';
const ADMIN_CLICK_WINDOW_MS = 2000;
const ADMIN_CLICK_COUNT = 5;

const shellStyle: CSSProperties = {
  position: 'fixed',
  insetBlockStart: 14,
  insetInlineStart: 14,
  zIndex: 9999,
  width: 'clamp(68px, 8vw, 92px)',
  aspectRatio: '1',
  padding: 4,
  border: '1px solid rgba(103, 232, 249, 0.42)',
  borderRadius: 20,
  background: 'rgba(6, 13, 20, 0.82)',
  boxShadow: '0 14px 40px rgba(0, 0, 0, 0.38), 0 0 26px rgba(20, 207, 222, 0.12)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  display: 'grid',
  placeItems: 'center',
  transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
};

const imageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  borderRadius: 16,
  objectFit: 'contain',
};

export function FlixoGlobalLogo() {
  const clickCountRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAdminGesture = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    clickCountRef.current += 1;

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
      resetTimerRef.current = null;
    }, ADMIN_CLICK_WINDOW_MS);

    if (clickCountRef.current === ADMIN_CLICK_COUNT) {
      clickCountRef.current = 0;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
      window.location.assign(ADMIN_ENTRY_PATH);
    }
  };

  return (
    <a
      href="/"
      aria-label="FLIXO AI Tools"
      title="FLIXO AI Tools"
      style={shellStyle}
      onClick={handleAdminGesture}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
        event.currentTarget.style.borderColor = 'rgba(103, 232, 249, 0.8)';
        event.currentTarget.style.boxShadow = '0 18px 46px rgba(0, 0, 0, 0.44), 0 0 30px rgba(20, 207, 222, 0.18)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'none';
        event.currentTarget.style.borderColor = 'rgba(103, 232, 249, 0.42)';
        event.currentTarget.style.boxShadow = '0 14px 40px rgba(0, 0, 0, 0.38), 0 0 26px rgba(20, 207, 222, 0.12)';
      }}
    >
      <FlixoLogoImage
        alt="FLIXO AI Tools"
        width={192}
        height={192}
        style={imageStyle}
      />
    </a>
  );
}
