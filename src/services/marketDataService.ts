import { NativeModules } from 'react-native';
import { MarketFeatures, MarketOhlcv, MarketTicker, MarketType } from '../types';

const MARKET_API_TIMEOUT_MS = 2500;

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function getMetroHostMarketApiUrl() {
  const sourceCode = NativeModules.SourceCode as { scriptURL?: string } | undefined;
  const scriptUrl = sourceCode?.scriptURL;
  if (!scriptUrl) return null;

  const match = scriptUrl.match(/^https?:\/\/([^/:]+)(?::\d+)?\//);
  return match?.[1] ? `http://${match[1]}:8000` : null;
}

function getMarketApiBaseUrls() {
  const urls = [
    getMetroHostMarketApiUrl(),
    'http://127.0.0.1:8000',
    'http://localhost:8000',
    'http://10.0.2.2:8000',
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(urls));
}

export function toCcxtSymbol(symbol: string, marketType?: MarketType) {
  const normalized = normalizeSymbol(symbol);
  const parts = normalized.replace(':', '/').replace(/-/g, '/').split('/').filter(Boolean);
  const base = parts[0];
  const quote = parts[1] ?? 'USDT';

  if (marketType === 'futures') {
    return `${base}/${quote}:${quote}`;
  }

  if (normalized.includes('/')) return normalized;

  if (normalized.endsWith('-USDT-SWAP')) {
    return `${normalized.replace('-USDT-SWAP', '')}/USDT`;
  }

  if (normalized.endsWith('-USDT')) {
    return `${normalized.replace('-USDT', '')}/USDT`;
  }

  if (normalized.includes('-')) {
    return normalized.replace(/-/g, '/');
  }

  return `${normalized}/USDT`;
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string | number>) {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${baseUrl}${path}?${query}`;
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MARKET_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Market API returned ${response.status}.`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function requestMarketApi<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  const baseUrls = getMarketApiBaseUrls();
  if (baseUrls.length === 0) return null;

  return new Promise((resolve) => {
    let pending = baseUrls.length;
    let settled = false;

    baseUrls.forEach((baseUrl) => {
      fetchJsonWithTimeout<T>(buildUrl(baseUrl, path, params))
        .then((value) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        })
        .catch((error) => {
          if (!settled) {
            console.warn(`V4 market API unavailable at ${baseUrl}.`, error);
          }
        })
        .finally(() => {
          pending -= 1;
          if (pending === 0 && !settled) {
            settled = true;
            resolve(null);
          }
        });
    });
  });
}

export async function fetchBackendTicker(symbol: string, marketType?: MarketType) {
  const ticker = await requestMarketApi<MarketTicker>('/market/ticker', {
    exchange: 'okx',
    symbol: toCcxtSymbol(symbol, marketType),
  });

  if (!ticker || ticker.price === null || !Number.isFinite(ticker.price) || ticker.price <= 0) {
    return null;
  }

  return ticker;
}

export function fetchBackendOhlcv(
  symbol: string,
  marketType: MarketType | undefined,
  timeframe = '1m',
  limit = 200,
) {
  return requestMarketApi<MarketOhlcv>('/market/ohlcv', {
    exchange: 'okx',
    symbol: toCcxtSymbol(symbol, marketType),
    timeframe,
    limit,
  });
}

export function fetchBackendMarketFeatures(symbol: string, marketType?: MarketType) {
  return requestMarketApi<MarketFeatures>('/market/features', {
    exchange: 'okx',
    symbol: toCcxtSymbol(symbol, marketType),
  });
}
