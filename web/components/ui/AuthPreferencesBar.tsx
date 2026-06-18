'use client';

import { LocaleSelect } from '@/components/ui/LocaleSelect';

/** Language picker for login/register footers. */
export function AuthPreferencesBar() {
  return (
    <div className="w-full max-w-sm mx-auto">
      <LocaleSelect variant="compact" markExplicitOnChange />
    </div>
  );
}
