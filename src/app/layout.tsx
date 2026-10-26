import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const ui = Schibsted_Grotesk({ variable: '--font-ui', subsets: ['latin'] });
const prose = Source_Serif_4({ variable: '--font-prose', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Scout, a research agent',
  description: 'An autonomous research agent that searches, reads, verifies and cites.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${prose.variable}`}>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) inject attributes before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
