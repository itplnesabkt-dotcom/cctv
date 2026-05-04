import { DashboardData, MainTableEntry, UnitRecap, OfficerPerformance, CCTVUsage } from "../types.ts";
import Papa from "papaparse";

export class GoogleSheetsService {
  private static SPREADSHEET_ID = "1lMwrFdf-VKmmWWZ_UU_XGkvhUWvH-t16ZL4lSjDbPRU";
  private static petugasCache: any[][] | null = null;
  private static ulpCache: any[][] | null = null;
  
  // Cache for raw data to make filtering smoother
  private static rawDataCache: {
    data: {
      woRows: any[][],
      poRows: any[][],
      petugasRows: any[][],
      ulpRows: any[][]
    },
    startDate?: string,
    endDate?: string,
    timestamp: number
  } | null = null;

  // Cache for date-filtered rows to speed up ULP filtering
  private static dateFilteredCache: {
    woRows: any[][],
    poRows: any[][],
    startDate?: string,
    endDate?: string
  } | null = null;

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

  private static cleanName(name: any): string {
    return String(name || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  private static normalizeForMatch(str: string): string {
    return String(str || "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  }

  private static parseSheetDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    let cleanStr = String(dateStr).trim();
    
    // 0. Handle Excel/Google Sheets serial dates (e.g., 46125.6963)
    if (/^\d{5}(\.\d+)?$/.test(cleanStr)) {
      const serial = parseFloat(cleanStr);
      const utcDays = serial - 25569;
      return new Date(Math.round(utcDays * 86400 * 1000));
    }
    
    // 1. Handle Google Sheets JSON date format: Date(2026,3,11,14,30,0)
    if (cleanStr.startsWith('Date(')) {
      const matches = cleanStr.match(/\d+/g);
      if (matches && matches.length >= 3) {
        return new Date(
          parseInt(matches[0]), 
          parseInt(matches[1]), 
          parseInt(matches[2]),
          matches[3] ? parseInt(matches[3]) : 0,
          matches[4] ? parseInt(matches[4]) : 0,
          matches[5] ? parseInt(matches[5]) : 0
        );
      }
    }

    cleanStr = cleanStr.replace(/^[a-z]+,\s*/i, "");
    
    const [datePart, timePart] = cleanStr.split(/\s+/);
    if (!datePart) return null;

    const dateParts = datePart.split(/[-/.]+/).filter(p => p.length > 0);
    if (dateParts.length >= 3) {
      let p1 = parseInt(dateParts[0], 10);
      let p2Str = dateParts[1].toLowerCase();
      let p3 = parseInt(dateParts[2], 10);
      
      let d = p1;
      let m = parseInt(p2Str, 10);
      let y = p3;

      if (p1 > 31) {
        y = p1;
        m = parseInt(p2Str, 10);
        d = parseInt(dateParts[2], 10);
      } else if (y < 100) {
        y = 2000 + y;
      }

      if (isNaN(m)) {
        const months: Record<string, number> = {
          'jan': 0, 'januari': 0, 'january': 0,
          'feb': 1, 'februari': 1, 'february': 1,
          'mar': 2, 'maret': 2, 'march': 2,
          'apr': 3, 'april': 3, 'mei': 4, 'may': 4,
          'jun': 5, 'juni': 5, 'june': 5,
          'jul': 6, 'juli': 6, 'july': 6,
          'agu': 7, 'agustus': 7, 'aug': 7, 'august': 7, 'agt': 7,
          'sep': 8, 'september': 8, 'okt': 9, 'oktober': 9, 'oct': 9, 'october': 9,
          'nov': 10, 'november': 10, 'des': 11, 'desember': 11, 'dec': 11, 'december': 11,
          'mrt': 2, 'agh': 7
        };
        if (months[p2Str] !== undefined) m = months[p2Str] + 1;
      }

      if (m > 12 && d <= 12) {
        const tmp = m; m = d; d = tmp;
      }

      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
          if (timePart) {
            const tParts = timePart.split(/[:.]+/);
            if (tParts.length >= 2) {
              date.setHours(parseInt(tParts[0], 10), parseInt(tParts[1], 10), tParts[2] ? parseInt(tParts[2], 10) : 0);
            }
          }
          return date;
        }
      }
    }

    const dObj = new Date(cleanStr);
    if (!isNaN(dObj.getTime())) {
      const isoMatch = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
      }
      return dObj;
    }
    
    return null;
  }

  private static findHeaderAndCols(rows: any[][], targets: string[]) {
    if (!rows || rows.length === 0) return { headerRowIdx: -1, colIndices: targets.map(() => -1) };
    let bestRowIdx = -1;
    let bestIndices = targets.map(() => -1);
    let maxMatches = 0;

    for (let r = 0; r < Math.min(rows.length, 50); r++) {
      const row = rows[r].map((h: any) => String(h || "").trim().toLowerCase());
      const indices = targets.map(target => {
        const t = target.toLowerCase();
        let idx = row.indexOf(t);
        if (idx !== -1) return idx;
        
        if (t === "nama petugas" || t === "name") {
          idx = row.findIndex(h => (h.includes("nama") && h.includes("petugas")) || h === "petugas" || h === "name" || h === "nama");
        } else if (t === "cctv") {
          idx = row.findIndex(h => h === "cctv" || h.includes("cctv"));
        } else if (t === "ulp") {
          idx = row.findIndex(h => h === "ulp" || h.includes("ulp") || h === "unit" || h === "posko" || h.includes("posko"));
        } else if (t === "tanggal") {
          idx = row.findIndex(h => h.includes("tgl lapor") || h.includes("tgl lap") || h.includes("tanggal") || h.includes("date") || h.includes("tgl"));
        } else if (t === "no laporan" || t === "no tugas") {
          idx = row.findIndex(h => (h.includes("no") && (h.includes("lap") || h.includes("tug"))) || h === "id" || h.includes("laporan id") || h.includes("id laporan") || h.includes("task id") || h.includes("id tugas"));
        } else if (t === "nama regu") {
          idx = row.findIndex(h => h.includes("regu") || h.includes("team"));
        } else if (t === "rpt") {
          idx = row.findIndex(h => h === "rpt" || h.toLowerCase().includes("rpt"));
        } else if (t === "rct") {
          idx = row.findIndex(h => h === "rct" || h.toLowerCase().includes("rct"));
        }
        return idx;
      });

      const matchedIndices = new Set(indices.filter(i => i !== -1));
      const matches = matchedIndices.size;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestRowIdx = r;
        bestIndices = indices;
      }
      if (matches >= targets.length - 1) break;
    }
    
    return maxMatches > 0 ? { headerRowIdx: bestRowIdx, colIndices: bestIndices } : { headerRowIdx: -1, colIndices: targets.map(() => -1) };
  }

  private static isValidRegu(ulpName: string, reguValue: string): boolean {
    const ulpToReguMap: Record<string, string> = {
      "BUKITTINGGI": "BUKITTINGGI",
      "PADANGPANJANG": "PADANGPANJANG",
      "LUBUKSIKAPING": "LUBUKSIKAPING",
      "LUBUKBASUNG": "LUBUKBASUNG",
      "SIMPANGEMPAT": "SIMPANGEMPAT",
      "BASO": "BASO",
      "KOTOTUO": "KOTOTUO"
    };
    const nUlp = this.normalizeForMatch(ulpName);
    const nRegu = this.normalizeForMatch(reguValue);
    const expectedRegu = ulpToReguMap[nUlp];
    if (!expectedRegu) return true; 
    return nRegu === expectedRegu;
  }

  static async fetchData(startDate?: string, endDate?: string, selectedUlp?: string): Promise<DashboardData> {
    const now = Date.now();
    let woRows: any[][], poRows: any[][], petugasRows: any[][], ulpRows: any[][];

    // 1. DATA ACQUISITION (Cached or Fresh)
    const canUseRawCache = this.rawDataCache && 
                           this.rawDataCache.startDate === startDate && 
                           this.rawDataCache.endDate === endDate && 
                           (now - this.rawDataCache.timestamp < 30000);

    if (canUseRawCache) {
      ({ woRows, poRows, petugasRows, ulpRows } = this.rawDataCache.data);
    } else {
      [woRows, poRows, petugasRows, ulpRows] = await Promise.all([
        this.fetchSheetDataRaw("WO"),
        this.fetchSheetDataRaw("PO"),
        this.petugasCache ? Promise.resolve(this.petugasCache) : this.fetchSheetDataRaw("PETUGAS").then(data => { this.petugasCache = data; return data; }),
        this.ulpCache ? Promise.resolve(this.ulpCache) : this.fetchSheetDataRaw("ULP").then(data => { this.ulpCache = data; return data; }),
      ]);

      if (woRows.length > 0 || poRows.length > 0) {
        this.rawDataCache = {
          data: { woRows, poRows, petugasRows, ulpRows },
          startDate,
          endDate,
          timestamp: now
        };
        // Reset date cache because raw data changed
        this.dateFilteredCache = null;
      }
    }


    // 1. Get ULP and Petugas data for mapping
    const ulpMap = new Map<string, string>();
    const { headerRowIdx: ulpHeaderIdx, colIndices: ulpCols } = this.findHeaderAndCols(ulpRows, ["id", "name"]);
    if (ulpCols[0] !== -1 && ulpCols[1] !== -1) {
      ulpRows.slice(ulpHeaderIdx + 1).forEach(row => {
        const id = String(row[ulpCols[0]] || "").trim();
        const name = String(row[ulpCols[1]] || "").trim();
        if (id && name) ulpMap.set(id, name);
      });
    }

    const { headerRowIdx: petugasHeaderIdx, colIndices: petugasCols } = this.findHeaderAndCols(petugasRows, ["name", "ulpId", "ulp"]);
    const officers: { name: string; ulpId: string; directUlp: string }[] = [];
    if (petugasCols[0] !== -1) {
      petugasRows.slice(petugasHeaderIdx + 1).forEach(row => {
        const name = String(row[petugasCols[0]] || "").trim();
        const ulpId = petugasCols[1] !== -1 ? String(row[petugasCols[1]] || "").trim() : "";
        const directUlp = petugasCols[2] !== -1 ? String(row[petugasCols[2]] || "").trim() : "";
        if (name && name.toLowerCase() !== "name" && name.toLowerCase() !== "nama") {
          officers.push({ name, ulpId, directUlp });
        }
      });
    }

    const officerToUlp = new Map<string, string>();
    officers.forEach(o => {
      let ulpName = (ulpMap.get(o.ulpId) || o.directUlp || "Unknown").toUpperCase().trim();
      officerToUlp.set(this.cleanName(o.name), ulpName);
    });

    // 2. Date ranges
    const sDate = startDate ? (() => { const [y, m, d] = startDate.split('-').map(Number); return new Date(y, m - 1, d); })() : null;
    const eDate = endDate ? (() => { const [y, m, d] = endDate.split('-').map(Number); const date = new Date(y, m - 1, d); date.setHours(23, 59, 59, 999); return date; })() : null;
    const isWithinRange = (date: Date | null) => {
      if (!sDate && !eDate) return true;
      if (!date) return false;
      const dTime = date.getTime();
      return (!sDate || dTime >= sDate.getTime()) && (!eDate || dTime <= eDate.getTime());
    };

    // 3. Aggregate WO data
    const woTargets = ["nama petugas", "cctv", "tanggal", "no laporan", "nama regu", "ulp", "tgl pengerjaan", "tgl selesai", "sumber laporan", "pelapor", "shift", "rpt", "rct", "durasi wo", "posko"];
    const { headerRowIdx: woHeaderIdx, colIndices: woCols } = this.findHeaderAndCols(woRows, woTargets);
    const woNameIdx = woCols[0] !== -1 ? woCols[0] : 10;
    const woCctvIdx = woCols[1] !== -1 ? woCols[1] : 42;
    const woDateIdx = woCols[2] !== -1 ? woCols[2] : 43; 
    const woIdIdx = woCols[3] !== -1 ? woCols[3] : 13;
    const woReguIdx = woCols[4] !== -1 ? woCols[4] : 9;
    const woUlpIdx = woCols[5];
    const woTglPengerjaanIdx = woCols[6] !== -1 ? woCols[6] : -1;
    const woTglSelesaiIdx = woCols[7] !== -1 ? woCols[7] : -1;
    const woSourceIdx = woCols[8] !== -1 ? woCols[8] : -1;
    const woReporterIdx = woCols[9] !== -1 ? woCols[9] : -1;
    const woShiftIdx = woCols[10] !== -1 ? woCols[10] : -1;
    const woRptIdx = woCols[11];
    const woRctIdx = woCols[12];
    const woDurasiWoIdx = woCols[13];
    const woPoskoIdx = woCols[14];

    const woDataStart = woHeaderIdx !== -1 ? woHeaderIdx + 1 : 0;
    
    const globalWoReports = new Map<string, boolean>();
    const officerWoReports = new Map<string, Map<string, boolean>>();
    const ulpWoReports = new Map<string, Map<string, boolean>>();
    const officerWoRawStats = new Map<string, { total: number; cctv: number }>();
    const filteredWoRows: any[][] = [];
    const allPoskosSet = new Set<string>();

    let highestRpt = 0, highestRct = 0, totalRpt = 0, totalRct = 0, rptCount = 0, rctCount = 0;
    const woOverSlaRptList: any[][] = [];
    const shiftMap = new Map<string, number>();
    const officerRptOverSla = new Map<string, number>();
    const officerRctOverSla = new Map<string, number>();
    const ulpMapDistribution = new Map<string, number>();
    const processedGlobalWoIds = new Set<string>();
    const rptOver30Ids = new Set<string>();
    const rptOver45Ids = new Set<string>();

    woRows.slice(woDataStart).forEach((row) => {
      if (row.length <= woDateIdx) return;
      const rowDate = this.parseSheetDate(String(row[woDateIdx] || "").trim());
      if (!isWithinRange(rowDate)) return;

      const nameRaw = String(row[woNameIdx] || "").trim();
      const nameKey = this.cleanName(nameRaw);
      if (!nameKey || nameKey === "NAMAPETUGAS" || nameKey === "NAME") return;
      
      let ulpName = (woUlpIdx !== -1 && row[woUlpIdx]) ? String(row[woUlpIdx]).trim() : (officerToUlp.get(nameKey) || "Unknown");
      let poskoName = (woPoskoIdx !== -1 && row[woPoskoIdx]) ? String(row[woPoskoIdx]).trim() : ulpName;
      
      const displayPoskoName = poskoName.toUpperCase().trim();
      if (displayPoskoName) allPoskosSet.add(displayPoskoName);

      const reguValue = String(row[woReguIdx] || "").trim();
      if (!this.isValidRegu(ulpName, reguValue)) return;
      
      const displayUlpName = ulpName.toUpperCase().trim();
      const isWithinUlp = !selectedUlp || displayUlpName === selectedUlp.toUpperCase().trim() || displayPoskoName === selectedUlp.toUpperCase().trim();

      const reportId = String(row[woIdIdx] || "").trim().toUpperCase();
      if (!reportId) return;

      const cctvVal = row.length > woCctvIdx ? String(row[woCctvIdx] || "").trim().toUpperCase() : "";
      const isCctv = cctvVal.includes("CCTV");

      // SLA Calculations
      const tglLapor = rowDate;
      const tglPengerjaan = woTglPengerjaanIdx !== -1 ? this.parseSheetDate(row[woTglPengerjaanIdx]) : null;
      const tglSelesai = woTglSelesaiIdx !== -1 ? this.parseSheetDate(row[woTglSelesaiIdx]) : null;

      let rpt = -1;
      if (woRptIdx !== -1 && row[woRptIdx]) {
        const val = parseFloat(String(row[woRptIdx]).replace(",", "."));
        if (!isNaN(val)) rpt = val;
      }
      if (rpt === -1 && tglLapor && tglPengerjaan) rpt = (tglPengerjaan.getTime() - tglLapor.getTime()) / 60000;

      let rctVal = -1;
      if (woRctIdx !== -1 && row[woRctIdx]) {
        const val = parseFloat(String(row[woRctIdx]).replace(",", "."));
        if (!isNaN(val)) rctVal = val;
      }
      if (rctVal === -1 && tglLapor && tglSelesai) rctVal = (tglSelesai.getTime() - tglLapor.getTime()) / 60000;

      if (isWithinUlp && rpt >= 30) {
        let durasiWo = rpt;
        if (woDurasiWoIdx !== -1 && row[woDurasiWoIdx]) {
          const val = parseFloat(String(row[woDurasiWoIdx]).replace(",", "."));
          if (!isNaN(val)) durasiWo = val;
        }
        woOverSlaRptList.push([reportId, tglLapor!.toLocaleString('id-ID'), nameRaw, Math.round(rpt * 100) / 100, rctVal >= 0 ? Math.round(rctVal * 100) / 100 : '-', durasiWo]);
      }

      if (isWithinUlp && !processedGlobalWoIds.has(reportId)) {
        processedGlobalWoIds.add(reportId);
        if (rpt > 30) rptOver30Ids.add(reportId);
        if (rpt > 45) rptOver45Ids.add(reportId);
        if (rpt >= 0) {
          if (rpt > highestRpt) highestRpt = rpt;
          totalRpt += rpt;
          rptCount++;
          if (rpt >= 30) {
            officerRptOverSla.set(nameRaw, (officerRptOverSla.get(nameRaw) || 0) + 1);
            ulpMapDistribution.set(displayUlpName, (ulpMapDistribution.get(displayUlpName) || 0) + 1);
          }
        }
        if (rctVal >= 0) {
          if (rctVal > highestRct) highestRct = rctVal;
          totalRct += rctVal;
          rctCount++;
          if (rctVal >= 60) officerRctOverSla.set(nameRaw, (officerRctOverSla.get(nameRaw) || 0) + 1);
        }
        const shift = String(row[woShiftIdx] || 'null').toUpperCase().trim();
        shiftMap.set(shift, (shiftMap.get(shift) || 0) + 1);
      }

      const raw = officerWoRawStats.get(nameKey) || { total: 0, cctv: 0 };
      officerWoRawStats.set(nameKey, { total: raw.total + 1, cctv: raw.cctv + (isCctv ? 1 : 0) });

      if (isWithinUlp) {
        globalWoReports.set(reportId, (globalWoReports.get(reportId) || false) || isCctv);
        filteredWoRows.push([...row]);
      }
      
      if (!officerWoReports.has(nameKey)) officerWoReports.set(nameKey, new Map());
      officerWoReports.get(nameKey)!.set(reportId, (officerWoReports.get(nameKey)!.get(reportId) || false) || isCctv);
      
      if (!ulpWoReports.has(displayUlpName)) ulpWoReports.set(displayUlpName, new Map());
      ulpWoReports.get(displayUlpName)!.set(reportId, (ulpWoReports.get(displayUlpName)!.get(reportId) || false) || isCctv);
    });

    // Calculate WO Stats
    let totalWoCount = 0;
    let totalWoCctvCount = 0;
    globalWoReports.forEach(hasCctv => {
      totalWoCount++;
      if (hasCctv) totalWoCctvCount++;
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

    // 4. Aggregate PO data
    const poTargets = ["nama petugas", "cctv", "tanggal", "no tugas", "nama regu", "ulp", "posko"];
    const { headerRowIdx: poHeaderIdx, colIndices: poCols } = this.findHeaderAndCols(poRows, poTargets);
    const poNameIdx = poCols[0] !== -1 ? poCols[0] : 10;
    const poCctvIdx = poCols[1] !== -1 ? poCols[1] : 24;
    const poDateIdx = 25; 
    const poIdIdx = poCols[3] !== -1 ? poCols[3] : 4;
    const poReguIdx = poCols[4] !== -1 ? poCols[4] : 8;
    const poUlpIdx = poCols[5];
    const poPoskoIdx = poCols[6];

    const globalPoTasks = new Map<string, boolean>();
    const officerPoTasks = new Map<string, Map<string, boolean>>();
    const ulpPoTasks = new Map<string, Map<string, boolean>>();
    const officerPoRawStats = new Map<string, { total: number; cctv: number }>();
    const filteredPoRows: any[][] = [];

    const poDataStart = poHeaderIdx !== -1 ? poHeaderIdx + 1 : 0;
    poRows.slice(poDataStart).forEach((row) => {
      if (row.length <= poDateIdx) return;
      const rowDate = this.parseSheetDate(String(row[poDateIdx] || "").trim());
      if (!isWithinRange(rowDate)) return;

      const nameKey = this.cleanName(row[poNameIdx]);
      if (!nameKey || nameKey === "NAMAPETUGAS" || nameKey === "NAME") return;
      
      let ulpName = (poUlpIdx !== -1 && row[poUlpIdx]) ? String(row[poUlpIdx]).trim() : (officerToUlp.get(nameKey) || "Unknown");
      let poskoName = (poPoskoIdx !== -1 && row[poPoskoIdx]) ? String(row[poPoskoIdx]).trim() : ulpName;

      const reguValue = String(row[poReguIdx] || "").trim();
      if (!this.isValidRegu(ulpName, reguValue)) return;
      
      const displayUlpName = ulpName.toUpperCase().replace(/^POSKO ULP\s+/i, "").trim();
      const displayPoskoName = poskoName.toUpperCase().trim();
      const isWithinUlp = !selectedUlp || displayUlpName === selectedUlp.toUpperCase().trim() || displayPoskoName === selectedUlp.toUpperCase().trim();

      const taskId = String(row[poIdIdx] || "").trim();
      if (!taskId) return;

      const cctvVal = row.length > poCctvIdx ? String(row[poCctvIdx] || "").trim().toUpperCase() : "";
      const isCctv = cctvVal.includes("CCTV");

      if (isWithinUlp) {
        filteredPoRows.push([...row]);
        globalPoTasks.set(taskId, (globalPoTasks.get(taskId) || false) || isCctv);
      }
      
      if (!officerPoTasks.has(nameKey)) officerPoTasks.set(nameKey, new Map());
      officerPoTasks.get(nameKey)!.set(taskId, (officerPoTasks.get(nameKey)!.get(taskId) || false) || isCctv);
      
      const raw = officerPoRawStats.get(nameKey) || { total: 0, cctv: 0 };
      officerPoRawStats.set(nameKey, { total: raw.total + 1, cctv: raw.cctv + (isCctv ? 1 : 0) });
      
      if (!ulpPoTasks.has(displayUlpName)) ulpPoTasks.set(displayUlpName, new Map());
      ulpPoTasks.get(displayUlpName)!.set(taskId, (ulpPoTasks.get(displayUlpName)!.get(taskId) || false) || isCctv);
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

    // 5. Build output objects
    const calculatePercent = (num: number, den: number) => den === 0 ? "100%" : `${Math.round((num / den) * 100)}%`;

    const mappedCctvUsage: CCTVUsage[] = officers.map((officer, index) => {
      const nameKey = this.cleanName(officer.name);
      // Use raw stats for officers as requested: "Untuk Kinerja Petugas tetap tidak berdasarkan ID Unik"
      const woStats = officerWoRawStats.get(nameKey) || { total: 0, cctv: 0 };
      const poStats = officerPoRawStats.get(nameKey) || { total: 0, cctv: 0 };
      
      let ulpName = (ulpMap.get(officer.ulpId) || officer.directUlp || "Unknown");
      ulpName = ulpName.replace(/^POSKO ULP\s+/i, "").trim();

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
      let ulpName = (ulpMap.get(o.ulpId) || o.directUlp || "Unknown").toUpperCase().trim();
      return ulpName;
    })));

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
      allUlps,
      allPoskos: Array.from(allPoskosSet).sort(),
      overSla: {
        totalGangguan: totalWoCount,
        highestRpt: Math.round(highestRpt * 100) / 100,
        highestRct: Math.round(highestRct * 100) / 100,
        countRptOver30: rptOver30Ids.size,
        countRptOver45: rptOver45Ids.size,
        avgRpt: rptCount > 0 ? Math.round((totalRpt / rptCount) * 100) / 100 : 0,
        avgRct: rctCount > 0 ? Math.round((totalRct / rctCount) * 100) / 100 : 0,
        woOverSlaRptList: woOverSlaRptList
          .sort((a, b) => (b[5] as number) - (a[5] as number)) // Sort by durasiWo
          .map(row => row.slice(0, 5)) // Remove durasiWo from output
          .slice(0, 50),
        shiftDistribution: Array.from(shiftMap.entries()).map(([name, value]) => ({ name, value })),
        officerOverSlaRpt: Array.from(officerRptOverSla.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        officerOverSlaRct: Array.from(officerRctOverSla.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        ulpDistribution: Array.from(ulpWoStatsMap.entries())
          .map(([name, stats]) => ({ name, value: stats.total }))
          .sort((a, b) => b.value - a.value),
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
      woIndices: { 
        name: woNameIdx, ulp: woUlpIdx, cctv: woCctvIdx, 
        tglLapor: woDateIdx, tglPengerjaan: woTglPengerjaanIdx, tglSelesai: woTglSelesaiIdx,
        source: woSourceIdx, reporter: woReporterIdx, shift: woShiftIdx
      },
      poIndices: { name: poNameIdx, ulp: poUlpIdx, cctv: poCctvIdx },
    };
  }
}
