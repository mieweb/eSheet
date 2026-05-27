import { type ReactNode, useEffect, useState } from 'react';
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
import { Settings } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useBrand } from '../hooks/useBrand';

const isDev = import.meta.env.DEV;
const landingUrl = isDev ? 'http://localhost:3000/' : '/';
const docsUrl = isDev ? 'http://localhost:3000/docs/intro' : '/docs/intro';
const demoUrl = isDev ? 'http://localhost:3001/' : '/demo/';

export function Navbar({ children }: { children?: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { brand, setBrand, brands } = useBrand();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (theme === 'system') setTheme('light');
  }, [theme, setTheme]);

  return (
    <nav className="demo-navbar bg-card border-b border-border sticky top-0 z-50">
      {/* Top row — always visible */}
      <div className="flex items-center gap-3 px-4 h-14">
        <a
          href={landingUrl}
          className="inline-flex items-center gap-2 text-foreground hover:text-primary-600 text-base font-bold no-underline transition-colors shrink-0"
        >
          <img
            src={`${import.meta.env.BASE_URL}eSheet-modern.svg`}
            alt="eSheet logo"
            className="ms:h-5 ms:w-auto ms:align-middle"
          />
          eSheet
        </a>
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
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Actions row — children from page (Select, buttons, etc.) */}
      {children && (
        <div className="demo-navbar-actions flex flex-wrap items-center gap-2 px-4 py-2 border-t border-border sm:border-t-0 sm:py-0 sm:absolute sm:top-0 sm:left-1/2 sm:-translate-x-1/2 sm:h-14 sm:flex-nowrap sm:max-w-2xl sm:w-full">
          {children}
        </div>
      )}

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
    </nav>
  );
}
