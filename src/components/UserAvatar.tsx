import React, { useState } from 'react';

export interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  statusDot?: 'online' | 'offline' | 'busy' | null;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-16 h-16 text-lg',
};

const AVATAR_GRADIENT_PALETTES = [
  'bg-indigo-100 text-indigo-900 border-indigo-200/90 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/30',
  'bg-emerald-100 text-emerald-900 border-emerald-200/90 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/30',
  'bg-amber-100 text-amber-900 border-amber-200/90 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/30',
  'bg-sky-100 text-sky-900 border-sky-200/90 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/30',
  'bg-rose-100 text-rose-900 border-rose-200/90 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/30',
  'bg-violet-100 text-violet-900 border-violet-200/90 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-400/30',
];

export function getInitials(name?: string | null): string {
  const clean = (name || '').trim();
  if (!clean) return 'TC';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function getPaletteForName(name?: string | null): string {
  const clean = (name || 'TC').trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENT_PALETTES.length;
  return AVATAR_GRADIENT_PALETTES[index];
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  className = '',
  statusDot = null,
}) => {
  const [imgError, setImgError] = useState(false);
  const trimmedUrl = (avatarUrl || '').trim();
  const showImage = Boolean(trimmedUrl) && !imgError;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const paletteClass = getPaletteForName(name);

  return (
    <div className={`relative inline-flex shrink-0 select-none ${className}`}>
      {showImage ? (
        <img
          src={trimmedUrl}
          alt={name || 'Avatar'}
          onError={() => setImgError(true)}
          className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-zinc-900 shrink-0`}
        />
      ) : (
        <div
          className={`${sizeClass} ${paletteClass} rounded-full border font-bold tracking-tight flex items-center justify-center shrink-0`}
          title={name || undefined}
        >
          {getInitials(name)}
        </div>
      )}

      {statusDot && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white dark:ring-[#09090B] ${
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
          } ${
            statusDot === 'online'
              ? 'bg-emerald-500 dark:bg-emerald-400'
              : statusDot === 'busy'
              ? 'bg-amber-500 dark:bg-amber-400'
              : 'bg-slate-400 dark:bg-zinc-500'
          }`}
        />
      )}
    </div>
  );
};

export function fileToDataUrlLimited(file: File, maxDimension = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл изображения'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        } catch {
          resolve(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export const cropAndCompressAvatarToDataUrl = fileToDataUrlLimited;

