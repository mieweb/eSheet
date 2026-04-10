import { useState, useEffect, useCallback } from 'react';

const BRANDS = [
  { value: 'bluehive', label: 'BlueHive Health' },
  { value: 'mieweb', label: 'MIE Web' },
  { value: 'ozwell', label: 'Ozwell AI' },
  { value: 'webchart', label: 'WebChart' },
  { value: 'enterprise-health', label: 'Enterprise Health' },
  { value: 'waggleline', label: 'WaggleLine' },
] as const;

export type BrandId = (typeof BRANDS)[number]['value'];

const STORAGE_KEY = 'esheet-brand';
const LINK_ID = 'mieweb-brand-css';

export function useBrand() {
  const [brand, setBrandState] = useState<BrandId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as BrandId) || 'bluehive';
  });

  useEffect(() => {
    applyBrandCSS(brand);
  }, [brand]);

  const setBrand = useCallback((b: BrandId) => {
    localStorage.setItem(STORAGE_KEY, b);
    setBrandState(b);
  }, []);

  return { brand, setBrand, brands: BRANDS };
}

function applyBrandCSS(brand: BrandId) {
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = `${import.meta.env.BASE_URL}brands/${brand}.css`;
}
