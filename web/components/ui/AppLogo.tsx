'use client';

import { APP_NAME } from '@/lib/appMeta';
import { withBasePath } from '@/lib/basePath';

const sizes = {
  sm: 36,
  md: 40,
  lg: 44,
} as const;

type AppLogoProps = {
  size?: keyof typeof sizes | number;
  className?: string;
  priority?: boolean;
};

export function AppLogo({ size = 'sm', className = '', priority = false }: AppLogoProps) {
  const px = typeof size === 'number' ? size : sizes[size];

  return (
    // Native img + withBasePath: correct under /app/minibill and local; avoids next/image double-prefix.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBasePath('/icon.png')}
      alt={APP_NAME}
      width={px}
      height={px}
      style={{ width: px, height: px }}
      className={`rounded-2xl shrink-0 object-cover ${className}`}
      decoding="async"
      {...(priority ? { fetchPriority: 'high' as const } : {})}
    />
  );
}
