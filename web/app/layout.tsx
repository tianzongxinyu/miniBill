import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { FnosHostSync } from '@/components/FnosHostSync';
import { I18nProvider } from '@/components/I18nProvider';
import { LedgerAccessProvider } from '@/components/LedgerAccessProvider';
import { SettingsProvider } from '@/components/SettingsProvider';
import { APP_DESCRIPTION, APP_NAME } from '@/lib/appMeta';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3E8E7E',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <LedgerAccessProvider>
            <SettingsProvider>
              <I18nProvider>
                <FnosHostSync />
                {children}
              </I18nProvider>
            </SettingsProvider>
          </LedgerAccessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
