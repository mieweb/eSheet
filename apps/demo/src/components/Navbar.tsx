import { useEffect, useCallback } from 'react';
import { useState } from 'react';
import {
  Button,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalClose,
  Select,
} from '@mieweb/ui';
import { Menu, Settings, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useBrand } from '../hooks/useBrand';

const isDev = import.meta.env.DEV;
const landingUrl = isDev ? 'http://localhost:3000/' : '/';
const docsUrl = isDev ? 'http://localhost:3000/docs/intro' : '/docs/intro';
const demoUrl = isDev ? 'http://localhost:3001/' : '/demo/';
const LOCO_MODE_KEY = 'esheet-loco-mode';
const LOCO_LANGUAGE_KEY = 'loco-lang';
const LOCO_API_URL = 'https://loco.os.mieweb.org';
const LOCO_API_KEY = '202337e52dff4fb69e97857d';

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { brand, setBrand, brands } = useBrand();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState(
    () => localStorage.getItem(LOCO_LANGUAGE_KEY) ?? ''
  );
  const [locoMode, setLocoMode] = useState<'offline' | 'online'>(() => {
    return localStorage.getItem(LOCO_MODE_KEY) === 'online'
      ? 'online'
      : 'offline';
  });
  const [languages, setLanguages] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const openMobileMenu = useCallback(() => {
    setIsClosing(false);
    setMobileMenuOpen(true);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setMobileMenuOpen(false);
      setIsClosing(false);
    }, 200);
  }, []);

  // Lock body scroll while sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (theme === 'system') setTheme('light');
  }, [theme, setTheme]);

  useEffect(() => {
    if (!settingsOpen || !window.Loco || languages.length > 0) return;

    let active = true;
    window.Loco.languages().then((availableLanguages) => {
      if (active) setLanguages(availableLanguages);
    });

    return () => {
      active = false;
    };
  }, [languages.length, settingsOpen]);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    if (value) {
      void window.Loco?.apply(value);
    } else {
      window.Loco?.restore();
    }
  };

  const handleLocoModeChange = (value: string) => {
    const nextMode = value === 'online' ? 'online' : 'offline';
    localStorage.setItem(LOCO_MODE_KEY, nextMode);
    setLocoMode(nextMode);
    window.location.reload();
  };

  const logoLink = (
    <a
      href={landingUrl}
      className="inline-flex items-center gap-2 text-foreground hover:text-primary-600 text-base font-bold no-underline transition-colors shrink-0"
    >
      <img
        src={`${import.meta.env.BASE_URL}eSheet-modern.svg`}
        alt="eSheet logo"
        className="h-5 w-auto align-middle"
      />
      eSheet
    </a>
  );

  return (
    <>
      {/* ── Main navbar bar ── */}
      <nav className="demo-navbar bg-card border-b border-border sticky top-0 z-50">
        <div className="flex items-center gap-3 px-6 h-14">
          {/* Hamburger — mobile only, left side (matches Docusaurus) */}
          <button
            onClick={() => openMobileMenu()}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <Menu size={20} />
          </button>

          {logoLink}

          {/* Desktop links */}
          <div className="demo-navbar-links hidden sm:flex items-center gap-4 ml-2">
            <a
              href={docsUrl}
              className="text-sm text-muted-foreground hover:text-primary-600 no-underline transition-colors"
            >
              Documentation
            </a>
            <a
              href={demoUrl}
              className="text-sm text-muted-foreground hover:text-primary-600 no-underline transition-colors"
            >
              Demo
            </a>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* Settings — desktop only */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="hidden sm:inline-flex"
            >
              <Settings size={16} />
              <span className="ml-1">Settings</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Mobile sidebar backdrop ── */}
      <div
        className={`sm:hidden fixed inset-0 z-[55] bg-black/40 transition-opacity duration-200 ${
          mobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={closeMobileMenu}
      />

      {/* ── Mobile sidebar panel (slides in from left, matches Docusaurus) ── */}
      {(mobileMenuOpen || isClosing) && (
        <div
          className={`sm:hidden fixed top-0 left-0 h-full z-[60] w-72 max-w-[85vw] bg-card shadow-xl flex flex-col ${
            isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'
          }`}
          aria-modal="true"
          role="dialog"
          aria-label="Navigation menu"
        >
          {/* Sidebar header — mirrors navbar height */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
            {logoLink}
            <button
              onClick={closeMobileMenu}
              aria-label="Close menu"
              className="inline-flex items-center justify-center w-9 h-9 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col overflow-y-auto">
            <a
              href={docsUrl}
              className="px-4 py-3 text-sm text-foreground border-b border-border hover:bg-muted no-underline transition-colors"
              onClick={closeMobileMenu}
            >
              Documentation
            </a>
            <a
              href={demoUrl}
              className="px-4 py-3 text-sm text-foreground border-b border-border hover:bg-muted no-underline transition-colors"
              onClick={closeMobileMenu}
            >
              Demo
            </a>
            <button
              className="px-4 py-3 text-sm text-foreground border-b border-border hover:bg-muted text-left flex items-center gap-2 transition-colors w-full"
              onClick={() => {
                closeMobileMenu();
                setSettingsOpen(true);
              }}
            >
              <Settings size={16} className="shrink-0" />
              Settings
            </button>
          </nav>
        </div>
      )}

      {/* ── Settings modal ── */}
      <Modal open={settingsOpen} onOpenChange={setSettingsOpen}>
        <ModalHeader>
          <ModalTitle>Settings</ModalTitle>
          <ModalClose />
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <Select
            label="Theme"
            value={theme}
            onValueChange={(val) => setTheme(val as 'light' | 'dark')}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <Select
            label="Brand"
            value={brand}
            onValueChange={(val) => setBrand(val as typeof brand)}
            options={brands.map((b) => ({ value: b.value, label: b.label }))}
          />
          <Select
            label="Language"
            value={language}
            onValueChange={handleLanguageChange}
            options={[
              { value: '', label: 'Original' },
              ...languages.map((item) => ({
                value: item.code,
                label: item.name,
              })),
            ]}
          />
          <Select
            label="Translation mode"
            value={locoMode}
            onValueChange={handleLocoModeChange}
            options={[
              { value: 'offline', label: 'Offline (local approved translations)' },
              { value: 'online', label: 'Online (Loco API)' },
            ]}
          />
          {locoMode === 'online' && (
            <div className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
              <div>API URL: {LOCO_API_URL}</div>
              <div>API key: {LOCO_API_KEY}</div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(false)}
          >
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
