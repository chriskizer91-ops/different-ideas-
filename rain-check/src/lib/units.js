// Everything is stored in metric (mm, °C, m/s, m², liters) and converted only for display.

export const isImperial = (u) => u === 'imperial';
export const cToF = (c) => (c * 9) / 5 + 32;
export const fToC = (f) => ((f - 32) * 5) / 9;
export const M2_PER_SQFT = 0.092903;

// The few countries that still use Fahrenheit and inches.
export function defaultUnits() {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const region = (lang.split('-')[1] || '').toUpperCase();
  return ['US', 'LR', 'MM', 'PR', 'GU', 'VI', 'AS'].includes(region) ? 'imperial' : 'metric';
}

function trim(n, digits) {
  return n.toFixed(digits).replace(/\.0+$/, '');
}

export const fmt = {
  depth(mm, u) {
    if (isImperial(u)) {
      const inch = mm / 25.4;
      return `${inch < 0.3 ? inch.toFixed(2) : inch.toFixed(1)} in`;
    }
    return `${mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm`;
  },
  temp(c, u) {
    return c == null || !Number.isFinite(c) ? '?' : `${Math.round(isImperial(u) ? cToF(c) : c)}°`;
  },
  // A temperature with its unit letter, for thresholds: "28°F".
  tempUnit(c, u) {
    return `${Math.round(isImperial(u) ? cToF(c) : c)}°${isImperial(u) ? 'F' : 'C'}`;
  },
  wind(ms, u) {
    return isImperial(u) ? `${Math.round(ms * 2.237)} mph` : `${ms.toFixed(1)} m/s`;
  },
  rootDepth(mm, u) {
    return isImperial(u) ? `${Math.round(mm / 25.4)} inches` : `${Math.round(mm / 10)} cm`;
  },
  // Water for a bed: mm of depth spread over its area.
  bedVolume(mm, areaM2, u) {
    const liters = mm * areaM2;
    if (isImperial(u)) {
      const gal = liters / 3.785;
      return `${gal < 10 ? trim(gal, 1) : Math.round(gal)} gallons`;
    }
    return `${liters < 10 ? trim(liters, 1) : Math.round(liters)} liters`;
  },
  // Any amount of water, in gallons or liters.
  volume(liters, u) {
    if (isImperial(u)) {
      const gal = liters / 3.785;
      return `${gal < 10 ? trim(gal, 1) : Math.round(gal)} gallon${gal === 1 ? '' : 's'}`;
    }
    return `${liters < 10 ? trim(liters, 1) : Math.round(liters)} liter${liters === 1 ? '' : 's'}`;
  },
  // Water for a pot, in kitchen measures.
  potVolume(liters, u) {
    const half = (x) => {
      const w = Math.floor(x);
      const h = x - w > 0;
      return w === 0 ? '½' : `${w}${h ? '½' : ''}`;
    };
    if (isImperial(u)) {
      const cups = liters / 0.2366;
      if (cups < 3.75) {
        const c = Math.max(0.5, Math.round(cups * 2) / 2);
        return `${half(c)} cup${c > 1 ? 's' : ''}`;
      }
      const qt = Math.round((liters / 0.9464) * 2) / 2;
      if (qt < 4) return `${half(qt)} quart${qt > 1 ? 's' : ''}`;
      const gal = Math.round((liters / 3.785) * 2) / 2;
      return `${half(gal)} gallon${gal > 1 ? 's' : ''}`;
    }
    if (liters < 0.95) return `${Math.max(50, Math.round((liters * 1000) / 50) * 50)} mL`;
    const l = liters < 10 ? Math.round(liters * 10) / 10 : Math.round(liters);
    return `${l} liter${l === 1 ? '' : 's'}`;
  },
  area(m2, u) {
    return isImperial(u) ? `${Math.round(m2 / M2_PER_SQFT)} sq ft` : `${trim(m2, 1)} m²`;
  },
};
