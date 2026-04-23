import { useState, useEffect, useCallback } from 'react';

export const BRANDS = [
  { value: 'bluehive', label: 'BlueHive Health' },
  { value: 'mieweb', label: 'MIE Web' },
  { value: 'ozwell', label: 'Ozwell AI' },
  { value: 'webchart', label: 'WebChart' },
  { value: 'enterprise-health', label: 'Enterprise Health' },
  { value: 'waggleline', label: 'WaggleLine' },
] as const;

export type BrandId = (typeof BRANDS)[number]['value'];

export function isValidBrand(value: string): value is BrandId {
  return BRANDS.some((b) => b.value === value);
}

const STORAGE_KEY = 'esheet-brand';
const LINK_ID = 'mieweb-brand-css';
const FONT_LINK_ID = 'mieweb-brand-font';

const BRAND_FONTS: Partial<Record<BrandId, string>> = {
  'enterprise-health':
    'https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,100..900;1,100..900&display=swap',
};

export function useBrand() {
  const [brand, setBrandState] = useState<BrandId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && isValidBrand(saved) ? saved : 'bluehive';
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

  // Manage brand font link
  let fontLink = document.getElementById(
    FONT_LINK_ID
  ) as HTMLLinkElement | null;
  const fontUrl = BRAND_FONTS[brand];
  if (fontUrl) {
    if (!fontLink) {
      fontLink = document.createElement('link');
      fontLink.id = FONT_LINK_ID;
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);
    }
    fontLink.href = fontUrl;
  } else if (fontLink) {
    fontLink.remove();
  }
}
