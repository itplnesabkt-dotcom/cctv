interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const PAGE_SIZE = 30000;
const DYNAMIC_SHEET_CACHE_TTL_MS = 5 * 60 * 1000;
const MASTER_SHEET_CACHE_TTL_MS = 30 * 60 * 1000;
const UPSTREAM_MIN_GAP_MS = 450;
const DEFAULT_429_COOLDOWN_MS = 30 * 1000;

interface WorkerSheetCacheEntry {
  csvText: string;
  records: string[];
  fetchedAt: number;
}

const workerSheetCache = new Map<string, WorkerSheetCacheEntry>();
const inFlightWorkerFetches = new Map<string, Promise<WorkerSheetCacheEntry>>();
let workerQueueTail: Promise<void> = Promise.resolve();
let workerLastUpstreamAt = 0;
let workerRateLimitedUntil = 0;

function getCacheTtlForSheet(sheetName?: string | null): number {
  const upper = String(sheetName || "").trim().toUpperCase();
  if (upper === "REGU" || upper === "PETUGAS") {
    return MASTER_SHEET_CACHE_TTL_MS;
  }
  return DYNAMIC_SHEET_CACHE_TTL_MS;
}

async function waitForWorkerUpstreamSlot(): Promise<void> {
  const prev = workerQueueTail;
  let release!: () => void;
  workerQueueTail = new Promise<void>(resolve => {
    release = resolve;
  });
  await prev;
  try {
    const waitMs = Math.max(0, UPSTREAM_MIN_GAP_MS - (Date.now() - workerLastUpstreamAt));
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    workerLastUpstreamAt = Date.now();
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

class WorkerUpstreamError extends Error {
  status: number;
  retryAfterSec?: number;
  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

async function fetchWorkerSheetWithRetries(targetUrl: string, hasStaleCache: boolean): Promise<WorkerSheetCacheEntry> {
  const maxAttempts = hasStaleCache ? 1 : 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await waitForWorkerUpstreamSlot();

    if (Date.now() < workerRateLimitedUntil) {
      const waitSec = Math.ceil((workerRateLimitedUntil - Date.now()) / 1000);
      throw new WorkerUpstreamError(`Rate limit cooldown active (${waitSec}s remaining)`, 429, waitSec);
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

      if (response.ok) {
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        bodyTimer = setTimeout(() => controller.abort(), 45000);
        const csvText = await response.text();
        if (bodyTimer) {
          clearTimeout(bodyTimer);
          bodyTimer = null;
        }
        if (contentType.includes("text/html") || csvText.trimStart().startsWith("<!DOCTYPE html") || csvText.trimStart().startsWith("<html")) {
          lastError = new Error("Upstream returned HTML instead of CSV");
        } else {
          return {
            csvText,
            records: splitCsvRecords(csvText),
            fetchedAt: Date.now(),
          };
        }
      } else if (response.status === 429) {
        const retryAfterRaw = response.headers.get("retry-after");
        const parsedRetry = retryAfterRaw ? parseInt(retryAfterRaw, 10) : NaN;
        const cooldownMs = !isNaN(parsedRetry) && parsedRetry > 0
          ? Math.min(Math.max(parsedRetry * 1000, 15000), 60000)
          : DEFAULT_429_COOLDOWN_MS;
        workerRateLimitedUntil = Date.now() + cooldownMs;
        lastError = new WorkerUpstreamError("HTTP status 429", 429, Math.ceil(cooldownMs / 1000));
        break;
      } else {
        lastError = new WorkerUpstreamError(`HTTP status ${response.status}`, response.status);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        lastError = new WorkerUpstreamError("Upstream Google Sheets request timed out", 504);
        break;
      } else {
        lastError = err;
      }
    } finally {
      if (headerTimer) clearTimeout(headerTimer);
      if (bodyTimer) clearTimeout(bodyTimer);
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }

  throw lastError || new Error("Failed fetching sheets after multiple attempts");
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Route: /api/health
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 2. Route: /api/sheets with caching, deduplication, upstream pacing, and safe plain-text CSV pagination
    if (url.pathname === "/api/sheets") {
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
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      const buildCsvResponse = (entry: WorkerSheetCacheEntry, isStale = false) => {
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
      const cached = workerSheetCache.get(targetUrl);
      if (cached && Date.now() - cached.fetchedAt < ttlMs) {
        return buildCsvResponse(cached);
      }

      if (Date.now() < workerRateLimitedUntil) {
        if (cached) {
          return buildCsvResponse(cached, true);
        }
        const retrySec = Math.max(1, Math.ceil((workerRateLimitedUntil - Date.now()) / 1000));
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
        let fetchPromise = inFlightWorkerFetches.get(targetUrl);
        if (!fetchPromise) {
          fetchPromise = fetchWorkerSheetWithRetries(targetUrl, Boolean(cached)).finally(() => {
            inFlightWorkerFetches.delete(targetUrl);
          });
          inFlightWorkerFetches.set(targetUrl, fetchPromise);
        }

        const freshEntry = await fetchPromise;
        workerSheetCache.set(targetUrl, freshEntry);
        return buildCsvResponse(freshEntry);
      } catch (err: any) {
        if (cached) {
          return buildCsvResponse(cached, true);
        }
        const status = err instanceof WorkerUpstreamError && (err.status === 429 || err.status === 504) ? err.status : 500;
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
    }

    // 2.5 Route: /api/gas-proxy
    if (url.pathname === "/api/gas-proxy") {
      const gasUrl = url.searchParams.get("gasUrl");
      if (!gasUrl) {
        return new Response(JSON.stringify({ error: "Missing gasUrl parameter" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }

      try {
        const bodyText = await request.text();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for large images

        let response = await fetch(gasUrl, {
          method: "POST",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          },
          body: bodyText
        });

        // Follow redirect manually if 3xx status returned (common with GAS 302 redirects)
        if (response.status >= 300 && response.status < 400) {
          const redirectUrl = response.headers.get("Location");
          if (redirectUrl) {
            response = await fetch(redirectUrl, {
              method: "GET",
              signal: controller.signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
              }
            });
          }
        }
        clearTimeout(timeoutId);

        if (!response.ok) {
          return new Response(JSON.stringify({ error: `GAS server returned status ${response.status}` }), {
            status: response.status,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            },
          });
        }

        const resData = await response.text();
        return new Response(resData, {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal server error proxying to Google Apps Script" }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    // 3. Fallback: serve static assets
    return await env.ASSETS.fetch(request);
  }
};
