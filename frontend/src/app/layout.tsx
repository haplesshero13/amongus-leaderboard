import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { THEME_INIT_SCRIPT } from '../lib/theme/themeMode';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LM Deception Arena',
  description: 'Rankings for AI models competing in turn-based Among Us games',
  keywords: ['AI', 'LLM', 'Among Us', 'leaderboard', 'TrueSkill', 'rankings'],
  authors: [{ name: 'AmongLLMs Research' }],
  openGraph: {
    title: 'LM Deception Arena',
    description: 'Rankings for AI models competing in turn-based Among Us games',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
