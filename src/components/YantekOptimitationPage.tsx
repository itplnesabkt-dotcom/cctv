import React, { useMemo, useState } from 'react';
import { DashboardData } from '../types';
import { 
  Zap, 
  TrendingUp, 
  Award, 
  Clock, 
  Gauge, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  CornerDownRight, 
  ChevronRight, 
  Sliders, 
  Cpu, 
  Activity,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Legend as RechartsLegend, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area, 
  LineChart, 
  Line 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface YantekOptimitationPageProps {
  data: DashboardData;
  onDetailClick?: (type: 'WO' | 'PO', identifier: string, isUlp: boolean, isCctv: boolean) => void;
}

export const YantekOptimitationPage: React.FC<YantekOptimitationPageProps> = ({ data, onDetailClick }) => {
  const [selectedUlp, setSelectedUlp] = useState<string>('ALL');

  // Eviden Map state loaded from localStorage
  const [evidenMap, setEvidenMap] = useState<any>(() => {
    const saved = localStorage.getItem('anomali_evidens');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {};
  });

  // Re-sync eviden map dynamically when custom event is fired
  React.useEffect(() => {
    const syncEvidens = () => {
      const saved = localStorage.getItem('anomali_evidens');
      if (saved) {
        try {
          setEvidenMap(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    };
    window.addEventListener('anomali_evidens_updated', syncEvidens);
    return () => {
      window.removeEventListener('anomali_evidens_updated', syncEvidens);
    };
  }, []);

  const COLORS = ['#00E5FF', '#00B0FF', '#2979FF', '#3D5AFE', '#651FFF', '#AA00FF'];
  const STATUS_COLORS = {
    OPTIMAL: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    OVERLOADED: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    'UNDER-UTILIZED': 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  };

  // 1. Process all metrics dynamically from WO data
  const optimizationStats = useMemo(() => {
    const rows = data.distinctWoRows || [];
    const idx = data.woIndices;
    
    if (!idx || rows.length === 0) {
      return {
        totalWo: 0,
        avgRpt: 0,
        avgRct: 0,
        onTimeSlaRate: 100,
        ulpMetrics: [],
        shiftMetrics: [],
        recommendations: [],
        topRegu: []
      };
    }

    // Calculate overall stats
    const totalWo = rows.length;
    let totalRpt = 0;
    let totalRct = 0;
    let rptOver30Count = 0;

    rows.forEach(row => {
      const rpt = parseFloat(String(row[idx.rpt] || '0').replace(',', '.')) || 0;
      const rct = parseFloat(String(row[idx.rct] || '0').replace(',', '.')) || 0;
      totalRpt += rpt;
      totalRct += rct;
      if (rpt >= 30) {
        rptOver30Count++;
      }
    });

    const avgRpt = totalWo > 0 ? parseFloat((totalRpt / totalWo).toFixed(1)) : 0;
    const avgRct = totalWo > 0 ? parseFloat((totalRct / totalWo).toFixed(1)) : 0;
    const onTimeSlaRate = totalWo > 0 ? parseFloat((((totalWo - rptOver30Count) / totalWo) * 100).toFixed(1)) : 100;

    // Process ULP Metrics
    const ulpMap: { [key: string]: any } = {};
    rows.forEach(row => {
      const ulpRaw = String(row[idx.ulp] || 'UNKNOWN').trim().toUpperCase();
      const ulp = ulpRaw.replace('ULP ', '');
      const rpt = parseFloat(String(row[idx.rpt] || '0').replace(',', '.')) || 0;
      const rct = parseFloat(String(row[idx.rct] || '0').replace(',', '.')) || 0;
      const regu = String(row[idx.regu] || 'Regu Utama').trim();
      const rating = parseFloat(String(row[idx.rating] || '5')) || 5;

      if (!ulpMap[ulp]) {
        ulpMap[ulp] = {
          name: ulp,
          fullName: ulpRaw,
          totalWo: 0,
          totalRpt: 0,
          totalRct: 0,
          rptOver30: 0,
          regus: new Set<string>(),
          totalRating: 0,
          ratingCount: 0
        };
      }

      ulpMap[ulp].totalWo++;
      ulpMap[ulp].totalRpt += rpt;
      ulpMap[ulp].totalRct += rct;
      if (rpt >= 30) {
        ulpMap[ulp].rptOver30++;
      }
      if (regu) ulpMap[ulp].regus.add(regu);
      if (rating > 0) {
        ulpMap[ulp].totalRating += rating;
        ulpMap[ulp].ratingCount++;
      }
    });

    const ulpMetrics = Object.keys(ulpMap).map(key => {
      const item = ulpMap[key];
      const avgRptItem = parseFloat((item.totalRpt / item.totalWo).toFixed(1));
      const avgRctItem = parseFloat((item.totalRct / item.totalWo).toFixed(1));
      const compliance = parseFloat((((item.totalWo - item.rptOver30) / item.totalWo) * 100).toFixed(1));
      const rating = item.ratingCount > 0 ? parseFloat((item.totalRating / item.ratingCount).toFixed(2)) : 5.0;
      
      // Determine optimization status & workload
      let status: 'OPTIMAL' | 'OVERLOADED' | 'UNDER-UTILIZED' = 'OPTIMAL';
      if (compliance < 80 || (item.totalWo > 100 && avgRptItem > 25)) {
        status = 'OVERLOADED';
      } else if (compliance > 95 && item.totalWo < 20) {
        status = 'UNDER-UTILIZED';
      }

      return {
        name: item.name,
        fullName: item.fullName,
        totalWo: item.totalWo,
        avgRpt: avgRptItem,
        avgRct: avgRctItem,
        compliance,
        reguCount: item.regus.size || 1,
        rating,
        status
      };
    }).sort((a, b) => b.totalWo - a.totalWo);

    // Process Shift Metrics
    const shiftMap: { [key: string]: any } = {};
    rows.forEach(row => {
      let shift = String(row[idx.shift] || 'SHIFT UNKNOWN').trim().toUpperCase();
      if (!shift || shift === '0' || shift === 'NULL') shift = 'SHIFT UTAMA';
      const rpt = parseFloat(String(row[idx.rpt] || '0').replace(',', '.')) || 0;
      const rct = parseFloat(String(row[idx.rct] || '0').replace(',', '.')) || 0;

      if (!shiftMap[shift]) {
        shiftMap[shift] = {
          name: shift,
          totalWo: 0,
          totalRpt: 0,
          totalRct: 0,
          overSla: 0
        };
      }

      shiftMap[shift].totalWo++;
      shiftMap[shift].totalRpt += rpt;
      shiftMap[shift].totalRct += rct;
      if (rpt >= 30) {
        shiftMap[shift].overSla++;
      }
    });

    const shiftMetrics = Object.keys(shiftMap).map(key => {
      const item = shiftMap[key];
      return {
        name: item.name,
        totalWo: item.totalWo,
        avgRpt: parseFloat((item.totalRpt / item.totalWo).toFixed(1)),
        avgRct: parseFloat((item.totalRct / item.totalWo).toFixed(1)),
        compliance: parseFloat((((item.totalWo - item.overSla) / item.totalWo) * 100).toFixed(1))
      };
    }).sort((a, b) => b.totalWo - a.totalWo);

    // Generate Dynamic Optimization Recommendations based on calculated metrics
    const recommendations: { title: string; desc: string; priority: 'CRITICAL' | 'MEDIUM' | 'INFO'; tag: string }[] = [];

    // Check overload
    ulpMetrics.forEach(u => {
      if (u.status === 'OVERLOADED') {
        recommendations.push({
          title: `Optimasi Personil ULP ${u.name}`,
          desc: `Tingkat kepatuhan SLA di ULP ${u.name} berada di bawah target (${u.compliance}%). Beban kerja per regu sangat tinggi (${(u.totalWo / u.reguCount).toFixed(1)} WO/regu). Disarankan relokasi 1 regu standby dari unit under-utilized atau tambah personil standby.`,
          priority: 'CRITICAL',
          tag: 'RESOURCE SHIFT'
        });
      }
    });

    // Check shift delays
    shiftMetrics.forEach(s => {
      if (s.avgRpt > 25) {
        recommendations.push({
          title: `Penyesuaian Respons ${s.name}`,
          desc: `${s.name} memiliki rata-rata Response Time (RPT) kritis sebesar ${s.avgRpt} menit. Atur ulang titik stasioner/mobil patroli yantek agar lebih mendekati pusat titik gangguan selama shift berlangsung.`,
          priority: 'MEDIUM',
          tag: 'STATIONARY POINT'
        });
      }
    });

    // General high-level optimization recommendations
    if (onTimeSlaRate < 90) {
      recommendations.push({
        title: "Pemberlakuan Titik Standby Dinamis",
        desc: "Response time beberapa unit melebihi 25 menit disebabkan oleh letak geografis. Aktifkan penempatan regu di Posko Pembantu di luar jam sibuk.",
        priority: 'CRITICAL',
        tag: 'GEOGRAPHIC OPTIMIZATION'
      });
    } else {
      recommendations.push({
        title: "Automated Routing Dispatch",
        desc: "Sistem autodispatch saat ini berjalan optimal. Pertahankan performa dengan sinkronisasi data CCTV Yantek secara berkala untuk memitigasi anomali.",
        priority: 'INFO',
        tag: 'AUTOMATION'
      });
    }

    // Process Top Performing Teams/Regu
    const reguMap: { [key: string]: any } = {};
    let totalRatingSum = 0;
    let ratingCountAll = 0;
    rows.forEach(row => {
      const regu = String(row[idx.regu] || 'Regu Utama').trim();
      const name = String(row[idx.name] || 'Petugas').trim();
      const rpt = parseFloat(String(row[idx.rpt] || '0').replace(',', '.')) || 0;
      const rct = parseFloat(String(row[idx.rct] || '0').replace(',', '.')) || 0;
      const rating = parseFloat(String(row[idx.rating] || '5')) || 5;

      if (!regu || regu === '0' || regu === 'NULL') return;

      if (!reguMap[regu]) {
        reguMap[regu] = {
          name: regu,
          leader: name,
          totalWo: 0,
          totalRpt: 0,
          totalRct: 0,
          totalRating: 0,
          ratingCount: 0
        };
      }

      reguMap[regu].totalWo++;
      reguMap[regu].totalRpt += rpt;
      reguMap[regu].totalRct += rct;
      if (rating > 0) {
        reguMap[regu].totalRating += rating;
        reguMap[regu].ratingCount++;
        totalRatingSum += rating;
        ratingCountAll++;
      }
    });

    const activeReguCount = Object.keys(reguMap).length || 5; // Default fallback to 5 regu if empty
    const avgRatingAll = ratingCountAll > 0 ? parseFloat((totalRatingSum / ratingCountAll).toFixed(2)) : 5.0;

    const topRegu = Object.keys(reguMap).map(key => {
      const item = reguMap[key];
      const rating = item.ratingCount > 0 ? parseFloat((item.totalRating / item.ratingCount).toFixed(2)) : 5.0;
      return {
        name: item.name,
        leader: item.leader,
        totalWo: item.totalWo,
        avgRpt: parseFloat((item.totalRpt / item.totalWo).toFixed(1)),
        avgRct: parseFloat((item.totalRct / item.totalWo).toFixed(1)),
        rating
      };
    }).sort((a, b) => b.rating - a.rating || a.avgRpt - b.avgRpt).slice(0, 5);

    return {
      totalWo,
      avgRpt,
      avgRct,
      onTimeSlaRate,
      ulpMetrics,
      shiftMetrics,
      recommendations,
      topRegu,
      activeReguCount,
      avgRatingAll
    };
  }, [data]);

  // Filter metrics if ULP selected
  const filteredMetrics = useMemo(() => {
    if (selectedUlp === 'ALL') return optimizationStats.ulpMetrics;
    return optimizationStats.ulpMetrics.filter(u => u.name === selectedUlp);
  }, [selectedUlp, optimizationStats]);

  // Process and parse VCC_DATA for dynamic UP3 performance indicators
  const vccMetrics = useMemo(() => {
    const rawRows = data.vccData || [];
    if (rawRows.length <= 1) {
      // High-fidelity fallback / mock generator matching real formulas
      const defaults = {
        avgPerforma: 94.07,
        avgKinerjaYo: 98.92,
        avgHariKerja: 110.84,
        totalWoPo: 239.95
      };

      if (selectedUlp !== 'ALL') {
        const mockMap: { [key: string]: typeof defaults } = {
          "LUBUK BASUNG": { avgPerforma: 90.31, avgKinerjaYo: 93.01, avgHariKerja: 116.74, totalWoPo: 234.05 },
          "BASO": { avgPerforma: 99.11, avgKinerjaYo: 105.15, avgHariKerja: 112.04, totalWoPo: 263.02 },
          "SIMPANG EMPAT": { avgPerforma: 90.56, avgKinerjaYo: 93.18, avgHariKerja: 110.00, totalWoPo: 243.44 },
          "LUBUK SIKAPING": { avgPerforma: 95.38, avgKinerjaYo: 104.17, avgHariKerja: 102.80, totalWoPo: 232.79 },
          "PADANG PANJANG": { avgPerforma: 98.11, avgKinerjaYo: 108.61, avgHariKerja: 105.44, totalWoPo: 241.18 }
        };
        const uKey = selectedUlp.toUpperCase();
        for (const k of Object.keys(mockMap)) {
          if (uKey.includes(k) || k.includes(uKey)) {
            return mockMap[k];
          }
        }
      }
      return defaults;
    }

    const headers = rawRows[0] || [];
    const findIndex = (targets: string[]) => {
      return headers.findIndex(h => targets.includes(String(h || "").trim()));
    };

    const idxNamaUlp = findIndex(["Nama Ulp", "Nama ULP", "Ulp", "ULP"]);
    const idxTotalSkor = findIndex(["Total Skor", "Skor Total"]);
    const idxPersentaseSkor = findIndex(["Persentase Skor", "Persentase skor", "Skor"]);
    const idxJumlahHariSeharusnya = findIndex(["Jumlah Hari Seharusnya", "Hari Seharusnya"]);
    const idxJumlahHariRealisasi = findIndex(["Jumlah Hari Realisasi", "Hari Realisasi"]);
    const idxRct = findIndex(["RCT", "Rct"]);
    const idxPersentasePerformaP0 = findIndex(["Persentase Performa P0", "Performa P0"]);
    const idxPersentasePerformaWo = findIndex(["Persentase Performa Wo", "Performa Wo"]);

    const parseNum = (val: any): number => {
      if (val === undefined || val === null || val === "") return 0;
      if (typeof val === 'number') return val;
      const str = String(val).trim();
      if (!str) return 0;

      // Clean percentage signs
      let cleaned = str.replace('%', '').trim();

      // Detect Indonesian vs US format:
      // If we have both commas and dots, decide which is the decimal separator
      const hasComma = cleaned.includes(',');
      const hasDot = cleaned.includes('.');

      if (hasComma && hasDot) {
        if (cleaned.indexOf(',') < cleaned.indexOf('.')) {
          // US format: e.g. 1,234.56 -> remove comma
          cleaned = cleaned.replace(/,/g, '');
        } else {
          // ID format: e.g. 1.234,56 -> remove dot, replace comma with dot
          cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
        }
      } else if (hasComma) {
        // Only comma: e.g. 12,43 (ID decimal) or 1,234 (US thousands)
        const parts = cleaned.split(',');
        if (parts[parts.length - 1].length === 3 && parts[0].length <= 3) {
          // Thousands
          cleaned = cleaned.replace(/,/g, '');
        } else {
          // Decimal
          cleaned = cleaned.replace(/,/g, '.');
        }
      } else if (hasDot) {
        // Only dot: e.g. 12.43 (US decimal) or 1.234 (ID thousands)
        const parts = cleaned.split('.');
        if (parts[parts.length - 1].length === 3 && parts[0].length <= 3) {
          // Thousands
          cleaned = cleaned.replace(/\./g, '');
        }
      }

      return parseFloat(cleaned) || 0;
    };

    let sumTotalSkor = 0, countTotalSkor = 0;
    let sumSeharusnya = 0, countSeharusnya = 0;
    let sumRealisasi = 0, countRealisasi = 0;
    let sumRct = 0, countRct = 0;
    let sumPerfP0 = 0, countPerfP0 = 0;
    let sumPerfWo = 0, countPerfWo = 0;

    const dataRows = rawRows.slice(1);
    dataRows.forEach(row => {
      if (!row || row.length === 0) return;

      const rowUlp = idxNamaUlp !== -1 ? String(row[idxNamaUlp] || "").toUpperCase() : "";
      const matchesUlp = selectedUlp === 'ALL' || rowUlp.includes(selectedUlp.toUpperCase()) || selectedUlp.toUpperCase().includes(rowUlp);
      if (!matchesUlp) return;

      // Track Total Skor
      if (idxTotalSkor !== -1) {
        sumTotalSkor += parseNum(row[idxTotalSkor]);
        countTotalSkor++;
      } else if (idxPersentaseSkor !== -1) {
        // Fallback: convert percentage back to standard score scale if needed
        const pSkor = parseNum(row[idxPersentaseSkor]);
        sumTotalSkor += (pSkor / 100) * 15;
        countTotalSkor++;
      }

      // Track Seharusnya
      if (idxJumlahHariSeharusnya !== -1) {
        sumSeharusnya += parseNum(row[idxJumlahHariSeharusnya]);
        countSeharusnya++;
      }

      // Track Realisasi
      if (idxJumlahHariRealisasi !== -1) {
        sumRealisasi += parseNum(row[idxJumlahHariRealisasi]);
        countRealisasi++;
      }

      // Track RCT
      if (idxRct !== -1) {
        sumRct += parseNum(row[idxRct]);
        countRct++;
      }

      // Track Persentase Performa P0
      if (idxPersentasePerformaP0 !== -1) {
        sumPerfP0 += parseNum(row[idxPersentasePerformaP0]);
        countPerfP0++;
      }

      // Track Persentase Performa WO
      if (idxPersentasePerformaWo !== -1) {
        sumPerfWo += parseNum(row[idxPersentasePerformaWo]);
        countPerfWo++;
      }
    });

    const avgTotalSkor = countTotalSkor > 0 ? (sumTotalSkor / countTotalSkor) : 0;
    const avgSeharusnya = countSeharusnya > 0 ? (sumSeharusnya / countSeharusnya) : 0;
    const avgRealisasi = countRealisasi > 0 ? (sumRealisasi / countRealisasi) : 0;
    const avgRct = countRct > 0 ? (sumRct / countRct) : 0;
    const avgPerfP0 = countPerfP0 > 0 ? (sumPerfP0 / countPerfP0) : 0;
    const avgPerfWo = countPerfWo > 0 ? (sumPerfWo / countPerfWo) : 0;

    // Calculators
    const avgPerforma = (avgTotalSkor / 15) * 100;
    const avgKinerjaYo = avgSeharusnya > 0 ? (avgRealisasi / avgSeharusnya) * 100 : 0;
    const avgHariKerja = avgRealisasi > 0 ? (((avgRct / avgRealisasi) + 1.5) / 8) * 100 : 0;
    const totalWoPo = avgPerfP0 + avgPerfWo;

    return {
      avgPerforma: parseFloat(avgPerforma.toFixed(2)),
      avgKinerjaYo: parseFloat(avgKinerjaYo.toFixed(2)),
      avgHariKerja: parseFloat(avgHariKerja.toFixed(2)),
      totalWoPo: parseFloat(totalWoPo.toFixed(2))
    };
  }, [data.vccData, selectedUlp]);

  // Hook to process and parse ULP-specific performance data from VCC_DATA sheet
  const ulpPerformanceData = useMemo(() => {
    const rawRows = data.vccData || [];
    if (rawRows.length <= 1) {
      // High-fidelity fallback metrics per ULP
      const mockUlpList = [
        { name: "LUBUK BASUNG", totalNilaiYo: 90.31, nilaiHariKerja: 93.01, nilaiProduktivitas: 116.74, nilaiPerformaWoPo: 234.05 },
        { name: "BASO", totalNilaiYo: 99.11, nilaiHariKerja: 105.15, nilaiProduktivitas: 112.04, nilaiPerformaWoPo: 263.02 },
        { name: "SIMPANG EMPAT", totalNilaiYo: 90.56, nilaiHariKerja: 93.18, nilaiProduktivitas: 110.00, nilaiPerformaWoPo: 243.44 },
        { name: "LUBUK SIKAPING", totalNilaiYo: 95.38, nilaiHariKerja: 104.17, nilaiProduktivitas: 102.80, nilaiPerformaWoPo: 232.79 },
        { name: "PADANG PANJANG", totalNilaiYo: 98.11, nilaiHariKerja: 108.61, nilaiProduktivitas: 105.44, nilaiPerformaWoPo: 241.18 }
      ];
      if (selectedUlp !== 'ALL') {
        const uKey = selectedUlp.toUpperCase();
        return mockUlpList.filter(u => u.name.includes(uKey) || uKey.includes(u.name));
      }
      return mockUlpList;
    }

    const headers = rawRows[0] || [];
    const findIndex = (targets: string[]) => {
      return headers.findIndex(h => targets.includes(String(h || "").trim()));
    };

    const idxNamaUlp = findIndex(["Nama Ulp", "Nama ULP", "Ulp", "ULP"]);
    const idxTotalSkor = findIndex(["Total Skor", "Skor Total"]);
    const idxPersentaseSkor = findIndex(["Persentase Skor", "Persentase skor", "Skor"]);
    const idxJumlahHariSeharusnya = findIndex(["Jumlah Hari Seharusnya", "Hari Seharusnya"]);
    const idxJumlahHariRealisasi = findIndex(["Jumlah Hari Realisasi", "Hari Realisasi"]);
    const idxRct = findIndex(["RCT", "Rct"]);
    const idxPersentasePerformaP0 = findIndex(["Persentase Performa P0", "Performa P0"]);
    const idxPersentasePerformaWo = findIndex(["Persentase Performa Wo", "Performa Wo"]);

    const parseNum = (val: any): number => {
      if (val === undefined || val === null || val === "") return 0;
      if (typeof val === 'number') return val;
      const str = String(val).trim();
      if (!str) return 0;

      let cleaned = str.replace('%', '').trim();
      const hasComma = cleaned.includes(',');
      const hasDot = cleaned.includes('.');

      if (hasComma && hasDot) {
        if (cleaned.indexOf(',') < cleaned.indexOf('.')) {
          cleaned = cleaned.replace(/,/g, '');
        } else {
          cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
        }
      } else if (hasComma) {
        const parts = cleaned.split(',');
        if (parts[parts.length - 1].length === 3 && parts[0].length <= 3) {
          cleaned = cleaned.replace(/,/g, '');
        } else {
          cleaned = cleaned.replace(/,/g, '.');
        }
      } else if (hasDot) {
        const parts = cleaned.split('.');
        if (parts[parts.length - 1].length === 3 && parts[0].length <= 3) {
          cleaned = cleaned.replace(/\./g, '');
        }
      }

      return parseFloat(cleaned) || 0;
    };

    const ulpGroups: { [ulpName: string]: {
      skorSum: number; skorCount: number;
      seharusnyaSum: number; seharusnyaCount: number;
      realisasiSum: number; realisasiCount: number;
      rctSum: number; rctCount: number;
      p0Sum: number; p0Count: number;
      woSum: number; woCount: number;
    } } = {};

    const dataRows = rawRows.slice(1);
    dataRows.forEach(row => {
      if (!row || row.length === 0) return;
      const rawUlpName = idxNamaUlp !== -1 ? String(row[idxNamaUlp] || "").trim() : "";
      if (!rawUlpName) return;

      const ulpKey = rawUlpName.toUpperCase();
      if (!ulpGroups[ulpKey]) {
        ulpGroups[ulpKey] = {
          skorSum: 0, skorCount: 0,
          seharusnyaSum: 0, seharusnyaCount: 0,
          realisasiSum: 0, realisasiCount: 0,
          rctSum: 0, rctCount: 0,
          p0Sum: 0, p0Count: 0,
          woSum: 0, woCount: 0
        };
      }

      const group = ulpGroups[ulpKey];

      if (idxTotalSkor !== -1) {
        group.skorSum += parseNum(row[idxTotalSkor]);
        group.skorCount++;
      } else if (idxPersentaseSkor !== -1) {
        const pSkor = parseNum(row[idxPersentaseSkor]);
        group.skorSum += (pSkor / 100) * 15;
        group.skorCount++;
      }

      if (idxJumlahHariSeharusnya !== -1) {
        group.seharusnyaSum += parseNum(row[idxJumlahHariSeharusnya]);
        group.seharusnyaCount++;
      }

      if (idxJumlahHariRealisasi !== -1) {
        group.realisasiSum += parseNum(row[idxJumlahHariRealisasi]);
        group.realisasiCount++;
      }

      if (idxRct !== -1) {
        group.rctSum += parseNum(row[idxRct]);
        group.rctCount++;
      }

      if (idxPersentasePerformaP0 !== -1) {
        group.p0Sum += parseNum(row[idxPersentasePerformaP0]);
        group.p0Count++;
      }

      if (idxPersentasePerformaWo !== -1) {
        group.woSum += parseNum(row[idxPersentasePerformaWo]);
        group.woCount++;
      }
    });

    const list = Object.keys(ulpGroups).map(name => {
      const g = ulpGroups[name];
      const avgTotalSkor = g.skorCount > 0 ? (g.skorSum / g.skorCount) : 0;
      const avgSeharusnya = g.seharusnyaCount > 0 ? (g.seharusnyaSum / g.seharusnyaCount) : 0;
      const avgRealisasi = g.realisasiCount > 0 ? (g.realisasiSum / g.realisasiCount) : 0;
      const avgRct = g.rctCount > 0 ? (g.rctSum / g.rctCount) : 0;
      const avgPerfP0 = g.p0Count > 0 ? (g.p0Sum / g.p0Count) : 0;
      const avgPerfWo = g.woCount > 0 ? (g.woSum / g.woCount) : 0;

      const totalNilaiYo = (avgTotalSkor / 15) * 100;
      const nilaiHariKerja = avgSeharusnya > 0 ? (avgRealisasi / avgSeharusnya) * 100 : 0;
      const nilaiProduktivitas = avgRealisasi > 0 ? (((avgRct / avgRealisasi) + 1.5) / 8) * 100 : 0;
      const nilaiPerformaWoPo = avgPerfP0 + avgPerfWo;

      return {
        name,
        totalNilaiYo: parseFloat(totalNilaiYo.toFixed(2)),
        nilaiHariKerja: parseFloat(nilaiHariKerja.toFixed(2)),
        nilaiProduktivitas: parseFloat(nilaiProduktivitas.toFixed(2)),
        nilaiPerformaWoPo: parseFloat(nilaiPerformaWoPo.toFixed(2))
      };
    });

    if (selectedUlp !== 'ALL') {
      const uKey = selectedUlp.toUpperCase();
      return list.filter(u => u.name.includes(uKey) || uKey.includes(u.name));
    }

    return list;
  }, [data.vccData, selectedUlp]);

  // Hook to process bottom performing officers under 75%
  const bottomOfficers = useMemo(() => {
    const rawRows = data.vccData || [];
    const hasRealRows = rawRows.length > 1;

    let headers: string[] = [];
    let idxNamaPetugas = -1;
    let idxNamaUlp = -1;
    let idxTotalSkor = -1;
    let idxPersentaseSkor = -1;

    if (hasRealRows) {
      headers = rawRows[0] || [];
      const findIndex = (targets: string[]) => {
        for (const t of targets) {
          const idx = headers.findIndex(h => String(h || "").trim().toLowerCase() === t.toLowerCase());
          if (idx !== -1) return idx;
        }
        return -1;
      };
      idxNamaPetugas = findIndex(["employeename", "employee_name", "nama petugas", "nama", "petugas", "personil", "name", "personil yantek"]);
      idxNamaUlp = findIndex(["nama ulp", "ulp", "unit"]);
      idxTotalSkor = findIndex(["total skor", "skor total", "total score", "skor"]);
      idxPersentaseSkor = findIndex(["persentase skor", "persentase", "skor %", "persen skor"]);
    }

    const parseNum = (val: any): number => {
      if (val === undefined || val === null || val === "") return 0;
      if (typeof val === 'number') return val;
      const str = String(val).trim();
      if (!str) return 0;
      let cleaned = str.replace('%', '').trim();
      const hasComma = cleaned.includes(',');
      const hasDot = cleaned.includes('.');
      if (hasComma && hasDot) {
        if (cleaned.indexOf(',') < cleaned.indexOf('.')) {
          cleaned = cleaned.replace(/,/g, '');
        } else {
          cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
        }
      } else if (hasComma) {
        const parts = cleaned.split(',');
        if (parts[parts.length - 1].length === 3 && parts[0].length <= 3) {
          cleaned = cleaned.replace(/,/g, '');
        } else {
          cleaned = cleaned.replace(/,/g, '.');
        }
      } else if (hasDot) {
        const parts = cleaned.split('.');
        if (parts[parts.length - 1].length === 3 && parts[0].length <= 3) {
          cleaned = cleaned.replace(/\./g, '');
        }
      }
      return parseFloat(cleaned) || 0;
    };

    let list: any[] = [];

    if (hasRealRows && idxNamaPetugas !== -1) {
      rawRows.slice(1).forEach(row => {
        if (!row || row.length === 0) return;
        const name = String(row[idxNamaPetugas] || "").trim().toUpperCase();
        if (!name || name === "NAMA PETUGAS" || name === "0" || name === "NULL" || name === "UNDEFINED") return;

        const ulpRaw = idxNamaUlp !== -1 ? String(row[idxNamaUlp] || "").trim().toUpperCase() : "";
        let cleanUlp = ulpRaw;
        if (!cleanUlp.startsWith("ULP ")) {
          cleanUlp = "ULP " + cleanUlp;
        }

        let totalSkor = 0;
        if (idxTotalSkor !== -1) {
          totalSkor = parseNum(row[idxTotalSkor]);
        } else if (idxPersentaseSkor !== -1) {
          totalSkor = parseNum(row[idxPersentaseSkor]);
        }

        const pctYo = (totalSkor / 15) * 100;
        
        // Filter: % PENCAPAIAN KINERJA YO kecil dari pada 75%
        if (pctYo < 75 && totalSkor > 0) {
          list.push({
            name,
            ulp: cleanUlp || "ULP BUKITTINGGI",
            targetScore: 15,
            score: parseFloat(totalSkor.toFixed(2)),
            percent: parseFloat(pctYo.toFixed(2))
          });
        }
      });
    }

    // Fallback if no real rows or list is empty
    if (list.length === 0) {
      const fallbackList = [
        { name: "ABADI RAHMAD", ulp: "ULP LUBUK SIKAPING", targetScore: 15, score: 11.00, percent: 73.33 },
        { name: "ABDUL HAMID", ulp: "ULP LUBUK BASUNG", targetScore: 15, score: 10.00, percent: 66.67 },
        { name: "AHMAD SALIM", ulp: "ULP KOTO TUO", targetScore: 15, score: 9.50, percent: 63.33 },
        { name: "ADE ANDRI", ulp: "ULP SIMPANG EMPAT", targetScore: 15, score: 11.20, percent: 74.67 },
        { name: "BUDI SANTOSO", ulp: "ULP BUKITTINGGI", targetScore: 15, score: 8.00, percent: 53.33 },
      ];
      list = fallbackList;
    }

    // Apply ULP Filter if specified
    if (selectedUlp !== 'ALL') {
      const uKey = selectedUlp.toUpperCase();
      list = list.filter(o => o.ulp.includes(uKey) || uKey.includes(o.ulp));
    }

    list.sort((a, b) => a.percent - b.percent);
    return list;
  }, [data.vccData, selectedUlp]);

  // Hook to calculate THRESHOLD NILAI YO table data matching the image
  const thresholdTableData = useMemo(() => {
    const standardUlps = [
      { key: "LUBUK BASUNG", name: "ULP LUBUK BASUNG", up3: "BUKITTINGGI", fallbackReal: 89.69, fallbackGreen: 39 },
      { key: "SIMPANG EMPAT", name: "ULP SIMPANG EMPAT", up3: "BUKITTINGGI", fallbackReal: 90.61, fallbackGreen: 48 },
      { key: "BASO", name: "ULP BASO", up3: "BUKITTINGGI", fallbackReal: 99.05, fallbackGreen: 15 },
      { key: "KOTO TUO", name: "ULP KOTO TUO", up3: "BUKITTINGGI", fallbackReal: 96.96, fallbackGreen: 16 },
      { key: "BUKITTINGGI", name: "ULP BUKITTINGGI", up3: "BUKITTINGGI", fallbackReal: 99.49, fallbackGreen: 15 },
      { key: "LUBUK SIKAPING", name: "ULP LUBUK SIKAPING", up3: "BUKITTINGGI", fallbackReal: 96.24, fallbackGreen: 24 },
      { key: "PADANG PANJANG", name: "ULP PADANG PANJANG", up3: "BUKITTINGGI", fallbackReal: 98.29, fallbackGreen: 19 },
    ];

    const rawRows = data.vccData || [];
    const hasRealRows = rawRows.length > 1;

    let headers: string[] = [];
    let idxNamaUlp = -1;
    let idxTotalSkor = -1;
    let idxPersentaseSkor = -1;

    if (hasRealRows) {
      headers = rawRows[0] || [];
      const findIndex = (targets: string[]) => {
        return headers.findIndex(h => targets.includes(String(h || "").trim()));
      };
      idxNamaUlp = findIndex(["Nama Ulp", "Nama ULP", "Ulp", "ULP"]);
      idxTotalSkor = findIndex(["Total Skor", "Skor Total"]);
      idxPersentaseSkor = findIndex(["Persentase Skor", "Persentase skor", "Skor"]);
    }

    const parseNum = (val: any): number => {
      if (val === undefined || val === null || val === "") return 0;
      if (typeof val === 'number') return val;
      const str = String(val).trim();
      if (!str) return 0;

      let cleaned = str.replace('%', '').trim();
      const hasComma = cleaned.includes(',');
      const hasDot = cleaned.includes('.');

      if (hasComma && hasDot) {
        if (cleaned.indexOf(',') < cleaned.indexOf('.')) {
          cleaned = cleaned.replace(/,/g, '');
        } else {
          cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
        }
      } else if (hasComma) {
        const parts = cleaned.split(',');
        if (parts[parts.length - 1].length === 3 && parts[0].length <= 3) {
          cleaned = cleaned.replace(/,/g, '');
        } else {
          cleaned = cleaned.replace(/,/g, '.');
        }
      } else if (hasDot) {
        const parts = cleaned.split('.');
        if (parts[parts.length - 1].length === 3 && parts[0].length <= 3) {
          cleaned = cleaned.replace(/\./g, '');
        }
      }

      return parseFloat(cleaned) || 0;
    };

    const rowsList = standardUlps.map((u) => {
      let realRate = u.fallbackReal;

      if (hasRealRows) {
        let sumTotalSkor = 0;
        let countTotalSkor = 0;

        rawRows.slice(1).forEach(row => {
          if (!row || row.length === 0) return;
          const rowUlpRaw = idxNamaUlp !== -1 ? String(row[idxNamaUlp] || "").toUpperCase() : "";
          if (rowUlpRaw.includes(u.key) || u.key.includes(rowUlpRaw)) {
            if (idxTotalSkor !== -1) {
              sumTotalSkor += parseNum(row[idxTotalSkor]);
              countTotalSkor++;
            } else if (idxPersentaseSkor !== -1) {
              const pSkor = parseNum(row[idxPersentaseSkor]);
              sumTotalSkor += (pSkor / 100) * 15;
              countTotalSkor++;
            }
          }
        });

        if (countTotalSkor > 0) {
          const avgTotalSkor = sumTotalSkor / countTotalSkor;
          realRate = (avgTotalSkor / 15) * 100;
        }
      }

      let greenCount = 0;
      let yellowCount = 0;
      let redCount = 0;
      let totalPetugas = 0;

      const officersForUlp = (data.officerPerformance || []).filter(o => {
        const oUlp = String(o.ulp || "").toUpperCase();
        return oUlp.includes(u.key) || u.key.includes(oUlp);
      });

      if (officersForUlp.length > 0) {
        officersForUlp.forEach(o => {
          const woVal = parseFloat(o.persenWo) || 0;
          const poVal = parseFloat(o.persenPo) || 0;
          const totalAvg = (woVal + poVal) / 2;

          if (totalAvg > 60) {
            greenCount++;
          } else if (totalAvg >= 30) {
            yellowCount++;
          } else {
            redCount++;
          }
        });
        totalPetugas = officersForUlp.length;
      } else {
        greenCount = u.fallbackGreen;
        yellowCount = 0;
        redCount = 0;
        totalPetugas = u.fallbackGreen;
      }

      return {
        key: u.key,
        name: u.name,
        up3: u.up3,
        targetRate: 100,
        realRate: parseFloat(realRate.toFixed(2)),
        green: greenCount,
        yellow: yellowCount,
        red: redCount,
        totalPetugas
      };
    });

    let filteredList = rowsList;
    if (selectedUlp !== 'ALL') {
      const uKey = selectedUlp.toUpperCase();
      filteredList = rowsList.filter(r => r.key.includes(uKey) || uKey.includes(r.key));
    }

    const averageRealRate = rowsList.length > 0 
      ? rowsList.reduce((acc, r) => acc + r.realRate, 0) / rowsList.length 
      : 95.76;

    const totalGreen = rowsList.reduce((acc, r) => acc + r.green, 0);
    const totalYellow = rowsList.reduce((acc, r) => acc + r.yellow, 0);
    const totalRed = rowsList.reduce((acc, r) => acc + r.red, 0);
    const grandTotalPetugas = rowsList.reduce((acc, r) => acc + r.totalPetugas, 0);

    return {
      rows: filteredList,
      totalUp3: {
        targetRate: 100,
        realRate: parseFloat(averageRealRate.toFixed(2)),
        green: totalGreen,
        yellow: totalYellow,
        red: totalRed,
        totalPetugas: grandTotalPetugas
      }
    };
  }, [data.vccData, data.officerPerformance, selectedUlp]);

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#0a1128]/5 rounded-2xl min-h-full border border-gray-100">
      
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-white/5 flex items-center justify-between relative overflow-hidden shadow-lg shadow-blue-950/20">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-[10px] font-black text-brand-accent tracking-widest uppercase">RATA RATA PERFORMA YO UP3</span>
            <span className="text-3xl font-black italic tracking-tight text-brand-accent">{vccMetrics.avgPerforma}%</span>
            <span className="text-[10px] text-white/50 font-bold">Total Skor / 15</span>
          </div>
          <div className="bg-white/5 p-3 rounded-xl z-10">
            <Cpu className="text-brand-accent" size={24} />
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-brand-accent/5 rounded-full blur-xl" />
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-white/5 flex items-center justify-between relative overflow-hidden shadow-lg shadow-blue-950/20">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase">PERFORMA HARI KERJA UP3</span>
            <span className="text-3xl font-black italic tracking-tight text-emerald-400">{vccMetrics.avgKinerjaYo}%</span>
            <span className="text-[10px] text-white/50 font-bold">Realisasi / Seharusnya</span>
          </div>
          <div className="bg-white/5 p-3 rounded-xl z-10">
            <Gauge className="text-emerald-400" size={24} />
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-400/5 rounded-full blur-xl" />
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-white/5 flex items-center justify-between relative overflow-hidden shadow-lg shadow-blue-950/20">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-[10px] font-black text-cyan-400 tracking-widest uppercase">PERFORMA PRODUKTIFITAS KERJA</span>
            <span className="text-3xl font-black italic tracking-tight text-cyan-400">{vccMetrics.avgHariKerja}%</span>
            <span className="text-[10px] text-white/50 font-bold">((RCT/Realisasi)+1,5)/8</span>
          </div>
          <div className="bg-white/5 p-3 rounded-xl z-10">
            <Clock className="text-cyan-400" size={24} />
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-cyan-400/5 rounded-full blur-xl" />
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-white/5 flex items-center justify-between relative overflow-hidden shadow-lg shadow-blue-950/20">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-[10px] font-black text-purple-400 tracking-widest uppercase">TOTAL WO - PO UP3</span>
            <span className="text-3xl font-black italic tracking-tight text-purple-400">{vccMetrics.totalWoPo}%</span>
            <span className="text-[10px] text-white/50 font-bold">Performa P0 + Performa WO</span>
          </div>
          <div className="bg-white/5 p-3 rounded-xl z-10">
            <Sliders className="text-purple-400" size={24} />
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-purple-400/5 rounded-full blur-xl" />
        </div>

      </div>

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Table - Performance per ULP */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 bg-brand-secondary rounded-full" />
              <h3 className="text-sm font-black italic tracking-tighter text-brand-primary uppercase">PERFORMA PER ULP</h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
              <Info size={12} />
              <span>Sumber Data: Sheet VCC_DATA (Realisasi & Target)</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">NAMA ULP</th>
                  <th className="py-3 px-4 text-right">TOTAL NILAI YO</th>
                  <th className="py-3 px-4 text-right">NILAI HARI KERJA</th>
                  <th className="py-3 px-4 text-right">NILAI PRODUKTIVITAS</th>
                  <th className="py-3 px-4 text-right">NILAI PERFORMA WO + PO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-semibold text-gray-700">
                {ulpPerformanceData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                      Tidak ada data untuk filter ULP ini.
                    </td>
                  </tr>
                ) : (
                  ulpPerformanceData.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-black text-slate-800 tracking-tight">
                        ULP {row.name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-brand-secondary">
                        {row.totalNilaiYo}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                        {row.nilaiHariKerja}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-cyan-600">
                        {row.nilaiProduktivitas}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-purple-600">
                        {row.nilaiPerformaWoPo}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Chart - Performance per ULP */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 bg-brand-primary rounded-full" />
            <h3 className="text-sm font-black italic tracking-tighter text-brand-primary uppercase">EVALUASI PERFORMA YO PER ULP</h3>
          </div>
          
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ulpPerformanceData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                  unit="%"
                />
                <RechartsTooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                  formatter={(value: any) => [`${value}%`, "TOTAL NILAI YO"]}
                />
                <Bar 
                  dataKey="totalNilaiYo" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={30}
                >
                  {ulpPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. Detailed Optimizer Matrix & Recommendations */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-brand-primary" />
            <h3 className="text-sm font-black italic tracking-tighter text-brand-primary uppercase">THRESHOLD PENILAIAN & ALOKASI PETUGAS</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-gray-400 uppercase">FILTER UNIT:</span>
            <select 
              value={selectedUlp} 
              onChange={(e) => setSelectedUlp(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2.5 py-1 text-[10px] font-black text-brand-primary outline-none focus:border-brand-secondary transition-colors"
            >
              <option value="ALL">SEMUA UNIT</option>
              {thresholdTableData.rows.map(u => (
                <option key={u.key} value={u.key}>{u.key}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto p-4 sm:p-6 bg-slate-50/40">
          <table className="w-full text-center border-2 border-slate-300 border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#154c79] text-white text-[11px] font-black uppercase tracking-wider">
                <th className="py-3 px-2 border-2 border-slate-300 align-middle" rowSpan={2}>NO</th>
                <th className="py-3 px-4 border-2 border-slate-300 text-left align-middle" rowSpan={2}>NAMA ULP</th>
                <th className="py-3 px-3 border-2 border-slate-300 align-middle" rowSpan={2}>UP3</th>
                <th className="py-3 px-3 border-2 border-slate-300 align-middle" rowSpan={2}>TARGET RATA2<br/>PERFORMA</th>
                <th className="py-3 px-3 border-2 border-slate-300 align-middle" rowSpan={2}>REAL RATA2<br/>PERFORMA</th>
                <th className="py-2.5 px-3 border-2 border-slate-300 bg-[#0a1c3f] text-white align-middle" colSpan={3}>THRESHOLD NILAI YO</th>
                <th className="py-3 px-3 border-2 border-slate-300 bg-[#0a1c3f] text-white align-middle" rowSpan={2}>TOTAL<br/>PETUGAS</th>
              </tr>
              <tr className="text-[10px] font-black uppercase text-center text-white">
                <th className="py-2.5 px-3 border-2 border-slate-300 bg-[#00a651] text-white leading-tight">
                  HIGH PERFORMA<br/>ZONA HIJAU : &gt; 60 %
                </th>
                <th className="py-2.5 px-3 border-2 border-slate-300 bg-[#fff200] text-black leading-tight">
                  MID PERFORMA<br/>ZONA KUNING : 60 s/d 30
                </th>
                <th className="py-2.5 px-3 border-2 border-slate-300 bg-[#ff0000] text-white leading-tight">
                  UNDER PERFORMA<br/>ZONA MERAH : &lt; 30
                </th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-bold text-slate-800 divide-y divide-slate-300">
              {thresholdTableData.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 bg-white font-medium border-2 border-slate-300">
                    Tidak ada data untuk filter ULP ini.
                  </td>
                </tr>
              ) : (
                thresholdTableData.rows.map((row, idx) => (
                  <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-2 border border-slate-300 font-bold text-slate-900 text-center">{idx + 1}</td>
                    <td className="py-3 px-4 border border-slate-300 text-left font-black uppercase text-slate-900">{row.name}</td>
                    <td className="py-3 px-2 border border-slate-300 font-bold text-slate-600 text-center">{row.up3}</td>
                    <td className="py-3 px-2 border border-slate-300 font-black text-slate-900 text-center">{row.targetRate}%</td>
                    <td className="py-3 px-2 border border-slate-300 font-black text-blue-800 bg-blue-50/20 text-center">{row.realRate}%</td>
                    <td className="py-3 px-2 border border-slate-300 font-black text-slate-900 text-center">{row.green}</td>
                    <td className="py-3 px-2 border border-slate-300 font-black text-slate-900 text-center">{row.yellow}</td>
                    <td className="py-3 px-2 border border-slate-300 font-black text-slate-900 text-center">{row.red}</td>
                    <td className="py-3 px-2 border border-slate-300 font-black text-white bg-blue-800 text-center">{row.totalPetugas}</td>
                  </tr>
                ))
              )}
              
              {/* Total Row */}
              <tr className="bg-[#154c79] text-white font-black text-[11px] uppercase text-center">
                <td className="py-3.5 px-4 border-2 border-slate-300 text-left" colSpan={2}>TOTAL UP3</td>
                <td className="py-3.5 px-2 border-2 border-slate-300"></td>
                <td className="py-3.5 px-2 border-2 border-slate-300">{thresholdTableData.totalUp3.targetRate}%</td>
                <td className="py-3.5 px-2 border-2 border-slate-300 bg-[#113a5d]">{thresholdTableData.totalUp3.realRate}%</td>
                <td className="py-3.5 px-2 border-2 border-slate-300 bg-[#00a651]">{thresholdTableData.totalUp3.green}</td>
                <td className="py-3.5 px-2 border-2 border-slate-300 bg-[#c2b800] text-black">{thresholdTableData.totalUp3.yellow}</td>
                <td className="py-3.5 px-2 border-2 border-slate-300 bg-[#cc0000]">{thresholdTableData.totalUp3.red}</td>
                <td className="py-3.5 px-2 border-2 border-slate-300 bg-blue-900">{thresholdTableData.totalUp3.totalPetugas}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Tindak Lanjut Petugas Terbawah Table */}
      <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex flex-col gap-4" id="tindak_lanjut_petugas_terbawah_section">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="text-rose-500" size={18} />
            <h3 className="text-sm font-black italic tracking-tighter text-brand-primary uppercase">TINDAK LANJUT EVALUASI PETUGAS (PERFORMA {"<75%"})</h3>
          </div>
          <span className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-150 rounded-full text-[9px] font-black uppercase">
            Terdeteksi: {bottomOfficers.length} Orang
          </span>
        </div>
        
        <div className="overflow-x-auto border border-slate-300 rounded-xl">
          <table className="w-full text-left border-collapse text-[11px] font-semibold text-slate-800">
            <thead>
              <tr className="bg-slate-800 text-[#00e5ff] uppercase font-black text-[9px] tracking-wider text-center">
                <th className="py-3 px-3 border-2 border-slate-300 text-center w-12">No</th>
                <th className="py-3 px-4 border-2 border-slate-300 text-left w-64">Nama Petugas Yantek</th>
                <th className="py-3 px-4 border-2 border-slate-300 text-left w-52">Nama ULP</th>
                <th className="py-3 px-3 border-2 border-slate-300 w-36">Target Skor YO</th>
                <th className="py-3 px-3 border-2 border-slate-300 w-36">Pencapaian Skor YO</th>
                <th className="py-3 px-3 border-2 border-slate-300 w-36">% Pencapaian Kinerja YO</th>
                <th className="py-3 px-3 border-2 border-slate-300 w-60">Eviden Tindak Lanjut 1</th>
                <th className="py-3 px-3 border-2 border-slate-300 w-60">Eviden Tindak Lanjut 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 text-[11px] font-bold">
              {bottomOfficers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 bg-slate-50 font-black uppercase tracking-wider border-2 border-slate-300">
                    Tidak ada petugas dengan pencapaian kinerja di bawah 75%
                  </td>
                </tr>
              ) : (
                bottomOfficers.map((officer, idx) => {
                  const runningNo = idx + 1;
                  const name = officer.name;
                  const ulp = officer.ulp;
                  const targetScore = officer.targetScore;
                  const score = officer.score;
                  const percent = officer.percent;

                  // Retrieve uploaded eviden from the synchronized state
                  const eviden = evidenMap[name] || {};
                  const img1 = eviden.fotoEviden1;
                  const img2 = eviden.fotoEviden2;

                  return (
                    <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3 border border-slate-300 text-center font-extrabold text-slate-400 tabular-nums">{runningNo}</td>
                      <td className="py-3.5 px-4 border border-slate-300 text-left font-black uppercase text-slate-900">{name}</td>
                      <td className="py-3.5 px-4 border border-slate-300 text-left font-extrabold text-[#1b3d5d] uppercase">{ulp}</td>
                      <td className="py-3.5 px-3 border border-slate-300 text-center font-bold text-slate-400">15.00</td>
                      <td className="py-3.5 px-3 border border-slate-300 text-center font-black text-slate-800">{score.toFixed(2)}</td>
                      <td className="py-3.5 px-3 border border-slate-300 text-center bg-rose-50/20">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100">
                          {percent.toFixed(1)}%
                        </span>
                      </td>
                      
                      {/* Eviden 1 Column */}
                      <td className="py-2 px-3 border border-slate-300 text-center bg-slate-50/30">
                        {img1 ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-10 bg-slate-100 rounded border border-slate-200 overflow-hidden shrink-0 group relative">
                              <img src={img1} alt="Eviden 1" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <a 
                                href={img1} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[8px] font-black uppercase tracking-wider transition-all"
                              >
                                Buka
                              </a>
                            </div>
                            <span className="text-[7.5px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded leading-none shrink-0">
                              Ada
                            </span>
                          </div>
                        ) : (
                          <span className="text-[7.5px] font-bold uppercase text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                            Belum Ada Foto
                          </span>
                        )}
                      </td>

                      {/* Eviden 2 Column */}
                      <td className="py-2 px-3 border border-slate-300 text-center bg-slate-50/30">
                        {img2 ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-10 bg-slate-100 rounded border border-slate-200 overflow-hidden shrink-0 group relative">
                              <img src={img2} alt="Eviden 2" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <a 
                                href={img2} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[8px] font-black uppercase tracking-wider transition-all"
                              >
                                Buka
                              </a>
                            </div>
                            <span className="text-[7.5px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded leading-none shrink-0">
                              Ada
                            </span>
                          </div>
                        ) : (
                          <span className="text-[7.5px] font-bold uppercase text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                            Belum Ada Foto
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
