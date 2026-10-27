import React, { useState } from 'react';

export interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function getInitials(name?: string | null): string {
  const cleaned = String(name || '').trim();
  if (!cleaned) return 'TC';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_GRADIENT_PALETTES = [
  'bg-gradient-to-br from-indigo-500/25 to-violet-500/10 text-indigo-200 border-indigo-400/30',
  'bg-gradient-to-br from-emerald-500/25 to-teal-500/10 text-emerald-200 border-emerald-400/30',
  'bg-gradient-to-br from-amber-500/25 to-orange-500/10 text-amber-200 border-amber-400/30',
  'bg-gradient-to-br from-sky-500/25 to-blue-500/10 text-sky-200 border-sky-400/30',
  'bg-gradient-to-br from-rose-500/25 to-pink-500/10 text-rose-200 border-rose-400/30',
  'bg-gradient-to-br from-fuchsia-500/25 to-purple-500/10 text-fuchsia-200 border-fuchsia-400/30',
] as const;

export function getDeterministicAvatarPalette(name?: string | null): string {
  const cleaned = String(name || 'TedCloud').trim();
  let hash = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENT_PALETTES[hash % AVATAR_GRADIENT_PALETTES.length];
}

/**
 * Сжимает и обрезает загруженный файл фотографии до компактного квадрата 160x160 (JPEG, 0.82)
 * и возвращает Base64 Data URL для мгновенного сохранения в organization_nodes.avatar_url.
 */
export function cropAndCompressAvatarToDataUrl(file: File, targetSize = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл изображения'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Некорректный формат изображения'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context недоступен'));
            return;
          }
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-16 h-16 text-lg',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name);
  const sizeClass = SIZE_CLASSES[size];
  const paletteClass = getDeterministicAvatarPalette(name);
  const validUrl = avatarUrl && avatarUrl.trim().length > 0 && !imgError;

  if (validUrl) {
    return (
      <img
        src={avatarUrl!}
        alt={name || 'Avatar'}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${paletteClass} rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] flex items-center justify-center font-semibold tracking-tight shrink-0 select-none ${className}`}
      title={name || 'TedCloud'}
    >
      {initials}
    </div>
  );
};
