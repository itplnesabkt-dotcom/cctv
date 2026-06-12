import React, { useState, useMemo } from 'react';
import { AnomaliData } from '../types';
import { 
  Building2, 
  MapPin, 
  AlertTriangle, 
  Search, 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  AlertOctagon,
  FileSpreadsheet,
  User,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

// Custom classification function for Indonesian Safety & Yandal Metrics
export const classifyAnomaly = (jenis: string, deskripsi: string): number => {
  const J = String(jenis || "").toLowerCase();
  const D = String(deskripsi || "").toLowerCase();
  const text = `${J} ${D}`;

  if (text.includes("cctv") || text.includes("kamera")) return 0;
  if (text.includes("rambu")) return 1;
  if (text.includes("ps4") || text.includes("ps-4") || text.includes("ps 4")) return 2;
  if (text.includes("apd") || text.includes("tunjuk sebut") || text.includes("tunjuk-sebut")) return 3;
  if (text.includes("ccv")) return 4;
  if (text.includes("alat kerja") || text.includes("material") || text.includes("kelengkapan") || text.includes("peralatan")) return 5;
  if (text.includes("wp") || text.includes("jsa") || text.includes("working permit") || text.includes("job safety")) return 6;
  if (text.includes("hsse") || text.includes("yandal sebelum") || (text.includes("lapor") && text.includes("sebelum"))) return 7;
  if (text.includes("briefing") || text.includes("brief")) return 8;
  if (text.includes("tersengat") || text.includes("listrik") || text.includes("sengat") || text.includes("setrum")) return 9;
  if (text.includes("jatuh") || text.includes("ketinggian") || text.includes("terjatuh")) return 10;
  if (text.includes("selesai") || text.includes("pekerjaan selesai")) return 11;

  return -1;
};

interface AnomaliPageProps {
  data: AnomaliData;
}

interface PivotRow {
  petugas: string;
  ulp: string;
  counts: number[]; // 12 elements
  total: number;
}

export const AnomaliPage: React.FC<AnomaliPageProps> = ({ data }) => {
  // 7 ULP under UP3 Bukittinggi
  const ulpList = [
    { id: "bukittinggi", name: "BUKITTINGGI" },
    { id: "padang_panjang", name: "PADANG PANJANG" },
    { id: "lubuk_basung", name: "LUBUK BASUNG" },
    { id: "lubuk_sikaping", name: "LUBUK SIKAPING" },
    { id: "simpang_empat", name: "SIMPANG EMPAT" },
    { id: "baso", name: "BASO" },
    { id: "koto_tuo", name: "KOTO TUO" }
  ];

  const categories = [
    { label: "CCTV", index: 0 },
    { label: "Rambu Kerja", index: 1 },
    { label: "PS4", index: 2 },
    { label: "APD Tunjuk Sebut", index: 3 },
    { label: "Konfirmasi CCV", index: 4 },
    { label: "Kelengkapan Alat Kerja & Material", index: 5 },
    { label: "WP & JSA", index: 6 },
    { label: "Laporan Yandal ke HSSE Sebelum Bekerja", index: 7 },
    { label: "Safety Briefing", index: 8 },
    { label: "Antisipasi tersengat Listrik", index: 9 },
    { label: "Antisipasi Terjatuh dari Ketinggian", index: 10 },
    { label: "Laporan Pekerjaan Selesai", index: 11 },
  ];

  // UP3 Bukittinggi total counts
  const totalUp3Anomali = data?.totalAnomali ?? data?.anomaliList?.length ?? 0;

  // Unified General Modal configuration
  const [detailModal, setDetailModal] = useState<{
    title: string;
    subTitle: string;
    excelName: string;
    rows: any[][];
  } | null>(null);

  // Search within popup table
  const [modalSearch, setModalSearch] = useState('');
  
  // Pagination inside modal
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search and Filters for Pilot/Officer Table
  const [pivotSearch, setPivotSearch] = useState('');
  const [pivotUlpSelect, setPivotUlpSelect] = useState('ALL');

  // Helper to count anomalies for a specific ULP
  const getUlpAnomalyCount = (ulpName: string): number => {
    if (!data || !data.anomaliList) return 0;
    const target = ulpName.toUpperCase().trim();
    return data.anomaliList.filter(row => {
      const rowUlp = String(row[3] || "").toUpperCase().trim();
      return rowUlp === target || rowUlp.includes(target) || target.includes(rowUlp);
    }).length;
  };

  // Helper to filter anomaly rows for the selected unit (either UP3 or specific ULP)
  const getAnomaliRowsForUnit = (unitName: string | null): any[][] => {
    if (!data || !data.anomaliList || !unitName) return [];
    
    if (unitName === "UP3 BUKITTINGGI") {
      return data.anomaliList;
    }
    
    const target = unitName.toUpperCase().trim();
    return data.anomaliList.filter(row => {
      const rowUlp = String(row[3] || "").toUpperCase().trim();
      return rowUlp === target || rowUlp.includes(target) || target.includes(rowUlp);
    });
  };

  // Calculate Officer Pivot Table
  const pivotData: PivotRow[] = useMemo(() => {
    if (!data || !data.anomaliList) return [];

    const groups: { [key: string]: PivotRow } = {};

    data.anomaliList.forEach(row => {
      const rawPetugas = String(row[2] || "").trim();
      const rawUlp = String(row[3] || "").trim().toUpperCase();

      // Skip lines with placeholders
      if (!rawPetugas || rawPetugas === "-" || rawPetugas.toUpperCase() === "UNKNOWN") return;

      const key = `${rawPetugas.toUpperCase()} || ${rawUlp}`;
      if (!groups[key]) {
        groups[key] = {
          petugas: rawPetugas.toUpperCase(),
          ulp: rawUlp,
          counts: Array(12).fill(0),
          total: 0
        };
      }

      const jenis = String(row[4] || "");
      const desc = String(row[5] || "");
      const catIdx = classifyAnomaly(jenis, desc);

      if (catIdx !== -1) {
        groups[key].counts[catIdx]++;
      } else {
        // Fallback to index 0 (CCTV) so everything is counted
        groups[key].counts[0]++;
      }
      groups[key].total++;
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [data]);

  // Filter pivot table rows based on input search and ULP selector
  const filteredPivotData = useMemo(() => {
    return pivotData.filter(row => {
      const matchesSearch = row.petugas.toLowerCase().includes(pivotSearch.toLowerCase()) || 
                            row.ulp.toLowerCase().includes(pivotSearch.toLowerCase());
      
      const matchesUlp = pivotUlpSelect === "ALL" || 
                         row.ulp.toUpperCase() === pivotUlpSelect.toUpperCase() ||
                         row.ulp.toUpperCase().includes(pivotUlpSelect.toUpperCase());
                         
      return matchesSearch && matchesUlp;
    });
  }, [pivotData, pivotSearch, pivotUlpSelect]);

  const handlePivotSearchChange = (val: string) => {
    setPivotSearch(val);
  };

  const handlePivotUlpChange = (val: string) => {
    setPivotUlpSelect(val);
  };

  // Handle open modal for standard Unit card klik
  const openModalForUnit = (unitName: string) => {
    const rows = getAnomaliRowsForUnit(unitName);
    setDetailModal({
      title: `ANOMALI ${unitName}`,
      subTitle: `Total Temuan: ${rows.length} Baris Terdeteksi`,
      excelName: `ANOMALI_${unitName.replace(/\s+/g, '_')}`,
      rows: rows
    });
    setModalSearch('');
    setCurrentPage(1);
  };

  // Handle open modal for specific Pivot table cell click!
  const openModalForCell = (petugas: string, ulp: string, categoryIdx: number | null, categoryLabel?: string) => {
    const filtered = (data?.anomaliList || []).filter(row => {
      const rowPetugas = String(row[2] || "").toUpperCase().trim();
      if (rowPetugas !== petugas.toUpperCase().trim()) return false;
      
      const rowUlp = String(row[3] || "").toUpperCase().trim();
      if (ulp !== "ALL" && rowUlp !== ulp.toUpperCase().trim() && !rowUlp.includes(ulp.toUpperCase().trim())) return false;
      
      if (categoryIdx !== null) {
        const rowJenis = String(row[4] || "");
        const rowDesc = String(row[5] || "");
        const idx = classifyAnomaly(rowJenis, rowDesc);
        if (idx !== categoryIdx) {
          if (categoryIdx === 0 && idx === -1) return true; // Fallback mapping match
          return false;
        }
      }
      return true;
    });

    setDetailModal({
      title: `${petugas} (${ulp})`,
      subTitle: categoryLabel ? `Pemeriksaan Integritas: ${categoryLabel} (${filtered.length} Kasus)` : `Semua Temuan Integritas (${filtered.length} Kasus)`,
      excelName: `ANOMALI_${petugas.replace(/\s+/g, '_')}_${ulp}_${(categoryLabel || "ALL").replace(/\s+/g, '_')}`,
      rows: filtered
    });
    setModalSearch('');
    setCurrentPage(1);
  };

  // Excel Export for Pivot table itself
  const handleExportPivotExcel = () => {
    const headers = [
      "PETUGAS", "ULP", 
      "CCTV", "Rambu Kerja", "PS4", "APD Tunjuk Sebut", 
      "Konfirmasi CCV", "Kelengkapan Alat Kerja & Material", "WP & JSA", 
      "Laporan Yandal ke HSSE Sebelum Bekerja", "Safety Briefing", 
      "Antisipasi tersengat Listrik", "Antisipasi Terjatuh dari Ketinggian", 
      "Laporan Pekerjaan Selesai", "TOTAL"
    ];
    
    const rows = filteredPivotData.map(r => [
      r.petugas,
      r.ulp,
      ...r.counts,
      r.total
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Per Petugas");
    XLSX.writeFile(wb, `REKAP_ANOMALI_PETUGAS_${new Date().getTime()}.xlsx`);
  };

  // Excel Export inside modal
  const handleExportExcelModal = (name: string, rows: any[][]) => {
    const headers = ["No Laporan", "Tgl Lapor", "Nama Petugas", "ULP", "Jenis Anomali", "Deskripsi", "RPT", "RCT"];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anomali Detail");
    XLSX.writeFile(wb, `${name}_${new Date().getTime()}.xlsx`);
  };

  // Helpers for filtering modal
  const filteredModalRows = useMemo(() => {
    if (!detailModal) return [];
    if (!modalSearch.trim()) return detailModal.rows;
    const term = modalSearch.toLowerCase().trim();
    return detailModal.rows.filter(row => {
      return row.some(cell => String(cell || "").toLowerCase().includes(term));
    });
  }, [detailModal, modalSearch]);

  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredModalRows.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredModalRows, currentPage]);

  const totalPages = Math.ceil(filteredModalRows.length / itemsPerPage) || 1;

  const getJenisBadgeColor = (jenis: string) => {
    const j = jenis.toLowerCase();
    if (j.includes("kronologi") || j.includes("waktu")) return "bg-amber-50 text-amber-700 border-amber-200";
    if (j.includes("check") || j.includes("check-in") || j.includes("tanpa")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
    if (j.includes("ekstrim") || j.includes("durasi")) return "bg-purple-50 text-purple-700 border-purple-200";
    if (j.includes("petugas") || j.includes("kosong")) return "bg-pink-50 text-pink-700 border-pink-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  };

  return (
    <div id="anomali_page_outer" className="flex flex-col gap-6 p-6 bg-slate-50/50 rounded-2xl min-h-full">
      
      {/* Title block */}
      <div id="anomali_page_hero" className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black tracking-tight text-gray-900 flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
              <AlertTriangle className="animate-pulse" size={16} />
            </span>
            MONITORING INTEGRITAS DATA YANDAL
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5 font-semibold">
            Gunakan layout di bawah untuk memonitor kasus anomali. Klik pada setiap angka unit atau angka di tabel petugas untuk memunculkan detail data.
          </p>
        </div>
      </div>

      {/* Row 1 Grid: All cards aligned in a single row */}
      <div 
        id="anomali_row_deck" 
        className="flex overflow-x-auto pb-4 gap-4 snap-x lg:grid lg:grid-cols-8 lg:overflow-x-visible lg:pb-0"
      >
        
        {/* Card 1: UP3 BUKITTINGGI */}
        <div 
          onClick={() => openModalForUnit("UP3 BUKITTINGGI")}
          id="card_up3_bukittinggi" 
          className="snap-center shrink-0 w-[240px] lg:w-auto bg-gradient-to-br from-rose-500 to-rose-600 text-white p-5 rounded-2xl shadow-md shadow-rose-200 border border-rose-400 hover:shadow-lg hover:scale-[1.03] active:scale-95 transition-all cursor-pointer flex flex-col justify-between min-h-[160px]"
        >
          <div className="flex items-start justify-between">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Building2 size={20} className="text-white" />
            </div>
            {totalUp3Anomali > 0 ? (
              <span className="bg-white/20 text-white text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertOctagon size={8} className="animate-ping" />
                UTAMA
              </span>
            ) : (
              <span className="bg-emerald-500/30 text-emerald-100 text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full">
                NIHIL
              </span>
            )}
          </div>
          
          <div className="mt-4">
            <p className="text-[9px] font-extrabold tracking-widest text-rose-100 uppercase">
              UP3 BUKITTINGGI
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <h3 className="text-3xl font-black tracking-tight leading-none hover:underline">
                {totalUp3Anomali.toLocaleString()}
              </h3>
              <span className="text-[10px] text-rose-100 font-bold">kasus</span>
            </div>
            <p className="text-[8px] text-rose-100/85 font-medium mt-1 line-clamp-1">
              Semua temuan anomali
            </p>
          </div>
        </div>

        {/* 7 ULP Cards */}
        {ulpList.map((ulp) => {
          const count = getUlpAnomalyCount(ulp.name);
          return (
            <div 
              key={ulp.id}
              id={`card_ulp_${ulp.id}`}
              onClick={() => openModalForUnit(ulp.name)}
              className="snap-center shrink-0 w-[180px] lg:w-auto bg-white hover:bg-rose-50/10 p-5 rounded-2xl border border-gray-100 hover:border-rose-200 shadow-sm hover:shadow-md hover:-translate-y-1 active:scale-95 transition-all cursor-pointer flex flex-col justify-between min-h-[160px]"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                  <MapPin size={16} />
                </div>
                <span className={`text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full ${
                  count > 0 ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                }`}>
                  {count > 0 ? "TEMUAN" : "AMAN"}
                </span>
              </div>
              
              <div className="mt-4">
                <p className="text-[9px] font-extrabold tracking-widest text-gray-400 uppercase truncate">
                  {ulp.name}
                </p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <h3 className={`text-2xl font-black tracking-tight leading-none tabular-nums ${
                    count > 0 ? "text-rose-600 hover:underline" : "text-gray-800"
                  }`}>
                    {count.toLocaleString()}
                  </h3>
                  <span className="text-[9px] text-gray-400 font-bold">Kasus</span>
                </div>
                <p className="text-[8px] text-gray-400 font-medium mt-1">
                  ULP {ulp.name}
                </p>
              </div>
            </div>
          );
        })}

      </div>

      {/* Section 2: Tabel Per Petugas as requested with exactly matched headers */}
      <div id="pivot_petugas_section" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col gap-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black tracking-widest text-slate-900 uppercase flex items-center gap-1.5">
              <User size={14} className="text-rose-500" />
              REKAPITULASI ANOMALI INTEGRITAS DATA PER PETUGAS
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
              Diurutkan dari total temuan kasus anomali terbanyak
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ULP dropdown selection */}
            <select
              value={pivotUlpSelect}
              onChange={(e) => handlePivotUlpChange(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 focus:border-rose-450 focus:outline-none bg-white text-[11px] font-black uppercase text-slate-700 rounded-xl"
            >
              <option value="ALL">SEMUA ULP (UP3)</option>
              {ulpList.map(u => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>

            {/* Live Search inside pivot table */}
            <div className="relative w-44">
              <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-400">
                <Search size={12} />
              </span>
              <input
                type="text"
                value={pivotSearch}
                onChange={(e) => handlePivotSearchChange(e.target.value)}
                placeholder="Cari petugas..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 focus:border-rose-450 focus:outline-none bg-white text-[11px] font-bold text-slate-700 rounded-xl"
              />
            </div>

            {/* Export Pivot Button */}
            <button
              onClick={handleExportPivotExcel}
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-[10px] font-extrabold tracking-widest uppercase transition-all"
            >
              <Download size={11} />
              EXPORT MATRIX
            </button>
          </div>
        </div>

        {/* Pivot Matrix Table Wrapper */}
        <div className="overflow-auto border border-slate-300 rounded-xl custom-scrollbar max-h-[600px] shadow-inner">
          <table className="w-full text-center border-collapse text-[11px] font-semibold text-slate-800 min-w-[1300px]">
            <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-750">
              {/* Row 1 Headers */}
              <tr className="bg-slate-900 text-white uppercase font-black text-[10px] tracking-wider">
                <th rowSpan={2} className="px-3 py-4 border-r border-slate-700 text-left min-w-[200px] sticky top-0 bg-slate-900 z-10">PETUGAS</th>
                <th rowSpan={2} className="px-3 py-4 border-r border-slate-700 text-left min-w-[140px] sticky top-0 bg-slate-900 z-10">ULP</th>
                <th colSpan={12} className="px-3 py-2 border-r border-slate-700 text-center tracking-widest bg-slate-800 text-slate-100">KETERANGAN ANOMALI</th>
                <th rowSpan={2} className="px-3 py-4 text-center min-w-[80px] bg-rose-950 text-white border-l border-slate-700 sticky top-0 bg-rose-950 z-10">TOTAL</th>
              </tr>
              {/* Row 2 Sub-headers with EXACT requested names */}
              <tr className="bg-slate-800 text-slate-300 uppercase text-[9px] font-black tracking-tight border-t border-slate-700">
                <th className="px-2 py-3 border-r border-slate-700 min-w-[90px] bg-slate-800">CCTV</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[110px] bg-slate-800">Rambu Kerja</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[80px] bg-slate-800">PS4</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[120px] bg-slate-800">APD Tunjuk Sebut</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[110px] bg-slate-800">Konfirmasi CCV</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[150px] bg-slate-800">Kelengkapan Alat Kerja & Material</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[90px] bg-slate-800">WP & JSA</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[160px] bg-slate-800">Laporan Yandal ke HSSE Sebelum Bekerja</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[110px] bg-slate-800">Safety Briefing</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[120px] bg-slate-800">Antisipasi tersengat Listrik</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[120px] bg-slate-800">Antisipasi Terjatuh dari Ketinggian</th>
                <th className="px-2 py-3 border-r border-slate-700 min-w-[120px] bg-slate-800">Laporan Pekerjaan Selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 bg-white">
              {filteredPivotData.length > 0 ? (
                filteredPivotData.map((row, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 border-r border-slate-300 text-left font-black text-slate-900 uppercase">
                        {row.petugas}
                      </td>
                      <td className="px-3 py-3 border-r border-slate-300 text-left font-extrabold text-[10px] text-slate-500 uppercase">
                        {row.ulp}
                      </td>
                      {categories.map((cat) => {
                        const count = row.counts[cat.index];
                        return (
                          <td 
                            key={cat.index} 
                            onClick={() => count > 0 ? openModalForCell(row.petugas, row.ulp, cat.index, cat.label) : null}
                            className={`px-2 py-3 border-r border-slate-300 text-center text-xs tabular-nums transition-colors ${
                              count > 0 
                                ? "cursor-pointer hover:bg-rose-50 text-rose-600 font-extrabold hover:underline" 
                                : "text-slate-350 font-normal"
                            }`}
                          >
                            {count > 0 ? count : "-"}
                          </td>
                        );
                      })}
                      {/* Total column */}
                      <td 
                        onClick={() => row.total > 0 ? openModalForCell(row.petugas, row.ulp, null) : null}
                        className="px-2 py-3 text-center text-xs font-black bg-rose-50 text-rose-700 border-l border-slate-300 cursor-pointer hover:bg-rose-100 hover:underline"
                      >
                        {row.total}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={15} className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                    Tidak ada data petugas yang cocok dengan filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total info badge footer */}
        <div className="flex items-center justify-between border-t border-slate-150 pt-3" id="pivot_pagination_bar">
          <span className="text-[10px] text-slate-500 font-bold uppercase">
            Total Terdeteksi: <span className="text-rose-600 font-black">{filteredPivotData.length}</span> Petugas • Semua data dimuat dalam 1 halaman / scrollable view
          </span>
        </div>
      </div>

      {/* Bespoke Universal Interactive Details Modal */}
      <AnimatePresence>
        {detailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with elegant blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              id="modal_backdrop"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
              id="anomali_detail_modal"
            >
              
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-widest uppercase">
                      DETAIL DATA ANOMALI: {detailModal.title}
                    </h3>
                    <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                      {detailModal.subTitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleExportExcelModal(detailModal.excelName, detailModal.rows)}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-[10px] font-extrabold tracking-widest uppercase transition-all"
                  >
                    <Download size={12} />
                    EXPORT EXCEL ({detailModal.rows.length})
                  </button>
                  <button
                    onClick={() => setDetailModal(null)}
                    className="w-9 h-9 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-colors rounded-xl bg-slate-800 text-slate-400"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Toolbar: Live Search & Summary stats */}
              <div className="p-4 bg-slate-50 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                  Menampilkan <span className="text-rose-600 font-extrabold">{filteredModalRows.length}</span> data dari total {detailModal.rows.length}
                </p>
                
                <div className="relative w-full sm:w-72">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setCurrentPage(1); // reset to page 1
                    }}
                    placeholder="Cari No. Laporan, Petugas, Deskripsi..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 focus:border-rose-450 focus:outline-none bg-white text-xs font-bold text-gray-700 rounded-xl transition-all shadow-inner"
                  />
                  {modalSearch && (
                    <button 
                      onClick={() => { setModalSearch(''); setCurrentPage(1); }}
                      className="absolute inset-y-0 right-3 flex items-center hover:text-red-500 text-gray-400 text-xs font-black"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="flex-1 overflow-auto p-5 custom-scrollbar min-h-[300px]">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px] text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200 text-gray-500 font-extrabold uppercase tracking-widest text-[9px]">
                        <th className="px-4 py-3 w-32">No Laporan</th>
                        <th className="px-4 py-3 w-40">Tgl Lapor</th>
                        <th className="px-4 py-3 w-48">Petugas</th>
                        <th className="px-4 py-3 w-32">ULP Unit</th>
                        <th className="px-4 py-3 w-44">Jenis Anomali</th>
                        <th className="px-4 py-3">Deskripsi Temuan</th>
                        <th className="px-4 py-3 w-20 text-center">RPT</th>
                        <th className="px-4 py-3 w-20 text-center">RCT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                      {paginatedRows.length > 0 ? (
                        paginatedRows.map((row, idx) => {
                          const [noLaporan, tglLapor, mPetugas, rUlp, jenis, deskripsi, rpt, rct] = row;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 text-slate-950 font-black tabular-nums whitespace-nowrap">
                                {noLaporan}
                              </td>
                              <td className="px-4 py-3 text-gray-500 whitespace-nowrap tabular-nums">
                                {tglLapor}
                              </td>
                              <td className="px-4 py-3 font-bold text-gray-800">
                                {mPetugas || "-"}
                              </td>
                              <td className="px-4 py-3 text-[10px] uppercase font-extrabold tracking-wider text-slate-500 whitespace-nowrap">
                                {rUlp}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-extrabold ${getJenisBadgeColor(jenis || "")}`}>
                                  {jenis}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 leading-relaxed font-normal whitespace-pre-wrap break-words min-w-[250px] max-w-sm">
                                {deskripsi}
                              </td>
                              <td className="px-4 py-3 font-bold text-center text-gray-500 tabular-nums">
                                {rpt}
                              </td>
                              <td className="px-4 py-3 font-bold text-center text-gray-500 tabular-nums">
                                {rct}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-16 text-gray-400 font-bold uppercase tracking-widest">
                            Tidak ada data anomali ditemukan
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Panel: Pagination and closing stats */}
              <div className="bg-slate-50 p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[10px] text-gray-400 font-black tracking-widest uppercase">
                  PLN ELECTRICITY DATA SERVICE • UP3 BUKITTINGGI
                </span>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2" id="modal_pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-gray-600 min-w-[70px] text-center">
                      Hlm {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
