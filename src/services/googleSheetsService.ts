import { DashboardData, MainTableEntry, UnitRecap, OfficerPerformance, CCTVUsage } from "../types.ts";
import Papa from "papaparse";

export class GoogleSheetsService {
  private static SPREADSHEET_ID = "1lMwrFdf-VKmmWWZ_UU_XGkvhUWvH-t16ZL4lSjDbPRU";

  private static async fetchSheetDataRaw(sheetName: string): Promise<any[][]> {
    const endpoints = [
      `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`,
      `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`,
      `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/pub?output=csv&sheet=${encodeURIComponent(sheetName)}`
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
          console.warn(`Endpoint ${url} returned status ${response.status}`);
          continue;
        }
        
        const csvText = await response.text();
        
        // If we get HTML, it means we're likely being redirected to a login page or error page
        if (!csvText || csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes('<html') || csvText.includes('google-signin')) {
          console.warn(`Endpoint ${url} returned HTML/Login page instead of CSV. This usually means the sheet is not "Published to the Web" or the ID is incorrect.`);
          continue;
        }

        return new Promise((resolve, reject) => {
          Papa.parse(csvText, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data && results.data.length > 0) {
                resolve(results.data as any[][]);
              } else {
                console.warn(`Endpoint ${url} returned empty data.`);
                resolve([]);
              }
            },
            error: (error: any) => reject(error),
          });
        });
      } catch (error) {
        console.warn(`Error fetching from ${url}:`, error);
      }
    }

    console.error(`All fetch attempts failed for sheet: ${sheetName}. 
      1. Open your Google Sheet
      2. Go to File > Share > Publish to web
      3. Select "Entire Document" or "${sheetName}" and "Comma-separated values (.csv)"
      4. Click Publish
      5. Ensure SPREADSHEET_ID "${this.SPREADSHEET_ID}" is correct.`);
    return [];
  }

  static async updateSheetData(sheetName: string, data: any[]): Promise<boolean> {
    // In Vite, environment variables are accessed via import.meta.env
    // and must be prefixed with VITE_ to be exposed to the client.
    // We use optional chaining and multiple fallback checks to prevent "undefined" errors.
    const metaEnv = (import.meta as any).env;
    let scriptUrl = metaEnv?.VITE_APPS_SCRIPT_URL;
    
    if (!scriptUrl) {
      console.error("VITE_APPS_SCRIPT_URL is not defined in environment. Please check your .env file or AI Studio Settings.");
      return false;
    }

    // Clean URL from quotes if any (sometimes users add them in .env)
    scriptUrl = scriptUrl.trim().replace(/^["']|["']$/g, '');

    try {
      // Using a simple POST with text/plain to avoid CORS preflight issues with Apps Script
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          sheetName,
          data, // Array of arrays [[col1, col2], [row1col1, row1col2]]
          spreadsheetId: this.SPREADSHEET_ID
        }),
      });

      return true;
    } catch (error) {
      console.error(`Error updating sheet ${sheetName}:`, error);
      return false;
    }
  }

  static async fetchData(startDate?: string, endDate?: string): Promise<DashboardData> {
    // Fetching the primary sheets requested by the user
    const [woRows, poRows, petugasRows, ulpRows] = await Promise.all([
      this.fetchSheetDataRaw("WO"),
      this.fetchSheetDataRaw("PO"),
      this.fetchSheetDataRaw("PETUGAS"),
      this.fetchSheetDataRaw("ULP"),
    ]);

    // Helper to clean names for matching
    const cleanName = (name: any) => 
      String(name || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

    // Helper to parse date strings from sheet consistently as local time
    const parseSheetDate = (dateStr: string) => {
      if (!dateStr) return null;
      
      // Handle DD-MM-YYYY or DD/MM/YYYY (Common in Indonesian sheets)
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2Str = parts[2].trim();
        const p2 = p2Str.length === 2 ? 2000 + parseInt(p2Str, 10) : parseInt(p2Str, 10);

        // Try DD-MM-YYYY first
        if (p0 <= 31 && p1 <= 12) {
          return new Date(p2, p1 - 1, p0);
        }
        // Fallback to YYYY-MM-DD if it looks like that
        if (p0 > 1000 && p1 <= 12 && p2 <= 31) {
          return new Date(p0, p1 - 1, p2);
        }
      }

      // Try standard parsing
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
      
      return null;
    };

    // Pre-parse start and end dates to avoid repeated parsing in loop
    const sDate = startDate ? (() => {
      const [y, m, d] = startDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    })() : null;

    const eDate = endDate ? (() => {
      const [y, m, d] = endDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setHours(23, 59, 59, 999);
      return date;
    })() : null;

    const isWithinRange = (date: Date | null) => {
      if (!sDate && !eDate) return true;
      if (!date) return false;
      
      const dTime = date.getTime();
      if (sDate && dTime < sDate.getTime()) return false;
      if (eDate && dTime > eDate.getTime()) return false;
      
      return true;
    };

    const normalizeForMatch = (str: string) => 
      String(str || "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();

    const ulpToReguMap: Record<string, string> = {
      "BUKITTINGGI": "BUKITTINGGI",
      "PADANGPANJANG": "PADANGPANJANG",
      "LUBUKSIKAPING": "LUBUKSIKAPING",
      "LUBUKBASUNG": "LUBUKBASUNG",
      "SIMPANGEMPAT": "SIMPANGEMPAT",
      "BASO": "BASO",
      "KOTOTUO": "KOTOTUO"
    };

    const isValidRegu = (ulpName: string, reguValue: string) => {
      const nUlp = normalizeForMatch(ulpName);
      const nRegu = normalizeForMatch(reguValue);
      const expectedRegu = ulpToReguMap[nUlp];
      if (!expectedRegu) return true; 
      return nRegu === expectedRegu;
    };

    // Helper to find column index
    const findHeaderAndCols = (rows: any[][], targets: string[]) => {
      if (!rows || rows.length === 0) return { headerRowIdx: -1, colIndices: targets.map(() => -1) };
      let bestRowIdx = -1;
      let bestIndices = targets.map(() => -1);
      let maxMatches = 0;

      for (let r = 0; r < Math.min(rows.length, 20); r++) {
        const row = rows[r].map((h: any) => String(h || "").trim().toLowerCase());
        const indices = targets.map(target => {
          const t = target.toLowerCase();
          let idx = row.indexOf(t);
          if (idx !== -1) return idx;
          if (t === "nama petugas" || t === "name") {
            idx = row.findIndex(h => h.includes("nama") && h.includes("petugas"));
            if (idx === -1) idx = row.findIndex(h => h.includes("nama") || h.includes("petugas") || h.includes("name"));
          } else if (t === "cctv") {
            idx = row.findIndex(h => h === "cctv" || h.includes("cctv"));
          } else if (t === "ulp") {
            idx = row.findIndex(h => h === "ulp" || h.includes("ulp"));
          } else if (t === "tanggal") {
            idx = row.findIndex(h => h.includes("tanggal") || h.includes("date") || h.includes("tgl"));
          }
          return idx;
        });

        const matches = indices.filter(idx => idx !== -1).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          bestRowIdx = r;
          bestIndices = indices;
        }
        if (matches === targets.length) break;
      }
      return maxMatches > 0 ? { headerRowIdx: bestRowIdx, colIndices: bestIndices } : { headerRowIdx: -1, colIndices: targets.map(() => -1) };
    };

    // 1. Get officers from PETUGAS sheet
    const { headerRowIdx: petugasHeaderIdx, colIndices: petugasCols } = findHeaderAndCols(petugasRows, ["name", "ulpId", "ulp"]);
    const petugasNameIdx = petugasCols[0];
    const petugasUlpIdIdx = petugasCols[1];
    const petugasUlpIdx = petugasCols[2];
    
    const officers: { name: string; ulpId: string; directUlp: string }[] = [];
    if (petugasNameIdx !== -1) {
      petugasRows.slice(petugasHeaderIdx + 1).forEach(row => {
        const name = String(row[petugasNameIdx] || "").trim();
        const ulpId = petugasUlpIdIdx !== -1 ? String(row[petugasUlpIdIdx] || "").trim() : "";
        const directUlp = petugasUlpIdx !== -1 ? String(row[petugasUlpIdx] || "").trim() : "";
        if (name && name.toLowerCase() !== "name" && name.toLowerCase() !== "nama") {
          officers.push({ name, ulpId, directUlp });
        }
      });
    }

    // 2. Get ULP mapping
    const { headerRowIdx: ulpHeaderIdx, colIndices: ulpCols } = findHeaderAndCols(ulpRows, ["id", "name"]);
    const ulpIdIdx = ulpCols[0];
    const ulpNameIdx = ulpCols[1];
    const ulpMap = new Map<string, string>();
    if (ulpIdIdx !== -1 && ulpNameIdx !== -1) {
      ulpRows.slice(ulpHeaderIdx + 1).forEach(row => {
        const id = String(row[ulpIdIdx] || "").trim();
        const name = String(row[ulpNameIdx] || "").trim();
        if (id && name) ulpMap.set(id, name);
      });
    }

    // 3. Aggregate WO data (Column K: Name, Column AQ: CCTV, Column R: Date, Column N: No Laporan, Column J: Nama Regu)
    const { headerRowIdx: woHeaderIdx, colIndices: woCols } = findHeaderAndCols(woRows, ["nama petugas", "cctv", "tanggal", "no laporan", "nama regu", "ulp"]);
    const woNameIdx = woCols[0] !== -1 ? woCols[0] : 10; // Column K
    const woCctvIdx = woCols[1] !== -1 ? woCols[1] : 42; // Column AQ
    const woDateIdx = woCols[2] !== -1 ? woCols[2] : 17; // Column R (index 17)
    const woIdIdx = woCols[3] !== -1 ? woCols[3] : 13;   // Column N (index 13)
    const woReguIdx = woCols[4] !== -1 ? woCols[4] : 9;   // Column J (index 9)
    const woUlpIdx = woCols[5];

    const woDataStart = woHeaderIdx !== -1 ? woHeaderIdx + 1 : 0;
    
    // Track unique reports at different levels
    const globalWoReports = new Map<string, boolean>(); // reportId -> hasCctv
    const officerWoReports = new Map<string, Map<string, boolean>>(); // officerName -> reportId -> hasCctv
    
    // We need to know which ULP an officer belongs to for ULP-level unique counting
    // We'll use the officers list we built earlier
    const officerToUlp = new Map<string, string>();
    officers.forEach(o => {
      let ulpName = ulpMap.get(o.ulpId) || o.directUlp || "Unknown";
      ulpName = ulpName.replace(/^POSKO ULP\s+/i, "").trim();
      officerToUlp.set(cleanName(o.name), ulpName);
    });

    const ulpWoReports = new Map<string, Map<string, boolean>>(); // ulpName -> reportId -> hasCctv
    const officerWoRawStats = new Map<string, { total: number; cctv: number }>(); // officerName -> raw counts
    const filteredWoRows: any[][] = [];

    woRows.slice(woDataStart).forEach(row => {
      if (row.length <= woNameIdx) return;
      
      const dateVal = String(row[woDateIdx] || "").trim();
      const rowDate = parseSheetDate(dateVal);
      if (!isWithinRange(rowDate)) return;

      const name = cleanName(row[woNameIdx]);
      if (!name || name === "NAMAPETUGAS" || name === "NAME") return;
      
      // Try to get ULP from row first, then fallback to officer mapping
      let ulpName = "Unknown";
      if (woUlpIdx !== -1 && row[woUlpIdx]) {
        ulpName = String(row[woUlpIdx]).trim();
      } else {
        ulpName = officerToUlp.get(name) || "Unknown";
      }

      const reguValue = String(row[woReguIdx] || "").trim();
      if (!isValidRegu(ulpName, reguValue)) return;
      
      // Normalize ULP name for consistent mapping
      const displayUlpName = ulpName.toUpperCase().replace(/^POSKO ULP\s+/i, "").trim();

      const reportId = String(row[woIdIdx] || "").trim();
      if (!reportId) return;

      const cctvVal = row.length > woCctvIdx ? String(row[woCctvIdx] || "").trim().toUpperCase() : "";
      const isCctv = cctvVal.includes("CCTV");

      // Collect filtered row
      filteredWoRows.push(row);

      // Global level (Unique)
      globalWoReports.set(reportId, (globalWoReports.get(reportId) || false) || isCctv);

      // Officer level (Unique - for internal tracking if needed, but we'll use raw for display)
      if (!officerWoReports.has(name)) officerWoReports.set(name, new Map());
      const oReports = officerWoReports.get(name)!;
      oReports.set(reportId, (oReports.get(reportId) || false) || isCctv);

      // Officer level (Raw - per user request)
      const raw = officerWoRawStats.get(name) || { total: 0, cctv: 0 };
      officerWoRawStats.set(name, {
        total: raw.total + 1,
        cctv: raw.cctv + (isCctv ? 1 : 0)
      });

      // ULP level (Unique)
      if (!ulpWoReports.has(displayUlpName)) ulpWoReports.set(displayUlpName, new Map());
      const uReports = ulpWoReports.get(displayUlpName)!;
      uReports.set(reportId, (uReports.get(reportId) || false) || isCctv);
    });

    // Calculate WO Stats
    let totalWoCount = 0;
    let totalWoCctvCount = 0;
    globalWoReports.forEach(hasCctv => {
      totalWoCount++;
      if (hasCctv) totalWoCctvCount++;
    });

    const woStatsMap = new Map<string, { total: number; cctv: number }>();
    officerWoReports.forEach((reports, name) => {
      let t = 0, c = 0;
      reports.forEach(hasCctv => {
        t++;
        if (hasCctv) c++;
      });
      woStatsMap.set(name, { total: t, cctv: c });
    });

    const ulpWoStatsMap = new Map<string, { total: number; cctv: number }>();
    ulpWoReports.forEach((reports, ulp) => {
      let t = 0, c = 0;
      reports.forEach(hasCctv => {
        t++;
        if (hasCctv) c++;
      });
      ulpWoStatsMap.set(ulp, { total: t, cctv: c });
    });

    // 4. Aggregate PO data (Column K: Name, Column Y: CCTV, Column O: Date, Column E: No Tugas, Column I: Nama Regu)
    const { headerRowIdx: poHeaderIdx, colIndices: poCols } = findHeaderAndCols(poRows, ["nama petugas", "cctv", "tanggal", "no tugas", "nama regu", "ulp"]);
    const poNameIdx = poCols[0] !== -1 ? poCols[0] : 10; // Column K
    const poCctvIdx = poCols[1] !== -1 ? poCols[1] : 24; // Column Y
    const poDateIdx = poCols[2] !== -1 ? poCols[2] : 14; // Column O (index 14)
    const poIdIdx = poCols[3] !== -1 ? poCols[3] : 4;    // Column E (index 4)
    const poReguIdx = poCols[4] !== -1 ? poCols[4] : 8;    // Column I (index 8)
    const poUlpIdx = poCols[5];

    const poDataStart = poHeaderIdx !== -1 ? poHeaderIdx + 1 : 0;
    
    const globalPoTasks = new Map<string, boolean>();
    const officerPoTasks = new Map<string, Map<string, boolean>>();
    const ulpPoTasks = new Map<string, Map<string, boolean>>();
    const officerPoRawStats = new Map<string, { total: number; cctv: number }>(); // officerName -> raw counts
    const filteredPoRows: any[][] = [];

    poRows.slice(poDataStart).forEach(row => {
      if (row.length <= poNameIdx) return;

      const dateVal = String(row[poDateIdx] || "").trim();
      const rowDate = parseSheetDate(dateVal);
      if (!isWithinRange(rowDate)) return;

      const name = cleanName(row[poNameIdx]);
      if (!name || name === "NAMAPETUGAS" || name === "NAME") return;
      
      // Try to get ULP from row first, then fallback to officer mapping
      let ulpName = "Unknown";
      if (poUlpIdx !== -1 && row[poUlpIdx]) {
        ulpName = String(row[poUlpIdx]).trim();
      } else {
        ulpName = officerToUlp.get(name) || "Unknown";
      }

      const reguValue = String(row[poReguIdx] || "").trim();
      if (!isValidRegu(ulpName, reguValue)) return;

      // Normalize ULP name for consistent mapping
      const displayUlpName = ulpName.toUpperCase().replace(/^POSKO ULP\s+/i, "").trim();

      const taskId = String(row[poIdIdx] || "").trim();
      if (!taskId) return;

      const cctvVal = row.length > poCctvIdx ? String(row[poCctvIdx] || "").trim().toUpperCase() : "";
      const isCctv = cctvVal.includes("CCTV");

      // Collect filtered row
      filteredPoRows.push(row);

      // Global level (Unique)
      globalPoTasks.set(taskId, (globalPoTasks.get(taskId) || false) || isCctv);

      // Officer level (Unique)
      if (!officerPoTasks.has(name)) officerPoTasks.set(name, new Map());
      const oTasks = officerPoTasks.get(name)!;
      oTasks.set(taskId, (oTasks.get(taskId) || false) || isCctv);

      // Officer level (Raw - per user request)
      const raw = officerPoRawStats.get(name) || { total: 0, cctv: 0 };
      officerPoRawStats.set(name, {
        total: raw.total + 1,
        cctv: raw.cctv + (isCctv ? 1 : 0)
      });

      // ULP level (Unique)
      if (!ulpPoTasks.has(displayUlpName)) ulpPoTasks.set(displayUlpName, new Map());
      const uTasks = ulpPoTasks.get(displayUlpName)!;
      uTasks.set(taskId, (uTasks.get(taskId) || false) || isCctv);
    });

    // Calculate PO Stats
    let totalPoCount = 0;
    let totalPoCctvCount = 0;
    globalPoTasks.forEach(hasCctv => {
      totalPoCount++;
      if (hasCctv) totalPoCctvCount++;
    });

    const poStatsMap = new Map<string, { total: number; cctv: number }>();
    officerPoTasks.forEach((tasks, name) => {
      let t = 0, c = 0;
      tasks.forEach(hasCctv => {
        t++;
        if (hasCctv) c++;
      });
      poStatsMap.set(name, { total: t, cctv: c });
    });

    const ulpPoStatsMap = new Map<string, { total: number; cctv: number }>();
    ulpPoTasks.forEach((tasks, ulp) => {
      let t = 0, c = 0;
      tasks.forEach(hasCctv => {
        t++;
        if (hasCctv) c++;
      });
      ulpPoStatsMap.set(ulp, { total: t, cctv: c });
    });

    // 5. Build the CCTVUsage list strictly based on PETUGAS list
    const mappedCctvUsage: CCTVUsage[] = officers.map((officer, index) => {
      const nameKey = cleanName(officer.name);
      // Use raw stats for officers as requested: "Untuk Kinerja Petugas tetap tidak berdasarkan ID Unik"
      const woStats = officerWoRawStats.get(nameKey) || { total: 0, cctv: 0 };
      const poStats = officerPoRawStats.get(nameKey) || { total: 0, cctv: 0 };
      
      let ulpName = ulpMap.get(officer.ulpId) || officer.directUlp || "Unknown";
      ulpName = ulpName.replace(/^POSKO ULP\s+/i, "").trim();

      const calculatePercent = (num: number, den: number) => {
        if (den === 0) return "0%";
        return `${Math.round((num / den) * 100)}%`;
      };

      return {
        no: index + 1,
        namaPetugas: officer.name,
        ulp: ulpName,
        jumlahWoTotal: woStats.total,
        totalWoPakaiCctv: woStats.cctv,
        persenWo: calculatePercent(woStats.cctv, woStats.total),
        jumlahPoTotal: poStats.total,
        totalPoPakaiCctv: poStats.cctv,
        persenPo: calculatePercent(poStats.cctv, poStats.total),
        persenPenggunaanCctv: calculatePercent(woStats.cctv + poStats.cctv, woStats.total + poStats.total)
      };
    });

    // 6. Sort by Total PO Pakai CCTV descending
    mappedCctvUsage.sort((a, b) => b.totalPoPakaiCctv - a.totalPoPakaiCctv);

    // 7. Aggregate ULP Performance using unique ID counts per ULP
    const allUlps = Array.from(new Set(officers.map(o => {
      let ulpName = ulpMap.get(o.ulpId) || o.directUlp || "Unknown";
      return ulpName.replace(/^POSKO ULP\s+/i, "").trim();
    })));

    const calculatePercent = (num: number, den: number) => {
      if (den === 0) {
        return num === 0 ? "100%" : "#DIV/0!";
      }
      return `${Math.round((num / den) * 100)}%`;
    };

    const ulpPerformance = allUlps.map(ulp => {
      const woStats = ulpWoStatsMap.get(ulp) || { total: 0, cctv: 0 };
      const poStats = ulpPoStatsMap.get(ulp) || { total: 0, cctv: 0 };
      
      return {
        ulp,
        jumlahWoTotal: woStats.total,
        totalWoPakaiCctv: woStats.cctv,
        persenWo: calculatePercent(woStats.cctv, woStats.total),
        jumlahPoTotal: poStats.total,
        totalPoPakaiCctv: poStats.cctv,
        persenPo: calculatePercent(poStats.cctv, poStats.total),
        persenPenggunaanCctv: calculatePercent(woStats.cctv + poStats.cctv, woStats.total + poStats.total)
      };
    });

    // Sort ULP by PO CCTV descending
    ulpPerformance.sort((a, b) => b.totalPoPakaiCctv - a.totalPoPakaiCctv);

    return {
      summary: {
        totalBaca: totalWoCount,
        totalValid: totalWoCctvCount,
        tidakValid: totalWoCount - totalWoCctvCount,
        totalPo: totalPoCount,
        totalPoCctv: totalPoCctvCount,
        lastSync: new Date().toLocaleTimeString('id-ID'),
        dataAktif: totalPoCount, // Per user request: "Ganti Data Aktif menghitung dari Sheet PO"
      },
      unitRecap: [
        { 
          unit: "UP3 BUKITTINGGI", 
          total: totalWoCount, 
          valid: totalWoCctvCount, 
          invalid: totalWoCount - totalWoCctvCount 
        },
      ],
      officerPerformance: mappedCctvUsage.map(u => ({
        name: u.namaPetugas,
        ulp: u.ulp,
        jumlahWoTotal: u.jumlahWoTotal,
        totalWoPakaiCctv: u.totalWoPakaiCctv,
        persenWo: u.persenWo,
        jumlahPoTotal: u.jumlahPoTotal,
        totalPoPakaiCctv: u.totalPoPakaiCctv,
        persenPo: u.persenPo
      })),
      ulpPerformance,
      cctvUsage: mappedCctvUsage,
      mainTable: [], // Can be populated from another sheet if needed
      rawWoRows: filteredWoRows,
      rawPoRows: filteredPoRows,
      woHeaders: woRows[woHeaderIdx] || [],
      poHeaders: poRows[poHeaderIdx] || [],
      woIndices: { name: woNameIdx, ulp: woUlpIdx, cctv: woCctvIdx },
      poIndices: { name: poNameIdx, ulp: poUlpIdx, cctv: poCctvIdx },
    };
  }
}
