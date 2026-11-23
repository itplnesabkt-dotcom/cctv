interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const PAGE_SIZE = 30000;
const SHEET_CACHE_TTL_MS = 60 * 1000;

interface WorkerSheetCacheEntry {
  csvText: string;
  records: string[];
  fetchedAt: number;
}

const workerSheetCache = new Map<string, WorkerSheetCacheEntry>();

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

    // 2. Route: /api/sheets with caching, retry logic, and safe plain-text CSV pagination
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

      const buildCsvResponse = (entry: WorkerSheetCacheEntry) => {
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
              "X-Total-Pages": String(totalPages),
              "Access-Control-Expose-Headers": "X-Total-Pages",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
        return new Response(entry.csvText, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      };

      const cached = workerSheetCache.get(targetUrl);
      if (cached && Date.now() - cached.fetchedAt < SHEET_CACHE_TTL_MS) {
        return buildCsvResponse(cached);
      }

      const maxAttempts = 3;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout covering body read

        try {
          const response = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });

          if (response.ok) {
            const contentType = String(response.headers.get("content-type") || "").toLowerCase();
            const csvText = await response.text();
            if (contentType.includes("text/html") || csvText.trimStart().startsWith("<!DOCTYPE html") || csvText.trimStart().startsWith("<html")) {
              lastError = new Error("Upstream returned HTML instead of CSV");
              console.warn(`Attempt ${attempt} returned HTML instead of CSV. Retrying...`);
            } else {
              const entry: WorkerSheetCacheEntry = {
                csvText,
                records: splitCsvRecords(csvText),
                fetchedAt: Date.now(),
              };
              workerSheetCache.set(targetUrl, entry);
              return buildCsvResponse(entry);
            }
          } else {
            lastError = new Error(`HTTP status ${response.status}`);
            console.warn(`Attempt ${attempt} failed fetching sheets with HTTP ${response.status}. Retrying...`);
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Attempt ${attempt} failed with error: ${err.message || err}. Retrying...`);
        } finally {
          clearTimeout(timeoutId);
        }

        // Brief backoff before retry
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (cached) {
        return buildCsvResponse(cached);
      }

      console.error("All sheet fetch attempts failed. Last error:", lastError);
      return new Response(JSON.stringify({ error: lastError?.message || "Internal server error fetching sheets after multiple attempts" }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
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
