import fs from 'node:fs';
import path from 'node:path';

/**
 * Резервное хранение данных без базы данных.
 *
 * Когда Supabase/PostgreSQL не настроены, `/api/db` держит данные в памяти процесса.
 * Этот модуль сохраняет снимок в JSON-файл (атомарно: запись во временный файл + rename)
 * и восстанавливает его при старте, чтобы данные переживали перезапуск сервера.
 */

export interface PersistedSnapshot {
  version: 1;
  savedAt: string;
  data: Record<string, unknown>;
}

export function resolveLocalDataFile(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = String(env.TEDCLOUD_DATA_FILE || '').trim();
  if (configured.toLowerCase() === 'off') return null;
  if (configured) return path.resolve(configured);
  const isTestProcess =
    Boolean(env.VERCEL || env.NODE_TEST_CONTEXT || env.NODE_ENV === 'test') ||
    (Array.isArray(process.argv) &&
      process.argv.some((arg) => arg === '--test' || arg.includes('.test.')));
  if (isTestProcess) return null;
  return path.resolve(process.cwd(), 'data', 'tedcloud-store.json');
}

export function loadSnapshot(filePath: string | null): PersistedSnapshot | null {
  if (!filePath) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed.data !== 'object') {
      console.warn(`[persistence] Неизвестный формат снимка ${filePath}, файл пропущен.`);
      return null;
    }
    return parsed as PersistedSnapshot;
  } catch (err) {
    console.warn(`[persistence] Не удалось прочитать ${filePath}:`, (err as Error).message);
    return null;
  }
}

export function createSnapshotWriter(
  filePath: string | null,
  collect: () => Record<string, unknown>,
  delayMs = 400
): { schedule: () => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastWritten = '';

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!filePath) return;
    try {
      const data = collect();
      const serializedData = JSON.stringify(data);
      if (serializedData === lastWritten) return;
      const snapshot: PersistedSnapshot = { version: 1, savedAt: new Date().toISOString(), data };
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(snapshot), 'utf8');
      fs.renameSync(tmp, filePath);
      lastWritten = serializedData;
    } catch (err) {
      console.warn(`[persistence] Не удалось сохранить ${filePath}:`, (err as Error).message);
    }
  };

  const schedule = () => {
    if (!filePath) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
    (timer as any)?.unref?.();
  };

  return { schedule, flush };
}
