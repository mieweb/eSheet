function resolveDemoUrl(fallbackUrl) {
  if (typeof window === 'undefined') {
    return fallbackUrl;
  }

  const { hostname } = window.location;
  const isLocalHost =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  return isLocalHost ? 'http://localhost:3001/' : fallbackUrl;
}

function updateNavbarDemoLink() {
  if (typeof document === 'undefined') {
    return;
  }

  const link = document.querySelector('a.header-live-demo-link');
  if (!link) {
    return;
  }

  const fallbackUrl = link.getAttribute('href') || '/demo/';
  link.setAttribute('href', resolveDemoUrl(fallbackUrl));
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNavbarDemoLink, {
      once: true,
    });
  } else {
    updateNavbarDemoLink();
  }

  window.addEventListener('pageshow', updateNavbarDemoLink);
}
