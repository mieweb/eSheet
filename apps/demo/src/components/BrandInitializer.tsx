import { useEffect } from 'react';

const STORAGE_KEY = 'esheet-brand';
const LINK_ID = 'mieweb-brand-css';

/**
 * Reads the saved brand from localStorage on mount and injects the
 * brand stylesheet <link> tag. Rendered once in the root layout.
 */
export function BrandInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (link) return; // already injected (e.g. by useBrand)

    link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = `${import.meta.env.BASE_URL}brands/${saved}.css`;
    document.head.appendChild(link);
  }, []);

  return null;
}
