import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Navbar({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <nav className="demo-navbar h-14 px-6 flex items-center gap-4 bg-white border-b border-slate-200 sticky top-0 z-50">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-slate-700 hover:text-blue-600 text-base font-bold no-underline transition-colors shrink-0"
      >
        {!isHome && (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        )}
        mSheet
      </Link>
      {children && (
        <div className="demo-navbar-actions flex flex-1 items-center gap-3">
          {children}
        </div>
      )}
    </nav>
  );
}
