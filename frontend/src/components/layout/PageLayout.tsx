'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface PageLayoutProps {
  activePage: string;
  children: ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl';
  showFooter?: boolean;
}

const widthClasses = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
};

export function PageLayout({
  activePage,
  children,
  maxWidth = '6xl',
  showFooter = true,
}: PageLayoutProps) {
  const containerClass = `mx-auto ${widthClasses[maxWidth]} px-4 sm:px-6 lg:px-8`;
  const headerClass = `mx-auto max-w-6xl px-4 sm:px-6 lg:px-8`;

  const navLinks = [
    { href: '/about', label: 'About' },
    { href: '/games', label: 'View Games' },
    { href: '/', label: 'Leaderboard' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className={`${headerClass} py-6`}>
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-2xl shadow-lg">
                &#x1F47E;
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                  LM Deception Arena
                </h1>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              {navLinks.map((link) => {
                const isActive = activePage === link.href;
                return isActive ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`${containerClass} py-8`}>{children}</main>

      {/* Footer */}
      {showFooter && (
        <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className={`${containerClass} py-6`}>
            {/* Citations */}
            <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Based on Original Research by Satvik Golechha, Adria Garriga-Alonso
              </h3>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <strong>Paper:</strong>{' '}
                  <a
                    href="https://arxiv.org/abs/2504.04072"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    arxiv.org/abs/2504.04072
                  </a>
                </p>
                <p>
                  <strong>Original Code:</strong>{' '}
                  <a
                    href="https://github.com/7vik/AmongUs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    github.com/7vik/AmongUs
                  </a>
                </p>
                <p>
                  <strong>Our Fork:</strong>{' '}
                  <a
                    href="https://github.com/haplesshero13/AmongLLMs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    github.com/haplesshero13/AmongLLMs
                  </a>
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
              <strong>Disclaimer:</strong> This website is not affiliated with, funded by, or
              endorsed by FAR.AI, Golechha et al., or InnerSloth LLC.
            </p>

            {/* Links */}
            <div className="flex justify-center gap-4 border-t border-gray-200 pt-4 dark:border-gray-700">
              <Link
                href="/"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Leaderboard
              </Link>
              <Link
                href="/games"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Games
              </Link>
              <Link
                href="/about"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                About
              </Link>
              <a
                href="https://github.com/haplesshero13/AmongLLMs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
