const PAGE_SIZE = 30000;
const DYNAMIC_SHEET_CACHE_TTL_MS = 5 * 60 * 1000;
const MASTER_SHEET_CACHE_TTL_MS = 30 * 60 * 1000;
const UPSTREAM_MIN_GAP_MS = 450;
const DEFAULT_429_COOLDOWN_MS = 30 * 1000;

interface PagesSheetCacheEntry {
  csvText: string;
  records: string[];
  fetchedAt: number;
}

const pagesSheetCache = new Map<string, PagesSheetCacheEntry>();
const inFlightPagesFetches = new Map<string, Promise<PagesSheetCacheEntry>>();
let pagesQueueTail: Promise<void> = Promise.resolve();
let pagesLastUpstreamAt = 0;
let pagesRateLimitedUntil = 0;

function getCacheTtlForSheet(sheetName?: string | null): number {
  const upper = String(sheetName || "").trim().toUpperCase();
  if (upper === "REGU" || upper === "PETUGAS") {
    return MASTER_SHEET_CACHE_TTL_MS;
  }
  return DYNAMIC_SHEET_CACHE_TTL_MS;
}

async function waitForPagesUpstreamSlot(): Promise<void> {
  const prev = pagesQueueTail;
  let release!: () => void;
  pagesQueueTail = new Promise<void>(resolve => {
    release = resolve;
  });
  await prev;
  try {
    const waitMs = Math.max(0, UPSTREAM_MIN_GAP_MS - (Date.now() - pagesLastUpstreamAt));
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    pagesLastUpstreamAt = Date.now();
  } finally {
    release();
  }
}

function splitCsvRecords(csvText: string): string[] {
  const records: string[] = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText.charCodeAt(i);
    if (ch === 34) {
      if (inQuotes && i + 1 < csvText.length && csvText.charCodeAt(i + 1) === 34) {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === 10 && !inQuotes) {
      const rec = csvText.slice(start, i).replace(/\r$/, "");
      if (rec.trim().length > 0) records.push(rec);
      start = i + 1;
    }
  }
  if (start < csvText.length) {
    const rec = csvText.slice(start).replace(/\r$/, "");
    if (rec.trim().length > 0) records.push(rec);
  }
  return records;
}

class PagesUpstreamError extends Error {
  status: number;
  retryAfterSec?: number;
  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

async function fetchPagesSheet(targetUrl: string): Promise<PagesSheetCacheEntry> {
  await waitForPagesUpstreamSlot();

  if (Date.now() < pagesRateLimitedUntil) {
    const waitSec = Math.ceil((pagesRateLimitedUntil - Date.now()) / 1000);
    throw new PagesUpstreamError(`Rate limit cooldown active (${waitSec}s remaining)`, 429, waitSec);
  }

  const controller = new AbortController();
  let headerTimer: ReturnType<typeof setTimeout> | null = null;
  let bodyTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    headerTimer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (headerTimer) {
      clearTimeout(headerTimer);
      headerTimer = null;
    }

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterRaw = response.headers.get("retry-after");
        const parsedRetry = retryAfterRaw ? parseInt(retryAfterRaw, 10) : NaN;
        const cooldownMs = !isNaN(parsedRetry) && parsedRetry > 0
          ? Math.min(Math.max(parsedRetry * 1000, 15000), 60000)
          : DEFAULT_429_COOLDOWN_MS;
        pagesRateLimitedUntil = Date.now() + cooldownMs;
        throw new PagesUpstreamError("HTTP status 429", 429, Math.ceil(cooldownMs / 1000));
      }
      throw new PagesUpstreamError(`Backend fetch failed with HTTP ${response.status}`, response.status);
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    bodyTimer = setTimeout(() => controller.abort(), 45000);
    const csvText = await response.text();
    if (bodyTimer) {
      clearTimeout(bodyTimer);
      bodyTimer = null;
    }
    if (contentType.includes("text/html") || csvText.trimStart().startsWith("<!DOCTYPE html") || csvText.trimStart().startsWith("<html")) {
      throw new Error("Upstream returned HTML instead of CSV");
    }

    return {
      csvText,
      records: splitCsvRecords(csvText),
      fetchedAt: Date.now(),
    };
  } catch (err: any) {
    if (err?.name === "AbortError" || controller.signal.aborted) {
      throw new PagesUpstreamError("Upstream Google Sheets request timed out", 504);
    }
    throw err;
  } finally {
    if (headerTimer) clearTimeout(headerTimer);
    if (bodyTimer) clearTimeout(bodyTimer);
  }
}

export const onRequest = async (context: any): Promise<Response> => {
  const url = new URL(context.request.url);
  const sheetName = url.searchParams.get("sheetName");
  const customUrl = url.searchParams.get("customUrl");
  const paged = url.searchParams.get("paged") === "1";
  const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10) || 0);

  let targetUrl = "";
  if (customUrl) {
    targetUrl = customUrl;
  } else if (sheetName) {
    const spreadsheetId = "1lMwrFdf-VKmmWWZ_UU_XGkvhUWvH-t16ZL4lSjDbPRU";
    targetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  } else {
    return new Response(JSON.stringify({ error: "Missing sheetName or customUrl parameter" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const buildCsvResponse = (entry: PagesSheetCacheEntry, isStale = false) => {
    const cacheControl = isStale ? "no-cache" : "private, max-age=60";
    if (paged && entry.records.length > 0) {
      const dataCount = Math.max(0, entry.records.length - 1);
      const totalPages = Math.max(1, Math.ceil(dataCount / PAGE_SIZE));
      let body = entry.records[0];
      if (page < totalPages) {
        const startIdx = 1 + page * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        body = [entry.records[0], ...entry.records.slice(startIdx, endIdx)].join("\n");
      }
      return new Response(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": cacheControl,
          "X-Total-Pages": String(totalPages),
          "Access-Control-Expose-Headers": "X-Total-Pages",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    return new Response(entry.csvText, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": cacheControl,
        "Access-Control-Allow-Origin": "*",
      },
    });
  };

  const ttlMs = getCacheTtlForSheet(sheetName);
  const cached = pagesSheetCache.get(targetUrl);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) {
    return buildCsvResponse(cached);
  }

  if (Date.now() < pagesRateLimitedUntil) {
    if (cached) {
      return buildCsvResponse(cached, true);
    }
    const retrySec = Math.max(1, Math.ceil((pagesRateLimitedUntil - Date.now()) / 1000));
    return new Response(JSON.stringify({ error: `Google Sheets rate limit active, retry after ${retrySec}s`, retryAfter: retrySec }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retrySec),
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    let fetchPromise = inFlightPagesFetches.get(targetUrl);
    if (!fetchPromise) {
      fetchPromise = fetchPagesSheet(targetUrl).finally(() => {
        inFlightPagesFetches.delete(targetUrl);
      });
      inFlightPagesFetches.set(targetUrl, fetchPromise);
    }

    const freshEntry = await fetchPromise;
    pagesSheetCache.set(targetUrl, freshEntry);
    return buildCsvResponse(freshEntry);
  } catch (err: any) {
    if (cached) {
      return buildCsvResponse(cached, true);
    }
    const status = err instanceof PagesUpstreamError && (err.status === 429 || err.status === 504) ? err.status : 500;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };
    if (status === 429) {
      headers["Retry-After"] = String(err.retryAfterSec || 30);
    }
    return new Response(JSON.stringify({ error: err?.message || "Internal server error fetching sheets" }), {
      status,
      headers,
    });
  }
};
