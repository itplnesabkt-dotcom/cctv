import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API router/routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google Sheets CORS Bypass Proxy
  app.get("/api/sheets", async (req, res) => {
    try {
      const sheetName = req.query.sheetName as string;
      const customUrl = req.query.customUrl as string;

      let targetUrl = "";
      if (customUrl) {
        targetUrl = customUrl;
      } else if (sheetName) {
        const spreadsheetId = "1lMwrFdf-VKmmWWZ_UU_XGkvhUWvH-t16ZL4lSjDbPRU";
        targetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      } else {
        res.status(400).json({ error: "Missing sheetName or customUrl parameter" });
        return;
      }

      // 10 second timeout for resiliency
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        res.status(response.status).json({ error: `Backend fetch failed with HTTP ${response.status}` });
        return;
      }

      const csvText = await response.text();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csvText);
    } catch (err: any) {
      console.error("Sheets proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error fetching sheets" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
