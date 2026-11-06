import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_FX_RATES, parseCbrDailyJson } from '../../api/fx-rates';

test('parseCbrDailyJson converts CBR rub-per-unit quotes into units-per-rub rates', () => {
  const parsed = parseCbrDailyJson({
    Date: '2026-11-05T11:30:00+03:00',
    Valute: {
      USD: { Nominal: 1, Value: 80 },
      EUR: { Nominal: 1, Value: 100 },
    },
  });
  assert.ok(parsed);
  assert.equal(parsed!.source, 'cbr');
  assert.equal(parsed!.rates.RUB, 1);
  assert.equal(parsed!.rates.USD, 1 / 80);
  assert.equal(parsed!.rates.EUR, 1 / 100);
  assert.equal(parsed!.date, '2026-11-05T11:30:00+03:00');
});

test('parseCbrDailyJson respects Nominal and rejects malformed payloads', () => {
  const parsed = parseCbrDailyJson({
    Valute: { USD: { Nominal: 10, Value: 900 }, EUR: { Nominal: 1, Value: 99 } },
  });
  assert.equal(parsed!.rates.USD, 1 / 90);
  assert.equal(parseCbrDailyJson({}), null);
  assert.equal(parseCbrDailyJson({ Valute: { USD: { Value: 0 }, EUR: { Value: 90 } } }), null);
});

test('fallback rates are sane', () => {
  assert.equal(FALLBACK_FX_RATES.rates.RUB, 1);
  assert.ok(FALLBACK_FX_RATES.rates.USD > 0 && FALLBACK_FX_RATES.rates.USD < 1);
  assert.equal(FALLBACK_FX_RATES.source, 'fallback');
});
