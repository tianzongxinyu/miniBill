'use client';

import { LocaleSelect } from '@/components/ui/LocaleSelect';
import { useSettings } from '@/components/SettingsProvider';

/** Language picker for login/register footers. */
export function AuthPreferencesBar() {
  const { setLocale } = useSettings();
  return (
    <div className="w-full max-w-sm mx-auto">
      <LocaleSelect variant="compact" markExplicitOnChange onChange={setLocale} />
    </div>
  );
}
