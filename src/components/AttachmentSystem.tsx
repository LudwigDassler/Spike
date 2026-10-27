import React, { useState } from 'react';
import {
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Maximize2,
  X,
} from 'lucide-react';
import { AttachmentItem } from '../types/database';
import { formatAttachmentSize, isImageAttachment, normalizeAttachments } from '../utils/enterpriseLogic';

export const ACCEPTED_ATTACHMENT_TYPES =
  'image/png,image/jpeg,image/webp,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Compresses an image file via HTML5 Canvas to max 1200px on the longest side.
 */
async function compressImageFileToDataUrl(file: File): Promise<{ dataUrl: string; byteSize: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onerror = () => {
        // Fallback to raw data URL if image decode fails
        resolve({ dataUrl: src, byteSize: file.size });
      };
      img.onload = () => {
        const maxSide = 1200;
        let width = img.width || 800;
        let height = img.height || 600;
        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: src, byteSize: file.size });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressed = canvas.toDataURL(outMime, 0.84);
        const approxBytes = Math.round((compressed.length * 3) / 4);
        resolve({ dataUrl: compressed, byteSize: approxBytes });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export async function processFilesToAttachments(
  fileList: FileList | File[] | null,
  lang: 'ru' | 'en' = 'ru'
): Promise<{ attachments: AttachmentItem[]; error?: string }> {
  if (!fileList) return { attachments: [] };
  const files = Array.from(fileList);
  const results: AttachmentItem[] = [];
  let errorMsg: string | undefined;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isImg =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.name);

    try {
      if (isImg) {
        const { dataUrl, byteSize } = await compressImageFileToDataUrl(file);
        results.push({
          id: `att_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType: file.type || 'image/jpeg',
          size: byteSize,
          url: dataUrl,
        });
      } else {
        if (file.size > MAX_DOCUMENT_BYTES) {
          errorMsg =
            lang === 'en'
              ? `File "${file.name}" exceeds the 2 MB limit.`
              : `Файл «${file.name}» превышает лимит 2 МБ.`;
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        results.push({
          id: `att_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          url: dataUrl,
        });
      }
    } catch {
      errorMsg =
        lang === 'en'
          ? `Could not attach "${file.name}".`
          : `Не удалось прикрепить файл «${file.name}».`;
    }
  }

  return { attachments: results, error: errorMsg };
}

export async function processAttachmentFiles(
  fileList: FileList | File[] | null,
  lang: 'ru' | 'en' = 'ru'
): Promise<AttachmentItem[]> {
  const { attachments, error } = await processFilesToAttachments(fileList, lang);
  if (error && attachments.length === 0) {
    throw new Error(error);
  }
  return attachments;
}

function getDocumentIcon(att: AttachmentItem) {
  const lower = `${att.name} ${att.mimeType}`.toLowerCase();
  if (lower.includes('xls') || lower.includes('csv') || lower.includes('spreadsheet')) {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />;
  }
  if (lower.includes('zip') || lower.includes('archive') || lower.includes('rar')) {
    return <FileArchive className="w-4 h-4 text-amber-400 shrink-0" />;
  }
  return <FileText className="w-4 h-4 text-sky-400 shrink-0" />;
}

interface PendingAttachmentsStripProps {
  attachments: AttachmentItem[];
  onRemove: (id: string) => void;
  className?: string;
}

export const PendingAttachmentsStrip: React.FC<PendingAttachmentsStripProps> = ({
  attachments,
  onRemove,
  className = '',
}) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5 px-2.5 bg-zinc-900/80 border-t border-white/[0.08] ${className}`}
    >
      {attachments.map((att) => {
        const isImg = isImageAttachment(att);
        return (
          <div
            key={att.id}
            className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-950/90 border border-white/10 shrink-0 max-w-[210px]"
          >
            {isImg ? (
              <img
                src={att.url}
                alt={att.name}
                className="w-7 h-7 rounded object-cover border border-white/10 shrink-0"
              />
            ) : (
              getDocumentIcon(att)
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-zinc-200 truncate">
                {att.name}
              </div>
              <div className="text-[10px] text-zinc-500">
                {formatAttachmentSize(att.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              className="w-5 h-5 rounded-md bg-white/[0.06] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 flex items-center justify-center transition shrink-0"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

interface AttachmentListRendererProps {
  attachments?: AttachmentItem[] | any;
  compact?: boolean;
  onRemove?: (id: string) => void;
  lang?: 'ru' | 'en';
}

export const AttachmentListRenderer: React.FC<AttachmentListRendererProps> = ({
  attachments,
  compact = false,
  onRemove,
  lang = 'ru',
}) => {
  const [lightboxAtt, setLightboxAtt] = useState<AttachmentItem | null>(null);
  const list = normalizeAttachments(attachments);

  if (list.length === 0) return null;

  const images = list.filter((a) => isImageAttachment(a));
  const docs = list.filter((a) => !isImageAttachment(a));

  return (
    <>
      <div className="mt-2 space-y-1.5">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative rounded-xl overflow-hidden border border-white/10 bg-zinc-950/70 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxAtt(img);
                }}
              >
                <img
                  src={img.url}
                  alt={img.name}
                  className={
                    compact
                      ? 'h-20 w-28 object-cover transition group-hover:scale-105'
                      : 'max-h-44 max-w-[240px] sm:max-w-[280px] object-cover transition group-hover:scale-[1.02]'
                  }
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg bg-black/60 text-white">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </span>
                </div>
                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(img.id);
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-black/70 hover:bg-rose-500 text-white flex items-center justify-center transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {docs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {docs.map((doc) => (
              <div
                key={doc.id}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-zinc-950/75 border border-white/10 hover:border-white/20 transition max-w-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                    {getDocumentIcon(doc)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-100 truncate">
                      {doc.name}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {formatAttachmentSize(doc.size)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={doc.url}
                    download={doc.name}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[11px] font-medium text-zinc-200 transition"
                    title={lang === 'en' ? 'Download file' : 'Скачать файл'}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {lang === 'en' ? 'Download' : 'Скачать'}
                    </span>
                  </a>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(doc.id);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal for full-size image inspection */}
      {lightboxAtt && (
        <div
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxAtt(null);
          }}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between gap-3 mb-3 px-2">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-sm font-medium text-zinc-100 truncate">
                  {lightboxAtt.name}
                </span>
                <span className="text-xs text-zinc-400 shrink-0">
                  ({formatAttachmentSize(lightboxAtt.size)})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={lightboxAtt.url}
                  download={lightboxAtt.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Download' : 'Скачать'}
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxAtt(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={lightboxAtt.url}
              alt={lightboxAtt.name}
              className="max-h-[80vh] max-w-full rounded-xl object-contain border border-white/15 shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
};
