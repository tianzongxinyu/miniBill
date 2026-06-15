import Image from 'next/image';
import { APP_NAME } from '@/lib/appMeta';

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
    <Image
      src="/icon.png"
      alt={APP_NAME}
      width={px}
      height={px}
      className={`rounded-2xl shrink-0 ${className}`}
      priority={priority}
    />
  );
}
