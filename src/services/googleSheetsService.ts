import { DashboardData, MainTableEntry, UnitRecap, OfficerPerformance, CCTVUsage } from "../types";
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

    // Helper to parse date strings from sheet
    const parseSheetDate = (dateStr: string) => {
      if (!dateStr) return null;
      // Try standard parsing first
      let d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;

      // Handle DD-MM-YYYY or DD/MM/YYYY
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        // Assume DD-MM-YYYY
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
        d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    const isWithinRange = (date: Date | null, start?: string, end?: string) => {
      if (!start && !end) return true;
      if (!date) return false;
      
      const dTime = date.getTime();
      if (start) {
        const sTime = new Date(start).getTime();
        if (dTime < sTime) return false;
      }
      if (end) {
        const eTime = new Date(end).getTime();
        // Set end time to end of day
        const eDate = new Date(end);
        eDate.setHours(23, 59, 59, 999);
        if (dTime > eDate.getTime()) return false;
      }
      return true;
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

    // 3. Aggregate WO data (Column K: Name, Column AQ: CCTV, Column R: Date)
    const { headerRowIdx: woHeaderIdx, colIndices: woCols } = findHeaderAndCols(woRows, ["nama petugas", "cctv", "tanggal"]);
    const woNameIdx = woCols[0] !== -1 ? woCols[0] : 10; // Column K
    const woCctvIdx = woCols[1] !== -1 ? woCols[1] : 42; // Column AQ
    const woDateIdx = woCols[2] !== -1 ? woCols[2] : 17; // Column R (index 17)

    const woDataStart = woHeaderIdx !== -1 ? woHeaderIdx + 1 : 0;
    const woStatsMap = new Map<string, { total: number; cctv: number }>();
    let totalWoCount = 0;
    let totalWoCctvCount = 0;

    woRows.slice(woDataStart).forEach(row => {
      if (row.length <= woNameIdx) return;
      
      const dateVal = String(row[woDateIdx] || "").trim();
      const rowDate = parseSheetDate(dateVal);
      if (!isWithinRange(rowDate, startDate, endDate)) return;

      const name = cleanName(row[woNameIdx]);
      if (!name || name === "NAMAPETUGAS" || name === "NAME") return;
      
      totalWoCount++;
      const cctvVal = row.length > woCctvIdx ? String(row[woCctvIdx] || "").trim().toUpperCase() : "";
      const isCctv = cctvVal.includes("CCTV");
      if (isCctv) totalWoCctvCount++;
      
      const current = woStatsMap.get(name) || { total: 0, cctv: 0 };
      woStatsMap.set(name, {
        total: current.total + 1,
        cctv: current.cctv + (isCctv ? 1 : 0)
      });
    });

    // 4. Aggregate PO data (Column K: Name, Column Y: CCTV, Column O: Date)
    const { headerRowIdx: poHeaderIdx, colIndices: poCols } = findHeaderAndCols(poRows, ["nama petugas", "cctv", "tanggal"]);
    const poNameIdx = poCols[0] !== -1 ? poCols[0] : 10; // Column K
    const poCctvIdx = poCols[1] !== -1 ? poCols[1] : 24; // Column Y
    const poDateIdx = poCols[2] !== -1 ? poCols[2] : 14; // Column O (index 14)

    const poDataStart = poHeaderIdx !== -1 ? poHeaderIdx + 1 : 0;
    const poStatsMap = new Map<string, { total: number; cctv: number }>();
    let totalPoCount = 0;
    let totalPoCctvCount = 0;

    poRows.slice(poDataStart).forEach(row => {
      if (row.length <= poNameIdx) return;

      const dateVal = String(row[poDateIdx] || "").trim();
      const rowDate = parseSheetDate(dateVal);
      if (!isWithinRange(rowDate, startDate, endDate)) return;

      const name = cleanName(row[poNameIdx]);
      if (!name || name === "NAMAPETUGAS" || name === "NAME") return;
      
      totalPoCount++;
      const cctvVal = row.length > poCctvIdx ? String(row[poCctvIdx] || "").trim().toUpperCase() : "";
      const isCctv = cctvVal.includes("CCTV");
      if (isCctv) totalPoCctvCount++;
      
      const current = poStatsMap.get(name) || { total: 0, cctv: 0 };
      poStatsMap.set(name, {
        total: current.total + 1,
        cctv: current.cctv + (isCctv ? 1 : 0)
      });
    });

    // 5. Build the CCTVUsage list strictly based on PETUGAS list
    const mappedCctvUsage: CCTVUsage[] = officers.map((officer, index) => {
      const nameKey = cleanName(officer.name);
      const woStats = woStatsMap.get(nameKey) || { total: 0, cctv: 0 };
      const poStats = poStatsMap.get(nameKey) || { total: 0, cctv: 0 };
      
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

    // 7. Aggregate ULP Performance
    const ulpPerformanceMap = new Map<string, {
      woTotal: number;
      woCctv: number;
      poTotal: number;
      poCctv: number;
    }>();

    mappedCctvUsage.forEach(item => {
      const current = ulpPerformanceMap.get(item.ulp) || { woTotal: 0, woCctv: 0, poTotal: 0, poCctv: 0 };
      ulpPerformanceMap.set(item.ulp, {
        woTotal: current.woTotal + item.jumlahWoTotal,
        woCctv: current.woCctv + item.totalWoPakaiCctv,
        poTotal: current.poTotal + item.jumlahPoTotal,
        poCctv: current.poCctv + item.totalPoPakaiCctv,
      });
    });

    const calculatePercent = (num: number, den: number) => {
      if (den === 0) {
        return num === 0 ? "100%" : "#DIV/0!";
      }
      return `${Math.round((num / den) * 100)}%`;
    };

    const ulpPerformance = Array.from(ulpPerformanceMap.entries()).map(([ulp, stats]) => ({
      ulp,
      jumlahWoTotal: stats.woTotal,
      totalWoPakaiCctv: stats.woCctv,
      persenWo: calculatePercent(stats.woCctv, stats.woTotal),
      jumlahPoTotal: stats.poTotal,
      totalPoPakaiCctv: stats.poCctv,
      persenPo: calculatePercent(stats.poCctv, stats.poTotal),
      persenPenggunaanCctv: calculatePercent(stats.woCctv + stats.poCctv, stats.woTotal + stats.poTotal)
    }));

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
    };
  }
}
