import React, { useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

export function getInitialsFromName(name?: string | null): string {
  const clean = String(name || '').trim();
  if (!clean) return 'TC';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[10px]',
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
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const initials = getInitialsFromName(name);
  const validUrl = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim().length > 0 && !imgError;

  if (validUrl) {
    return (
      <img
        src={avatarUrl!.trim()}
        alt={name || 'Avatar'}
        onError={() => setImgError(true)}
        className={`${sizeClass} shrink-0 rounded-full object-cover border border-zinc-700/60 bg-zinc-800/90 select-none ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name || 'Avatar'}
      className={`${sizeClass} shrink-0 rounded-full bg-zinc-800/90 text-zinc-200 border border-zinc-700/60 flex items-center justify-center font-semibold tracking-tight select-none ${className}`}
    >
      {initials}
    </div>
  );
};

/**
 * Автоматически сжимает и кадрирует изображение по центру до квадрата 160x160px
 * на клиенте через HTMLCanvasElement (формат image/jpeg, качество 0.82),
 * возвращая компактную строку data:image/jpeg;base64,...
 */
export function cropAndCompressAvatarToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Выберите корректный графический файл (PNG, JPG, WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать выбранный файл изображения.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось декодировать изображение.'));
      img.onload = () => {
        try {
          const targetSize = 160;
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D контекст недоступен.'));
            return;
          }

          // Заливаем графитовым фоном на случай прозрачных PNG
          ctx.fillStyle = '#18181B';
          ctx.fillRect(0, 0, targetSize, targetSize);

          const srcWidth = img.naturalWidth || img.width || targetSize;
          const srcHeight = img.naturalHeight || img.height || targetSize;
          const minSide = Math.min(srcWidth, srcHeight);
          const sx = Math.max(0, Math.floor((srcWidth - minSide) / 2));
          const sy = Math.max(0, Math.floor((srcHeight - minSide) / 2));

          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressedBase64);
        } catch (err) {
          reject(err);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
