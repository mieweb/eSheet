import type { ReactNode } from 'react';

const isDev = import.meta.env.DEV;
const landingUrl = isDev ? 'http://localhost:3000/' : '/';
const docsUrl = isDev ? 'http://localhost:3000/docs/intro' : '/docs/intro';
const demoUrl = isDev ? 'http://localhost:3001/' : '/demo/';

export function Navbar({ children }: { children?: ReactNode }) {
  return (
    <nav className="demo-navbar min-h-14 px-4 sm:px-6 py-2 sm:py-0 flex flex-wrap items-center gap-x-5 gap-y-2 bg-white border-b border-slate-200 sticky top-0 z-50">
      <a
        href={landingUrl}
        className="inline-flex items-center gap-2 text-slate-700 hover:text-blue-600 text-base font-bold no-underline transition-colors shrink-0"
      >
        eSheet
      </a>
      <div className="demo-navbar-links flex items-center gap-4 ml-0 sm:ml-2">
        <a
          href={docsUrl}
          className="text-sm text-slate-600 hover:text-blue-600 no-underline transition-colors"
        >
          Documentation
        </a>
        <a
          href={demoUrl}
          className="text-sm text-slate-600 hover:text-blue-600 no-underline transition-colors ml-2"
        >
          Demo
        </a>
      </div>
      {children && (
        <div className="demo-navbar-actions flex flex-1 flex-wrap min-w-0 w-full sm:w-auto items-center gap-3">
          {children}
        </div>
      )}
    </nav>
  );
}
