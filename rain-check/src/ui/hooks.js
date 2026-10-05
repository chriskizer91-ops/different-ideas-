import { useEffect, useRef, useState } from 'preact/hooks';

// The width of an element, kept up to date as it resizes.
export function useWidth(initial = 340) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || initial);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// A small seeded random generator, so drawings stay the same between visits.
export function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let s = (h >>> 0) % 2147483646 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
