import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LatLngExpression } from 'leaflet';
import { Marker } from 'react-leaflet';
import type { MarkerProps } from 'react-leaflet';

function toTuple(p: LatLngExpression): [number, number] {
  if (Array.isArray(p)) {
    return [p[0], p[1]];
  }
  return [p.lat, p.lng];
}

type Props = Omit<MarkerProps, 'position'> & {
  position: LatLngExpression;
  /** Animáció hossza ms-ban */
  duration?: number;
  children?: ReactNode;
};

/**
 * Leaflet Marker, amely pozícióváltáskor ease-out görbével csúszik az új helyre (nem ugrik).
 */
export default function SmoothAnimatedMarker({
  position,
  duration = 420,
  children,
  ...markerProps
}: Props) {
  const target = toTuple(position);
  const endLat = target[0];
  const endLng = target[1];
  const [display, setDisplay] = useState<[number, number]>(target);
  const displayRef = useRef(display);
  const rafRef = useRef<number>();
  const isFirstRender = useRef(true);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const end: [number, number] = [endLat, endLng];

    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplay(end);
      return;
    }

    const start = displayRef.current;
    if (start[0] === endLat && start[1] === endLng) {
      return;
    }

    const t0 = performance.now();

    const tick = (now: number) => {
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - t) ** 3;
      const lat = start[0] + (endLat - start[0]) * eased;
      const lng = start[1] + (endLng - start[1]) * eased;
      setDisplay([lat, lng]);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [endLat, endLng, duration]);

  return (
    <Marker position={display} {...markerProps}>
      {children}
    </Marker>
  );
}
