/**
 * GET /api/fx-rates — курсы валют к рублю по данным ЦБ РФ.
 *
 * Источник: https://www.cbr-xml-daily.ru/daily_json.js (зеркало официальных курсов ЦБ РФ в JSON).
 * Ответ кэшируется в памяти на 6 часов. Если источник недоступен, возвращаются последние
 * полученные курсы, а при их отсутствии — запасные значения с пометкой source: "fallback".
 *
 * Формат ответа: { base: "RUB", rates: { RUB: 1, USD: 0.0108, EUR: 0.0099 }, date, source }
 * где rates[X] — сколько единиц валюты X стоит 1 рубль.
 */

export type FxCurrency = 'RUB' | 'USD' | 'EUR';

export interface FxRatesPayload {
  base: 'RUB';
  rates: Record<FxCurrency, number>;
  /** Дата курса ЦБ (ISO) */
  date: string | null;
  source: 'cbr' | 'fallback';
}

const CBR_URL = process.env.TEDCLOUD_FX_URL || 'https://www.cbr-xml-daily.ru/daily_json.js';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const FALLBACK_FX_RATES: FxRatesPayload = {
  base: 'RUB',
  rates: { RUB: 1, USD: 1 / 92.5, EUR: 1 / 100.5 },
  date: null,
  source: 'fallback',
};

let cached: { payload: FxRatesPayload; fetchedAt: number } | null = null;
let inflight: Promise<FxRatesPayload> | null = null;

/** Разбор ответа ЦБ: Valute.USD.Value — рублей за Nominal единиц валюты. */
export function parseCbrDailyJson(json: any): FxRatesPayload | null {
  const usd = json?.Valute?.USD;
  const eur = json?.Valute?.EUR;
  const rubPerUsd = Number(usd?.Value) / (Number(usd?.Nominal) || 1);
  const rubPerEur = Number(eur?.Value) / (Number(eur?.Nominal) || 1);
  if (!(rubPerUsd > 0) || !(rubPerEur > 0)) return null;
  return {
    base: 'RUB',
    rates: { RUB: 1, USD: 1 / rubPerUsd, EUR: 1 / rubPerEur },
    date: typeof json?.Date === 'string' ? json.Date : null,
    source: 'cbr',
  };
}

export async function getFxRates(now = Date.now()): Promise<FxRatesPayload> {
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.payload;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(CBR_URL, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Источник отдаёт JSON с content-type application/javascript — парсим текст.
      const parsed = parseCbrDailyJson(JSON.parse(await res.text()));
      if (!parsed) throw new Error('unexpected payload');
      cached = { payload: parsed, fetchedAt: Date.now() };
      return parsed;
    } catch (err) {
      console.warn('[fx-rates] Не удалось получить курсы ЦБ:', (err as Error).message);
      // Повторная попытка не чаще раза в 10 минут.
      const stale = cached?.payload || FALLBACK_FX_RATES;
      cached = { payload: stale, fetchedAt: Date.now() - CACHE_TTL_MS + 10 * 60 * 1000 };
      return stale;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export default async function handler(_req: any, res: any) {
  const payload = await getFxRates();
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json(payload);
}
