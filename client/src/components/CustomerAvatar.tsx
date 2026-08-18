import type { CSSProperties } from 'react';

import { Image } from '@client/src/components/ui/image';
import { cn } from '@client/src/lib/utils';

import '@client/src/customer-avatar.css';

const CAT_SPRITE_URL =
  '/spark/app/app_17bqq1hu1r4/runtime/api/v1/storage/object/bucket_aadko3wttvmxs/1873798734590087.png';
const GOLDEN_SHADED_URL =
  '/spark/app/app_17bqq1hu1r4/runtime/api/v1/storage/object/bucket_aadko3wttvmxs/1873798979201123.png';

export interface CatAvatarPreset {
  id: string;
  label: string;
  row?: number;
  column?: number;
  url?: string;
}

export const CAT_AVATAR_PRESETS: CatAvatarPreset[] = [
  { id: 'cat-white', label: '白色波斯', row: 0, column: 0 },
  { id: 'cat-orange', label: '橘猫', row: 0, column: 1 },
  { id: 'cat-silver', label: '银渐层', row: 0, column: 2 },
  { id: 'cat-black', label: '黑猫', row: 1, column: 0 },
  { id: 'cat-calico', label: '三花猫', row: 1, column: 1 },
  { id: 'cat-ragdoll', label: '布偶猫', row: 1, column: 2 },
  { id: 'cat-tuxedo', label: '奶牛猫', row: 2, column: 0 },
  { id: 'cat-cream', label: '奶油猫', row: 2, column: 1 },
  { id: 'cat-tabby', label: '灰虎斑', row: 2, column: 2 },
  { id: 'cat-golden', label: '金渐层', url: GOLDEN_SHADED_URL },
];

interface CustomerAvatarProps {
  name: string;
  customerId?: string;
  avatarPreset?: string;
  avatarUrl?: string;
  size?: number;
  className?: string;
}

function stableIndex(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % CAT_AVATAR_PRESETS.length;
}

export default function CustomerAvatar({
  name,
  customerId,
  avatarPreset,
  avatarUrl,
  size = 38,
  className,
}: CustomerAvatarProps) {
  const preset =
    CAT_AVATAR_PRESETS.find((item) => item.id === avatarPreset) ||
    CAT_AVATAR_PRESETS[stableIndex(customerId || name || 'customer')];
  const label = avatarUrl ? `${name}上传的头像` : `${name}的${preset.label}头像`;

  if (avatarUrl || preset.url) {
    return (
      <span
        className={cn('customer-cat-avatar', className)}
        style={{ width: size, height: size }}
        title={label}
      >
        <Image
          src={avatarUrl || preset.url}
          alt={label}
          width={size}
          height={size}
          className="customer-cat-avatar-image"
        />
      </span>
    );
  }

  const spriteStyle = {
    width: size * 3,
    height: size * 3,
    left: -(preset.column || 0) * size,
    top: -(preset.row || 0) * size,
  } satisfies CSSProperties;

  return (
    <span
      className={cn('customer-cat-avatar', className)}
      style={{ width: size, height: size }}
      title={label}
    >
      <Image
        src={CAT_SPRITE_URL}
        alt={label}
        width={size * 3}
        height={size * 3}
        className="customer-cat-avatar-sprite"
        style={spriteStyle}
      />
    </span>
  );
}
