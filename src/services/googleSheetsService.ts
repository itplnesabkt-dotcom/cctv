import { DashboardData, OfficerPerformance, CCTVUsage, OfficerRating, KPRating, ULPRating } from "../types.ts";
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
      ulpRows: any[][],
      poskoRows: any[][],
      ratingRows: any[][]
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
          continue;
        }
        
        const csvText = await response.text();
        
        // If we get HTML, it means we're likely being redirected to a login page or error page
        if (!csvText || csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes('<html') || csvText.includes('google-signin')) {
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
                resolve([]);
              }
            },
            error: (error: any) => reject(error),
          });
        });
      } catch (error) {
        // Silent error
      }
    }

    return [];
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

    // 0.5 Remove leading day names (e.g. "Monday, ", "Mon ", "Senin ")
    cleanStr = cleanStr.replace(/^[a-z]{3,}[,\s]*/i, "")
      .replace(/[,\(\)\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    
    if (!cleanStr) return null;

    // 1. Try to isolate time (e.g., "10:00:00", "10.00.00", "10:00 PM", "10:00:00 WIB")
    let timePart: string | undefined;
    
    // Improved time regex: look for HH:MM or HH:MM:SS with optional AM/PM and optional trailing timezone like WIB
    // We favor colons as they are unambiguous times. Dots are fallback.
    const timeMatch = cleanStr.match(/(\d{1,2}[:]\d{1,2}([:]\d{1,2})?(\s*?([AaPp][Mm]))?)(\s*[a-zA-Z]+)?$/i) || 
                      cleanStr.match(/\s+(\d{1,2}[:.]\d{1,2}([:.]\d{1,2})?(\s*?([AaPp][Mm]))?)(\s*[a-zA-Z]+)?$/i);
    
    if (timeMatch) {
      const fullMatch = timeMatch[0];
      timePart = timeMatch[1];
      if (timePart) {
        cleanStr = cleanStr.replace(fullMatch, "").replace(/\s+/g, " ").trim();
      }
    }

    const datePart = cleanStr;
    const dateParts = datePart.split(/[-/ .]+/).filter(p => p.length > 0);
    
    let d = 1, m = 1, y = 1970;

    const months: Record<string, number> = {
      'jan': 0, 'januari': 0, 'january': 0, '01': 0,
      'feb': 1, 'februari': 1, 'february': 1, '02': 1,
      'mar': 2, 'maret': 2, 'march': 2, 'mrt': 2, '03': 2,
      'apr': 3, 'april': 3, '04': 3,
      'mei': 4, 'may': 4, '05': 4,
      'jun': 5, 'juni': 5, 'june': 5, '06': 5,
      'jul': 6, 'juli': 6, 'july': 6, '07': 6,
      'agu': 7, 'agustus': 7, 'aug': 7, 'august': 7, 'agt': 7, '08': 7, 'agh': 7,
      'sep': 8, 'september': 8, '09': 8,
      'okt': 9, 'oktober': 9, 'oct': 9, 'october': 9, '10': 9,
      'nov': 10, 'november': 10, '11': 10,
      'des': 11, 'desember': 11, 'dec': 11, 'december': 11, '12': 11
    };

    if (dateParts.length >= 3) {
      const p1 = dateParts[0].toLowerCase();
      const p2 = dateParts[1].toLowerCase();
      const p3 = dateParts[2].toLowerCase();

      // Case 1: YYYY MM DD or YYYY DD MM
      if (p1.length === 4 && !isNaN(parseInt(p1))) {
        y = parseInt(p1);
        if (months[p2] !== undefined) {
          m = months[p2] + 1;
          d = parseInt(p3);
        } else {
          m = parseInt(p2);
          d = parseInt(p3);
        }
      } 
      // Case 2: DD MM YYYY or MM DD YYYY
      else if (p3.length === 4 || p3.length === 2) {
        y = parseInt(p3);
        if (y < 100) y = (y > 70 ? 1900 : 2000) + y;

        if (months[p1] !== undefined) {
          // Month Name first: Jan 13 2026
          m = months[p1] + 1;
          d = parseInt(p2);
        } else if (months[p2] !== undefined) {
          // Month Name in middle: 13 Jan 2026
          m = months[p2] + 1;
          d = parseInt(p1);
        } else {
          // Numeric: 13/05/2026
          d = parseInt(p1);
          m = parseInt(p2);
        }
      }

      // Final validity & swap check if needed
      if (m > 12 && d <= 12) {
        const tmp = m; m = d; d = tmp;
      }

      if (!isNaN(d) && !isNaN(m) && !isNaN(y) && m > 0 && m <= 12 && d > 0 && d <= 31) {
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
          if (timePart) {
            const isPM = /pm/i.test(timePart);
            const isAM = /am/i.test(timePart);
            const tParts = timePart.replace(/[apm\s]/ig, "").split(/[:.]+/);
            if (tParts.length >= 2) {
              let hh = parseInt(tParts[0], 10);
              let mm = parseInt(tParts[1], 10);
              let ss = tParts[2] ? parseInt(tParts[2], 10) : 0;
              
              if (hh < 12 && isPM) hh += 12;
              if (hh === 12 && isAM) hh = 0;
              
              date.setHours(hh, mm, ss);
            }
          } else {
            date.setHours(0, 0, 0, 0);
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
        } else if (t === "tgl lapor") {
          idx = row.findIndex(h => h === "tgl lapor" || h.includes("tgl lapor") || h.includes("tgl lap"));
        } else if (t === "tgl") {
          idx = row.indexOf("tgl");
          if (idx === -1) idx = row.findIndex(h => h === "tgl");
        } else if (t === "tanggal") {
          idx = row.findIndex(h => h === "tanggal" || h.includes("tanggal") || h.includes("date") || h.includes("tgl"));
        } else if (t === "no laporan" || t === "no tugas") {
          idx = row.findIndex(h => (h.includes("no") && (h.includes("lap") || h.includes("tug"))) || h === "id" || h.includes("laporan id") || h.includes("id laporan") || h.includes("task id") || h.includes("id tugas"));
        } else if (t === "ulp" || t === "ulp id" || t === "ulpid") {
          idx = row.findIndex(h => h === "ulp" || h === "ulpid" || h === "ulp_id" || h === "ulp id" || h.includes("ulp") || h === "unit" || h === "posko" || h.includes("posko"));
        } else if (t === "apkt status" || t === "status apkt") {
          idx = row.findIndex(h => h.toLowerCase().includes("status") && h.toLowerCase().includes("apkt"));
        } else if (t === "nama regu") {
          idx = row.findIndex(h => h.includes("regu") || h.includes("team"));
        } else if (t === "rating") {
          idx = row.findIndex(h => h === "rating" || h.includes("bintang") || h.includes("skor") || h.startsWith("star"));
        } else if (t === "check in petugas") {
          idx = row.findIndex(h => h.includes("check in") && h.includes("petugas"));
        } else if (t === "tgl penugasan regu") {
          idx = row.findIndex(h => h === "tgl penugasan regu" || (h.includes("tgl") && (h.includes("penugasan") || h.includes("assign"))));
        } else if (t === "tgl dalam perjalanan") {
          idx = row.findIndex(h => h === "tgl dalam perjalanan" || (h.includes("tgl") && h.includes("perjalanan")));
        } else if (t === "tgl nyala") {
          idx = row.findIndex(h => h === "tgl nyala" || (h.includes("tgl") && h.includes("nyala")));
        } else if (t === "check out petugas") {
          idx = row.findIndex(h => h.includes("check out") && h.includes("petugas"));
        } else if (t === "tgl pengerjaan") {
          idx = row.findIndex(h => h.includes("tgl") && h.includes("pengerjaan"));
        } else if (t === "tgl selesai") {
          idx = row.findIndex(h => h.includes("tgl") && h.includes("selesai"));
        } else if (t === "sumber laporan") {
          idx = row.findIndex(h => h.includes("sumber") && (h.includes("lapor") || h.includes("src")));
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
    const ALLOWED_REGUS = ["BUKITTINGGI", "PADANGPANJANG", "LUBUKBASUNG", "LUBUKSIKAPING", "SIMPANGEMPAT", "BASO", "KOTOTUO"];
    const isUp3Regu = (r: string) => {
      if (!r) return false;
      const normalized = r.toUpperCase().replace(/\s+/g, "").trim();
      return ALLOWED_REGUS.includes(normalized);
    };

    const standardizeUlpName = (name: string) => {
      if (!name) return "";
      return name.toUpperCase()
        .replace(/^POSKO ULP\s+/i, "")
        .replace(/^ULP\s+/i, "")
        .replace(/^POSKO\s+/i, "")
        .trim();
    };

    const allRegusInUlp = new Map<string, string>(); // Regu -> ULP

    const now = Date.now();
    let woRows: any[][], poRows: any[][], petugasRows: any[][], ulpRows: any[][], poskoRows: any[][], ratingRows: any[][];
    const woOverSlaRptList: any[][] = [];

    // 1. DATA ACQUISITION (Cached or Fresh)
    const canUseRawCache = this.rawDataCache && 
                           this.rawDataCache.startDate === startDate && 
                           this.rawDataCache.endDate === endDate && 
                           (now - this.rawDataCache.timestamp < 30000);

    if (canUseRawCache) {
      const cached = this.rawDataCache!.data;
      woRows = cached.woRows;
      poRows = cached.poRows;
      petugasRows = cached.petugasRows;
      ulpRows = cached.ulpRows;
      poskoRows = cached.poskoRows;
      ratingRows = cached.ratingRows;
    } else {
      [woRows, poRows, petugasRows, ulpRows, poskoRows, ratingRows] = await Promise.all([
        this.fetchSheetDataRaw("WO"),
        this.fetchSheetDataRaw("PO"),
        this.petugasCache ? Promise.resolve(this.petugasCache) : this.fetchSheetDataRaw("PETUGAS").then(data => { this.petugasCache = data; return data; }),
        this.ulpCache ? Promise.resolve(this.ulpCache) : this.fetchSheetDataRaw("ULP").then(data => { this.ulpCache = data; return data; }),
        this.fetchSheetDataRaw("POSKO"),
        this.fetchSheetDataRaw("RATING"),
      ]);

      if (woRows.length > 0 || poRows.length > 0) {
        this.rawDataCache = {
          data: { woRows, poRows, petugasRows, ulpRows, poskoRows, ratingRows },
          startDate,
          endDate,
          timestamp: now
        };
        // Reset date cache because raw data changed
        this.dateFilteredCache = null;
      }
    }


    // 1. Get ULP, POSKO and Petugas data for mapping
    const ulpMap = new Map<string, string>();
    const { headerRowIdx: ulpHeaderIdx, colIndices: ulpCols } = this.findHeaderAndCols(ulpRows, ["id", "name"]);
    if (ulpCols[0] !== -1 && ulpCols[1] !== -1) {
      ulpRows.slice(ulpHeaderIdx + 1).forEach(row => {
        const id = String(row[ulpCols[0]] || "").trim();
        const name = String(row[ulpCols[1]] || "").trim();
        if (id && name) ulpMap.set(id, name);
      });
    }

    const poskoToUlpIdMap = new Map<string, string>();
    const { headerRowIdx: poskoHeaderIdx, colIndices: poskoCols } = this.findHeaderAndCols(poskoRows, ["posko", "poskoid", "ulp_id"]);
    if (poskoCols[0] !== -1) {
      poskoRows.slice(poskoHeaderIdx + 1).forEach(row => {
        const poskoName = this.normalizeForMatch(String(row[poskoCols[0]] || ""));
        const ulpId = String(row[poskoCols[1]] !== undefined ? row[poskoCols[1]] : (row[poskoCols[2]] || "")).trim();
        if (poskoName && ulpId) poskoToUlpIdMap.set(poskoName, ulpId);
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

    const getCanonicalUlpName = (name: string) => {
      if (!name) return "";
      const u = name.toUpperCase().trim();
      if (u.includes("BUKITTINGGI")) return "BUKITTINGGI";
      if (u.includes("PADANG PANJANG") || u.includes("PADANGPANJANG")) return "PADANG PANJANG";
      if (u.includes("LUBUK SIKAPING")) return "LUBUK SIKAPING";
      if (u.includes("LUBUK BASUNG")) return "LUBUK BASUNG";
      if (u.includes("SIMPANG EMPAT")) return "SIMPANG EMPAT";
      if (u.includes("BASO")) return "BASO";
      if (u.includes("KOTO TUO") || u.includes("KOTOTUO")) return "KOTO TUO";
      return name;
    }

    const officerToUlp = new Map<string, string>();
    const officerToName = new Map<string, string>();
    officers.forEach(o => {
      let ulpName = (ulpMap.get(o.ulpId) || o.directUlp || "Unknown");
      let standardized = standardizeUlpName(ulpName);
      ulpName = getCanonicalUlpName(standardized);
      const nKey = this.cleanName(o.name);
      officerToUlp.set(nKey, ulpName);
      officerToName.set(nKey, o.name);
    });

    // Determine official ULPs list beforehand for REGEX-style matching
    const allUlpsOrder = ["BUKITTINGGI", "PADANG PANJANG", "LUBUK BASUNG", "LUBUK SIKAPING", "SIMPANG EMPAT", "BASO", "KOTO TUO"];
    const allUlps = Array.from(new Set(officers.map(o => {
      let ulpName = (ulpMap.get(o.ulpId) || o.directUlp || "Unknown");
      let standardized = standardizeUlpName(ulpName);
      return getCanonicalUlpName(standardized);
    }))).filter(u => u !== "UNKNOWN" && isUp3Regu(u))
    .sort((a, b) => {
      const idxA = allUlpsOrder.indexOf(a);
      const idxB = allUlpsOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const getExpectedRegu = (ulpName: string) => {
      const u = ulpName.toUpperCase().trim();
      if (u.includes("BUKITTINGGI")) return "BUKITTINGGI";
      if (u.includes("PADANG PANJANG") || u.includes("PADANGPANJANG")) return "PADANGPANJANG";
      if (u.includes("LUBUK SIKAPING")) return "LUBUK SIKAPING";
      if (u.includes("LUBUK BASUNG")) return "LUBUK BASUNG";
      if (u.includes("SIMPANG EMPAT")) return "SIMPANG EMPAT";
      if (u.includes("BASO")) return "BASO";
      if (u.includes("KOTO TUO") || u.includes("KOTOTUO")) return "KOTOTUO";
      return u;
    };

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
    const woTargets = [
      "nama petugas", "cctv", "tgl", "no laporan", "nama regu", 
      "ulp", "tgl pengerjaan", "tgl selesai", "sumber lapor", "pelapor", 
      "shift", "rpt", "rct", "durasi wo", "posko", "rating", "poskoid", "apkt status",
      "check in petugas", "tgl penugasan regu", "tgl dalam perjalanan", "tgl nyala", "check out petugas",
      "tgl lapor"
    ];
    const { headerRowIdx: woHeaderIdx, colIndices: woCols } = this.findHeaderAndCols(woRows, woTargets);
    const woNameIdx = woCols[0] !== -1 ? woCols[0] : 10;
    const woCctvIdx = woCols[1] !== -1 ? woCols[1] : 42;
    const woDateIdx = woCols[2] !== -1 ? woCols[2] : (woCols[19] !== -1 ? woCols[19] : (woCols[6] !== -1 ? woCols[6] : 2)); 
    const woIdIdx = woCols[3] !== -1 ? woCols[3] : 13;
    const woReguIdx = woCols[4] !== -1 ? woCols[4] : 9;
    const woUlpIdx = woCols[5];
    const woTglPengerjaanIdx = woCols[6];
    const woTglSelesaiIdx = woCols[7];
    const woSourceIdx = woCols[8];
    const woReporterIdx = woCols[9];
    const woShiftIdx = woCols[10];
    const woRptIdx = woCols[11];
    const woRctIdx = woCols[12];
    const woDurasiWoIdx = woCols[13];
    const woPoskoIdx = woCols[14];
    const woRatingIdx = woCols[15];
    const woPoskoidIdx = woCols[16];
    const woApktStatusIdx = woCols[17] !== -1 ? woCols[17] : 39;
    const woCheckInIdx = woCols[18];
    const woTglPenugasanIdx = woCols[19];
    const woTglPerjalananIdx = woCols[20];
    const woTglNyalaIdx = woCols[21];
    const woCheckOutIdx = woCols[22];
    const woTglLaporIdx = woCols[23] !== -1 ? woCols[23] : woDateIdx;

    const dateTimeIndices = [
      woDateIdx, woTglPengerjaanIdx, woTglSelesaiIdx, 
      woCheckInIdx, woTglPenugasanIdx, woTglPerjalananIdx, 
      woTglNyalaIdx, woCheckOutIdx, woTglLaporIdx
    ].filter(idx => idx !== -1);

    const formatDateTime = (date: Date | null) => {
      if (!date) return "";
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      const h = date.getHours().toString().padStart(2, '0');
      const min = date.getMinutes().toString().padStart(2, '0');
      const s = date.getSeconds().toString().padStart(2, '0');
      return `${d}/${m}/${y} ${h}:${min}:${s}`;
    };

    const woDataStart = woHeaderIdx !== -1 ? woHeaderIdx + 1 : 0;
    
    if (woReguIdx !== -1) {
      woRows.slice(woDataStart).forEach(row => {
        const regu = String(row[woReguIdx] || "").trim();
        if (regu && regu !== "Unknown" && regu.toLowerCase() !== "nama regu") {
          let rUlp = "Unknown";
          if (woUlpIdx !== -1 && woUlpIdx < row.length) {
            rUlp = getCanonicalUlpName(standardizeUlpName(String(row[woUlpIdx] || "")));
          } else if (woPoskoidIdx !== -1 && woPoskoidIdx < row.length) {
            const pId = String(row[woPoskoidIdx] || "").trim();
            rUlp = pId ? getCanonicalUlpName(standardizeUlpName(ulpMap.get(pId) || "")) : "Unknown";
          } else if (woPoskoIdx !== -1 && woPoskoIdx < row.length) {
            const pName = this.normalizeForMatch(String(row[woPoskoIdx] || ""));
            const uId = poskoToUlpIdMap.get(pName);
            rUlp = uId ? getCanonicalUlpName(standardizeUlpName(ulpMap.get(uId) || "")) : "Unknown";
          }
          if (!allRegusInUlp.has(regu) || (allRegusInUlp.get(regu) === "Unknown" && rUlp !== "Unknown")) {
            allRegusInUlp.set(regu, rUlp);
          }
        }
      });
    }

    // Aggregator for unique reports
    const uniqueWoMap = new Map<string, {
      id: string;
      rpt: number;
      rct: number;
      isCctv: boolean;
      name: string;
      ulp: string;
      posko: string;
      date: Date | null;
      dateRaw: string;
      shift: string;
      source: string;
      rating: number | null;
      ratingStr: string;
      durasiWo: number;
      regu: string;
      isPlnMobile: boolean;
      isWithinUlp: boolean;
      apktStatus: string;
      rawRow: any[];
    }>();

    const rawWoRowsFull: any[][] = [];
    const officerRptOverSlaCount = new Map<string, number>();
    const officerRctOverSlaCount = new Map<string, number>();
    const officerWoRawStats = new Map<string, { total: number; cctv: number }>();

    woRows.slice(woDataStart).forEach((row) => {
      if (!row || row.length < 3) return;
      
      const rawReportId = String(row[woIdIdx] || row[13] || "").trim();
      const reportId = this.normalizeForMatch(rawReportId);
      if (!reportId) return;

      const rowDateRaw = woDateIdx !== -1 && woDateIdx < row.length ? String(row[woDateIdx] || "").trim() : "";
      const rowDate = this.parseSheetDate(rowDateRaw);
      if (!isWithinRange(rowDate)) return;

      const nameRaw = woNameIdx !== -1 && woNameIdx < row.length ? String(row[woNameIdx] || "").trim() : "";
      const nameKey = this.cleanName(nameRaw);
      const properName = nameKey ? (officerToName.get(nameKey) || nameRaw) : nameRaw;
      
      const woPoskoValue = woPoskoIdx !== -1 && woPoskoIdx < row.length ? String(row[woPoskoIdx] || "").trim() : "";
      const normalizedPosko = this.normalizeForMatch(woPoskoValue);
      const poskoidFromMapping = poskoToUlpIdMap.get(normalizedPosko);
      const poskoidRaw = woPoskoidIdx !== -1 && woPoskoidIdx < row.length ? String(row[woPoskoidIdx] || "").trim() : "";
      const finalPoskoid = poskoidFromMapping || poskoidRaw;
      
      let ulpNameLookup = finalPoskoid ? ulpMap.get(finalPoskoid) : "";
      if (ulpNameLookup) ulpNameLookup = standardizeUlpName(ulpNameLookup);
      
      const ulpNameFromWo = (woUlpIdx !== -1 && woUlpIdx < row.length && row[woUlpIdx]) 
        ? standardizeUlpName(String(row[woUlpIdx]))
        : "";

      const officerUlp = nameKey ? officerToUlp.get(nameKey) : "";
      const ulpName = officerUlp || ulpNameLookup || ulpNameFromWo || "Unknown";
      const poskoName = woPoskoValue || ulpName;

      const standardizedDisplayUlp = getCanonicalUlpName(standardizeUlpName(ulpName));
      const standardizedDisplayPosko = getCanonicalUlpName(standardizeUlpName(poskoName));
      
      const targetUlpFilter = selectedUlp && selectedUlp !== "ALL" ? getCanonicalUlpName(standardizeUlpName(selectedUlp)) : null;
      const isWithinUlp = !targetUlpFilter || standardizedDisplayUlp === targetUlpFilter || standardizedDisplayPosko === targetUlpFilter;

      const cctvVal = row.length > woCctvIdx ? String(row[woCctvIdx] || "").trim().toUpperCase() : "";
      const isCctv = cctvVal.includes("CCTV");

      let rpt = -1;
      if (woRptIdx !== -1 && row[woRptIdx]) {
        const val = parseFloat(String(row[woRptIdx]).replace(",", "."));
        if (!isNaN(val)) rpt = val;
      }

      let rctVal = -1;
      if (woRctIdx !== -1 && row[woRctIdx]) {
        const val = parseFloat(String(row[woRctIdx]).replace(",", "."));
        if (!isNaN(val)) rctVal = val;
      }

      const sourceRaw = woSourceIdx !== -1 && woSourceIdx < row.length ? String(row[woSourceIdx] || "").trim().toUpperCase() : "";
      const isPlnMobile = sourceRaw === "PLN MOBILE";
      const apktStatus = woApktStatusIdx !== -1 && woApktStatusIdx < row.length ? String(row[woApktStatusIdx] || "").trim().toUpperCase() : "";
      const isSelesai = apktStatus === "SELESAI";
      const ratingStr = woRatingIdx !== -1 && woRatingIdx < row.length ? String(row[woRatingIdx] || "").trim() : "";
      const ratingVal = ratingStr === "" || isNaN(parseInt(ratingStr)) ? null : parseInt(ratingStr);
      
      let durasiWo = rpt;
      if (woDurasiWoIdx !== -1 && row[woDurasiWoIdx]) {
        const val = parseFloat(String(row[woDurasiWoIdx]).replace(",", "."));
        if (!isNaN(val)) durasiWo = val;
      }

      const reguValue = woReguIdx !== -1 && woReguIdx < row.length ? String(row[woReguIdx] || "").trim() : "";

      // Format date/time columns for raw output
      const rowToProcess = [...row];
      dateTimeIndices.forEach(idx => {
        if (idx < rowToProcess.length) {
          const val = String(rowToProcess[idx] || "").trim();
          if (val) {
            const parsed = this.parseSheetDate(val);
            if (parsed) rowToProcess[idx] = formatDateTime(parsed);
          }
        }
      });

      // Performance stats (count all reports as requested)
      const nameKeyForRaw = this.cleanName(nameRaw);
      if (nameKeyForRaw && nameKeyForRaw !== "NAMAPETUGAS" && nameKeyForRaw !== "NAME") {
        const raw = officerWoRawStats.get(nameKeyForRaw) || { total: 0, cctv: 0 };
        officerWoRawStats.set(nameKeyForRaw, { total: raw.total + 1, cctv: raw.cctv + (isCctv ? 1 : 0) });
      }

      // Add to Over SLA RPT list (include duplicates for the table specifically)
      const isUp3 = isUp3Regu(reguValue);
      if (isWithinUlp) {
        rawWoRowsFull.push([...rowToProcess]);
      }
      
      if (isWithinUlp && isUp3 && isSelesai) {
        if (rpt >= 30) {
          woOverSlaRptList.push([
            rawReportId.toUpperCase(),
            rowToProcess[woTglLaporIdx] || rowToProcess[woDateIdx] || rowDateRaw,
            properName,
            Math.round(rpt * 100) / 100,
            rctVal >= 0 ? Math.round(rctVal * 100) / 100 : '-',
            durasiWo
          ]);
          officerRptOverSlaCount.set(properName, (officerRptOverSlaCount.get(properName) || 0) + 1);
        }
        if (rctVal >= 45) {
          officerRctOverSlaCount.set(properName, (officerRctOverSlaCount.get(properName) || 0) + 1);
        }
      }

      const existing = uniqueWoMap.get(reportId);
      if (existing) {
        if (rpt > existing.rpt) {
          existing.rpt = rpt;
          if (woRptIdx !== -1) existing.rawRow[woRptIdx] = rpt;
        }
        if (rctVal > existing.rct) {
          existing.rct = rctVal;
          if (woRctIdx !== -1) existing.rawRow[woRctIdx] = rctVal;
        }
        if (isCctv) {
          existing.isCctv = true;
          if (woCctvIdx !== -1) existing.rawRow[woCctvIdx] = "CCTV";
        }
        if (durasiWo > existing.durasiWo) {
          existing.durasiWo = durasiWo;
          if (woDurasiWoIdx !== -1) existing.rawRow[woDurasiWoIdx] = durasiWo;
        }
        // Prefer row with rating if existing doesn't have one
        if (existing.rating === null && ratingVal !== null) {
          existing.rating = ratingVal;
          existing.ratingStr = ratingStr;
          if (woRatingIdx !== -1) existing.rawRow[woRatingIdx] = ratingStr;
        }
        // Prefer PLN Mobile source if existing is something else
        if (!existing.isPlnMobile && isPlnMobile) {
          existing.isPlnMobile = true;
          existing.source = sourceRaw;
          if (woSourceIdx !== -1) existing.rawRow[woSourceIdx] = sourceRaw;
        }
      } else {
        uniqueWoMap.set(reportId, {
          id: rawReportId.toUpperCase(),
          rpt,
          rct: rctVal,
          isCctv,
          name: properName,
          ulp: ulpName,
          posko: poskoName,
          date: rowDate,
          dateRaw: rowDateRaw,
          shift: String(row[woShiftIdx] || 'null').toUpperCase().trim(),
          source: sourceRaw,
          rating: ratingVal,
          ratingStr,
          durasiWo,
          regu: reguValue,
          isPlnMobile,
          isWithinUlp,
          apktStatus,
          rawRow: [...rowToProcess]
        });
      }
    });

    const globalWoReports = new Map<string, boolean>();
    const ulpWoReports = new Map<string, Map<string, boolean>>();
    const officerRatingStats = new Map<string, { totalWo: number; r5: number; r34: number; r12: number; noR: number; regu: string; ulp: string; displayName: string; }>();
    const kpRatingStats = new Map<string, { totalWo: number; r5: number; r34: number; r12: number; noR: number; ulp: string; }>();

    const filteredWoRows: any[][] = [];
    const allPoskosSet = new Set<string>();

    let highestRpt = 0, highestRct = 0, totalRpt = 0, totalRct = 0, rptCount = 0, rctCount = 0;
    // woOverSlaRptList, officerRptOverSlaCount, officerRctOverSlaCount are now populated in the first pass
    const shiftMap = new Map<string, number>();
    const rptOver30Ids = new Set<string>();
    const rptOver45Ids = new Set<string>();

    let totalRatingWo = 0, totalRating5 = 0, totalRating34 = 0, totalRating12 = 0, totalNoRating = 0;
    const totalWoPlnMobileList: any[][] = [];
    const rating5List: any[][] = [];
    const rating34List: any[][] = [];
    const rating12List: any[][] = [];
    const noRatingList: any[][] = [];

    // Pre-populate KP STATS with all regus
    allRegusInUlp.forEach((uName, rName) => {
      const standardizedRUlp = getCanonicalUlpName(standardizeUlpName(uName));
      const targetUlpFilter = selectedUlp && selectedUlp !== "ALL" ? getCanonicalUlpName(standardizeUlpName(selectedUlp)) : null;
      if (!targetUlpFilter || standardizedRUlp === targetUlpFilter) {
        kpRatingStats.set(rName, { totalWo: 0, r5: 0, r34: 0, r12: 0, noR: 0, ulp: uName });
      }
    });

    const ulpWoReportsAll = new Map<string, Map<string, boolean>>();
    const ulpWoReportsOverSla = new Map<string, Map<string, boolean>>();

    // Process Unique WO Data for stats
    let totalSlaGangguan = 0;
    uniqueWoMap.forEach((wo) => {
      if (wo.posko) allPoskosSet.add(wo.posko.toUpperCase().trim());
      
      const isUp3 = isUp3Regu(wo.regu);
      const isSelesai = wo.apktStatus === "SELESAI";

      // Match ULP strictly by NAMA REGU (especially for CCTV and Summary pages)
      const normRegu = String(wo.regu || "").toUpperCase().replace(/\s+/g, "").trim();
      const targetUlpFromRegu = allUlps.find(u => {
        const expected = getExpectedRegu(u).toUpperCase().replace(/\s+/g, "").trim();
        return expected === normRegu;
      });

      // Override for CCTV logic: summary cards on CCTV tab should respect Regu-based filter
      const targetUlpFilter = selectedUlp && selectedUlp !== "ALL" ? getCanonicalUlpName(standardizeUlpName(selectedUlp)) : null;
      const isCctvFiltered = !targetUlpFilter || (targetUlpFromRegu === targetUlpFilter);

      if (isUp3 && isCctvFiltered) {
        globalWoReports.set(wo.id, wo.isCctv);
      }

      if (targetUlpFromRegu) {
        if (!ulpWoReportsAll.has(targetUlpFromRegu)) ulpWoReportsAll.set(targetUlpFromRegu, new Map());
        ulpWoReportsAll.get(targetUlpFromRegu)!.set(wo.id, wo.isCctv);

        // Aggregate Over SLA stats strictly by Regu-based ULP mapping for charts
        if (isSelesai && wo.rpt >= 30) {
          if (!ulpWoReportsOverSla.has(targetUlpFromRegu)) ulpWoReportsOverSla.set(targetUlpFromRegu, new Map());
          ulpWoReportsOverSla.get(targetUlpFromRegu)!.set(wo.id, wo.isCctv);
        }
      }

      // 2. Original isWithinUlp logic for Rating and Over SLA (respects sheet-derived ULP/Posko)
      if (wo.isWithinUlp) {
        if (wo.isPlnMobile) {
          totalRatingWo++;
          const rowDetail = [wo.id, wo.dateRaw || "-", wo.name || "-", wo.ulp || "-", wo.ratingStr || "-", wo.source || "-"];
          totalWoPlnMobileList.push(rowDetail);
          if (wo.rating === null || wo.ratingStr === "") { totalNoRating++; noRatingList.push(rowDetail); }
          else if (wo.rating === 5) { totalRating5++; rating5List.push(rowDetail); }
          else if (wo.rating === 4 || wo.rating === 3) { totalRating34++; rating34List.push(rowDetail); }
          else if (wo.rating === 2 || wo.rating === 1) { totalRating12++; rating12List.push(rowDetail); }
        }

        const kpKey = wo.regu || "Unknown";
        if (kpKey !== "Unknown") {
          const kStats = kpRatingStats.get(kpKey) || { totalWo: 0, r5: 0, r34: 0, r12: 0, noR: 0, ulp: wo.ulp };
          if (wo.isPlnMobile) {
            kStats.totalWo++;
            if (wo.rating === null || wo.ratingStr === "") kStats.noR++;
            else if (wo.rating === 5) kStats.r5++;
            else if (wo.rating === 4 || wo.rating === 3) kStats.r34++;
            else if (wo.rating === 2 || wo.rating === 1) kStats.r12++;
          }
          if (wo.ulp && (kStats.ulp === "" || kStats.ulp === "Unknown")) kStats.ulp = wo.ulp;
          kpRatingStats.set(kpKey, kStats);
        }

        const nameKey = this.cleanName(wo.name);
        if (nameKey && nameKey !== "NAMAPETUGAS" && nameKey !== "NAME") {
          const rStats = officerRatingStats.get(nameKey) || { totalWo: 0, r5: 0, r34: 0, r12: 0, noR: 0, regu: wo.regu, ulp: wo.ulp, displayName: wo.name };
          if (wo.isPlnMobile) {
            rStats.totalWo++;
            if (wo.rating === null || wo.ratingStr === "") rStats.noR++;
            else if (wo.rating === 5) rStats.r5++;
            else if (wo.rating === 4 || wo.rating === 3) rStats.r34++;
            else if (wo.rating === 2 || wo.rating === 1) rStats.r12++;
          }
          officerRatingStats.set(nameKey, rStats);
        }

        if (isSelesai) {
          totalSlaGangguan++;
          if (wo.rpt >= 30) rptOver30Ids.add(wo.id);
          if (wo.rct >= 45) rptOver45Ids.add(wo.id);

          if (wo.rpt >= 0) {
            if (wo.rpt > highestRpt) highestRpt = wo.rpt;
            totalRpt += wo.rpt;
            rptCount++;
          }
          if (wo.rct >= 0) {
            if (wo.rct > highestRct) highestRct = wo.rct;
            totalRct += wo.rct;
            rctCount++;
          }
          shiftMap.set(wo.shift, (shiftMap.get(wo.shift) || 0) + 1);
        }
      }

      if (isUp3 && isCctvFiltered && isSelesai) {
        filteredWoRows.push([...wo.rawRow]);
      }

    });

    // 3. Aggregate WO Performance
    const ulpWoStatsMap = new Map<string, { total: number; cctv: number }>();
    ulpWoReportsAll.forEach((reports, ulp) => {
      let t = 0, c = 0;
      reports.forEach(hasCctv => {
        t++;
        if (hasCctv) c++;
      });
      ulpWoStatsMap.set(ulp, { total: t, cctv: c });
    });

    const ulpWoOverSlaStatsMap = new Map<string, { total: number; cctv: number }>();
    ulpWoReportsOverSla.forEach((reports, ulp) => {
      let t = 0, c = 0;
      reports.forEach(hasCctv => {
        t++;
        if (hasCctv) c++;
      });
      ulpWoOverSlaStatsMap.set(ulp, { total: t, cctv: c });
    });

    // Calculate overall WO summary counters
    let totalWoCount = 0;
    let totalWoCctvCount = 0;
    globalWoReports.forEach(hasCctv => {
      totalWoCount++;
      if (hasCctv) totalWoCctvCount++;
    });

    // 4. Aggregate PO data
    const poTargets = ["nama petugas", "cctv", "tgl", "no tugas", "nama regu", "ulp", "posko"];
    const { headerRowIdx: poHeaderIdx, colIndices: poCols } = this.findHeaderAndCols(poRows, poTargets);
    const poNameIdx = poCols[0] !== -1 ? poCols[0] : 10;
    const poCctvIdx = poCols[1] !== -1 ? poCols[1] : 24;
    const poDateIdx = poCols[2] !== -1 ? poCols[2] : 25; 
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
      
      const poPoskoValue = poPoskoIdx !== -1 ? String(row[poPoskoIdx] || "").trim() : "";
      const normalizedPoPosko = this.normalizeForMatch(poPoskoValue);
      const poskoidFromPoMapping = poskoToUlpIdMap.get(normalizedPoPosko);
      
      let ulpNameLookup = poskoidFromPoMapping ? ulpMap.get(poskoidFromPoMapping) : "";
      if (ulpNameLookup) {
        ulpNameLookup = ulpNameLookup.toUpperCase().replace(/^POSKO ULP\s+/i, "").trim();
      }
      
      let ulpNameFromPo = (poUlpIdx !== -1 && row[poUlpIdx]) 
        ? String(row[poUlpIdx]).toUpperCase().replace(/^POSKO ULP\s+/i, "").trim() 
        : "";

      let ulpName = officerToUlp.get(nameKey) || ulpNameLookup || ulpNameFromPo || "Unknown";
      let poskoName = poPoskoValue || ulpName;

      const reguValue = String(row[poReguIdx] || "").trim();
      const normRegu = reguValue.toUpperCase().replace(/\s+/g, "").trim();

      // Match ULP strictly by Regu for PO/CCTV cards
      const targetUlpFromRegu = allUlps.find(u => {
        const expected = getExpectedRegu(u).toUpperCase().replace(/\s+/g, "").trim();
        return expected === normRegu;
      });

      const targetUlpFilter = selectedUlp && selectedUlp !== "ALL" ? getCanonicalUlpName(standardizeUlpName(selectedUlp)) : null;
      const isFilteredForCctvTab = !targetUlpFilter || (targetUlpFromRegu === targetUlpFilter);

      const isUp3 = isUp3Regu(reguValue);
      const taskId = String(row[poIdIdx] || "").trim();
      if (!taskId) return;

      const cctvVal = row.length > poCctvIdx ? String(row[poCctvIdx] || "").trim().toUpperCase() : "";
      const isCctv = cctvVal.includes("CCTV");

      if (isUp3 && isFilteredForCctvTab && targetUlpFromRegu) {
        filteredPoRows.push([...row]);
        globalPoTasks.set(taskId, (globalPoTasks.get(taskId) || false) || isCctv);
      }
      
      if (targetUlpFromRegu) {
        if (!ulpPoTasks.has(targetUlpFromRegu)) ulpPoTasks.set(targetUlpFromRegu, new Map());
        ulpPoTasks.get(targetUlpFromRegu)!.set(taskId, (ulpPoTasks.get(targetUlpFromRegu)!.get(taskId) || false) || isCctv);
      }

      if (!officerPoTasks.has(nameKey)) officerPoTasks.set(nameKey, new Map());
      officerPoTasks.get(nameKey)!.set(taskId, (officerPoTasks.get(nameKey)!.get(taskId) || false) || isCctv);
      
      const raw = officerPoRawStats.get(nameKey) || { total: 0, cctv: 0 };
      officerPoRawStats.set(nameKey, { total: raw.total + 1, cctv: raw.cctv + (isCctv ? 1 : 0) });
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

    const mappedCctvUsage: CCTVUsage[] = officers
      .filter(officer => {
        let ulpName = (ulpMap.get(officer.ulpId) || officer.directUlp || "Unknown");
        ulpName = ulpName.replace(/^POSKO ULP\s+/i, "").trim();
        return isUp3Regu(ulpName);
      })
      .map((officer, index) => {
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
    // allUlps already defined above
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

    // Sort ULP by predefined order
    ulpPerformance.sort((a, b) => {
      const idxA = allUlpsOrder.indexOf(a.ulp);
      const idxB = allUlpsOrder.indexOf(b.ulp);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.ulp.localeCompare(b.ulp);
    });

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
        totalGangguan: totalSlaGangguan,
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
        officerOverSlaRpt: Array.from(officerRptOverSlaCount.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        officerOverSlaRct: Array.from(officerRctOverSlaCount.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        ulpDistribution: Array.from(ulpWoOverSlaStatsMap.entries())
          .map(([name, stats]) => ({ name, value: stats.total }))
          .filter(item => {
            if (!selectedUlp || selectedUlp === "ALL") return true;
            return standardizeUlpName(item.name) === standardizeUlpName(selectedUlp);
          })
          .sort((a, b) => b.value - a.value),
      },
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
      rating: (() => {
        let officerRatings: OfficerRating[] = [];
        let totalFeedbackCount = 0;
        let weightedRatingSum = 0;
        const targetUlpFilter = selectedUlp && selectedUlp !== "ALL" ? standardizeUlpName(selectedUlp) : null;

        // Process based on aggregated stats from WO sheet filtered by ULP unique names
        officerRatingStats.forEach((stats) => {
          if (targetUlpFilter && standardizeUlpName(stats.ulp) !== targetUlpFilter) return;

          const ratedCount = stats.r5 + stats.r34 + stats.r12;
          totalFeedbackCount += ratedCount;
          weightedRatingSum += (stats.r5 * 5) + (stats.r34 * 3.5) + (stats.r12 * 1.5);

          const pctValue = stats.totalWo > 0 
            ? Math.round((stats.r5 / stats.totalWo) * 100) 
            : 100;

          officerRatings.push({
            name: stats.displayName,
            ulp: stats.ulp,
            regu: stats.regu,
            totalWoPlnMobile: stats.totalWo,
            rating5: stats.r5,
            rating34: stats.r34,
            rating12: stats.r12,
            noRating: stats.noR,
            percentageKomulatif: `${pctValue}%`
          });
        });

        // Optional: Sort by name or total WO
        officerRatings.sort((a, b) => b.totalWoPlnMobile - a.totalWoPlnMobile || a.name.localeCompare(b.name));

        const kpRatings: KPRating[] = [];
        kpRatingStats.forEach((stats, kpName) => {
          const pct = stats.totalWo > 0 ? Math.round((stats.r5 / stats.totalWo) * 100) : 100;
          kpRatings.push({
            namaKp: kpName.toUpperCase(),
            ulp: stats.ulp.toUpperCase(),
            regu: kpName,
            totalWoPlnMobile: stats.totalWo,
            rating5: stats.r5,
            rating34: stats.r34,
            rating12: stats.r12,
            noRating: stats.noR,
            percentageKomulatif: `${pct}%`
          });
        });
        kpRatings.sort((a, b) => b.totalWoPlnMobile - a.totalWoPlnMobile);

        const specificUlps = ["BUKITTINGGI", "PADANG PANJANG", "LUBUK SIKAPING", "LUBUK BASUNG", "SIMPANG EMPAT", "BASO", "KOTO TUO"];
        const ulpRatingMap = new Map<string, { 
          totalWo: number; r5: number; r34: number; r12: number; noR: number;
        }>();
        
        // Initialize with zeros for requested ULPs
        specificUlps.forEach(ulp => {
          ulpRatingMap.set(ulp, { totalWo: 0, r5: 0, r34: 0, r12: 0, noR: 0 });
        });

        // Use kpRatingStats to aggregate by ULP
        kpRatingStats.forEach((stats) => {
          const sUlp = standardizeUlpName(stats.ulp);
          // Find the matching specific ULP (some might be slightly different in spelling, but standardizeUlpName should handle most)
          const matchedUlp = specificUlps.find(su => standardizeUlpName(su) === sUlp);
          if (matchedUlp) {
            const current = ulpRatingMap.get(matchedUlp)!;
            current.totalWo += stats.totalWo;
            current.r5 += stats.r5;
            current.r34 += stats.r34;
            current.r12 += stats.r12;
            current.noR += stats.noR;
          }
        });

        const ulpRatings: ULPRating[] = Array.from(ulpRatingMap.entries()).map(([name, stats]) => {
          const pct = stats.totalWo > 0 ? Math.round((stats.r5 / stats.totalWo) * 100) : 100;
          return {
            namaUlp: name,
            totalWoPlnMobile: stats.totalWo,
            rating5: stats.r5,
            rating34: stats.r34,
            rating12: stats.r12,
            noRating: stats.noR,
            percentageKomulatif: `${pct}%`
          };
        });

        return {
          officerRatings,
          kpRatings,
          ulpRatings,
          summary: {
            avgRating: totalFeedbackCount > 0 ? weightedRatingSum / totalFeedbackCount : 5.0,
            totalFeedback: totalFeedbackCount
          },
          totalWoPlnMobile: totalRatingWo,
          rating5: totalRating5,
          rating34: totalRating34,
          rating12: totalRating12,
          noRating: totalNoRating,
          totalWoPlnMobileList,
          rating5List,
          rating34List,
          rating12List,
          noRatingList
        };
      })(),
      cctvUsage: mappedCctvUsage,
      rawWoRows: rawWoRowsFull,
      rawPoRows: filteredPoRows,
      woHeaders: woRows[woHeaderIdx] || [],
      poHeaders: poRows[poHeaderIdx] || [],
      woIndices: { 
        name: woNameIdx, ulp: woUlpIdx, cctv: woCctvIdx, 
        tglLapor: woDateIdx, tglPengerjaan: woTglPengerjaanIdx, tglSelesai: woTglSelesaiIdx,
        source: woSourceIdx, reporter: woReporterIdx, shift: woShiftIdx,
        rpt: woRptIdx, rct: woRctIdx
      },
      poIndices: { name: poNameIdx, ulp: poUlpIdx, cctv: poCctvIdx },
    };
  }
}
