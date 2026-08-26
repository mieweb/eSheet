import { useEffect, useCallback } from 'react';
import { useState } from 'react';
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  PillSelect,
  Select,
} from '@mieweb/ui';
import { MessageCircle, Menu, Settings, X } from 'lucide-react';
import { useTheme, type Theme } from '../hooks/useTheme';
import { useBrand, type BrandId } from '../hooks/useBrand';
import { openOzwellChat } from '../ozwell-setup.js';

interface LocoLanguage {
  code: string;
  name: string;
}

declare global {
  interface Window {
    Loco?: {
      languages(): Promise<LocoLanguage[]>;
      apply(code: string): Promise<unknown>;
      restore(): void;
    };
  }
}

const isDev = import.meta.env.DEV;
const landingUrl = isDev ? 'http://localhost:3000/' : '/';
const docsUrl = isDev ? 'http://localhost:3000/docs/intro' : '/docs/intro';
const demoUrl = isDev ? 'http://localhost:3001/' : '/demo/';
const originalLanguage = 'original';

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { brand, setBrand, brands } = useBrand();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [languages, setLanguages] = useState<LocoLanguage[] | null>(null);
  const [language, setLanguage] = useState(
    () => localStorage.getItem('loco-lang') ?? originalLanguage
  );
  const [languageLoading, setLanguageLoading] = useState(false);

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

  const handleSettingsOpenChange = useCallback((open: boolean) => {
    if (!open && document.querySelector('[role="listbox"]')) {
      return;
    }

    setSettingsOpen(open);
  }, []);

  // Lock body scroll while sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!settingsOpen || languages !== null) return;

    let active = true;
    setLanguageLoading(true);
    void (window.Loco?.languages() ?? Promise.resolve([]))
      .then((options) => {
        if (active) setLanguages(options);
      })
      .finally(() => {
        if (active) setLanguageLoading(false);
      });

    return () => {
      active = false;
    };
  }, [settingsOpen, languages]);

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
            <Dropdown
              open={settingsOpen}
              onOpenChange={handleSettingsOpenChange}
              placement="bottom-end"
              width={360}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Settings size={16} />}
                  aria-label="Settings"
                >
                  <span className="hidden sm:inline ml-1">Settings</span>
                </Button>
              }
            >
              <DropdownLabel>Appearance</DropdownLabel>
              <DropdownContent>
                <PillSelect
                  label="Theme"
                  value={theme}
                  onValueChange={(value) => setTheme(value as Theme)}
                  options={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'system', label: 'System' },
                  ]}
                />
              </DropdownContent>
              <DropdownSeparator />
              <DropdownLabel>Brand</DropdownLabel>
              <DropdownContent>
                <PillSelect
                  value={brand}
                  onValueChange={(value) => setBrand(value as BrandId)}
                  options={brands.map(({ value, label }) => ({
                    value,
                    label,
                  }))}
                />
              </DropdownContent>
              <DropdownSeparator />
              <DropdownLabel>Language</DropdownLabel>
              <DropdownContent>
                <Select
                  aria-label="Language"
                  value={language}
                  disabled={languageLoading}
                  onValueChange={(value) => {
                    if (value === originalLanguage) {
                      window.Loco?.restore();
                      setLanguage(value);
                      return;
                    }

                    void window.Loco?.apply(value).then(() => {
                      setLanguage(value);
                    });
                  }}
                  options={[
                    { value: originalLanguage, label: 'English (Original)' },
                    ...(languages ?? []).map(({ code, name }) => ({
                      value: code,
                      label: name,
                    })),
                  ]}
                />
              </DropdownContent>
              <DropdownSeparator />
              <DropdownContent>
                <DropdownItem
                  icon={<MessageCircle size={16} />}
                  onClick={() => {
                    setSettingsOpen(false);
                    void openOzwellChat().catch((error: unknown) =>
                      console.warn(error)
                    );
                  }}
                >
                  Open Ozwell
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
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
          </nav>
        </div>
      )}
    </>
  );
}
