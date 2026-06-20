import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { I18nProvider } from '@/components/I18nProvider';
import { SettingsProvider } from '@/components/SettingsProvider';
import { APP_DESCRIPTION, APP_NAME } from '@/lib/appMeta';

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SettingsProvider>
            <I18nProvider>{children}</I18nProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
