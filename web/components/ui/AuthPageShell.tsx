'use client';

import { AppLogo } from '@/components/ui/AppLogo';
import { AuthPreferencesBar } from '@/components/ui/AuthPreferencesBar';

type AuthPageShellProps = {
  asideTitle: string;
  asideSubtitle: string;
  asideFooter?: string;
  children: React.ReactNode;
  showMobileLogo?: boolean;
};

export function AuthPageShell({
  asideTitle,
  asideSubtitle,
  asideFooter,
  children,
  showMobileLogo = false,
}: AuthPageShellProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-[42%] bg-gradient-to-br from-accent to-accent-muted flex-col justify-between p-10 text-white">
        <div className="animate-fade-in-up">
          <AppLogo size="lg" className="mb-8" priority />
          <h1 className="text-3xl font-semibold tracking-tight">{asideTitle}</h1>
          <p className="text-white/80 mt-3 text-base leading-relaxed max-w-xs">{asideSubtitle}</p>
        </div>
        {asideFooter && (
          <p className="text-xs text-white/50 animate-fade-in" style={{ animationDelay: '200ms' }}>
            {asideFooter}
          </p>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center p-6 bg-canvas">
          <div className="w-full max-w-sm animate-scale-in">
            {showMobileLogo && (
              <div className="lg:hidden text-center mb-6">
                <AppLogo size="md" className="mb-3 mx-auto" priority />
              </div>
            )}
            {children}
          </div>
        </div>
        <div className="shrink-0 px-6 pb-6 bg-canvas flex justify-center">
          <div className="w-full max-w-sm">
            <AuthPreferencesBar />
          </div>
        </div>
      </div>
    </div>
  );
}
