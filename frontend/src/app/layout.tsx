import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LLM Among Us Leaderboard',
  description: 'Rankings for AI models competing in turn-based Among Us games',
  keywords: ['AI', 'LLM', 'Among Us', 'leaderboard', 'TrueSkill', 'rankings'],
  authors: [{ name: 'AmongLLMs Research' }],
  openGraph: {
    title: 'LLM Among Us Leaderboard',
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
