import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const robotoMono = Roboto_Mono({ variable: '--font-roboto-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Channel Mirror',
  description: 'Auto-rewrite the latest video from a YouTube channel into TTS audio',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

  if (!isLocalhost) {
    const { getAccessToken, isAuthenticated } = getKindeServerSession();

    const isAuth = await isAuthenticated();
    if (!isAuth) {
      redirect('/api/auth/login');
    }

    // Kill switch: ping Kinde's live API on every page load
    const token = await getAccessToken();
    if (token) {
      try {
        const liveCheck = await fetch(
          `${process.env.KINDE_ISSUER_URL}/oauth2/v2/user_profile`,
          {
            headers: { Authorization: `Bearer ${token}` },
            next: { revalidate: 0 },
          }
        );

        if (!liveCheck.ok) {
          redirect('/api/auth/logout');
        }
      } catch {
        // If Kinde is unreachable, allow user to stay (fail-open)
      }
    }
  }

  return (
    <html lang="en">
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
