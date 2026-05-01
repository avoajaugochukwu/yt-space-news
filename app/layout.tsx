import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const robotoMono = Roboto_Mono({ variable: '--font-roboto-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Channel Mirror',
  description: 'Auto-rewrite the latest video from a YouTube channel into TTS audio',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
