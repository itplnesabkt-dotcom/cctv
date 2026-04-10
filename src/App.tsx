import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { SubHeader } from './components/SubHeader';
import { WOUP3Card } from './components/WOUP3Card';
import { ULPStatsCard } from './components/ULPStatsCard';
import { POUP3Card } from './components/POUP3Card';
import { ULPPOStatsCard } from './components/ULPPOStatsCard';
import { PerformanceTable } from './components/PerformanceTable';
import { ULPPerformanceTable } from './components/ULPPerformanceTable';
import { CCTVUsageTable } from './components/CCTVUsageTable';
import { DataTable } from './components/DataTable';
import { DetailModal } from './components/DetailModal';
import { GoogleSheetsService } from './services/googleSheetsService';
import { DashboardData } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUlp, setSelectedUlp] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalHeaders, setModalHeaders] = useState<string[]>([]);
  const [modalRows, setModalRows] = useState<any[][]>([]);

  const handleDetailClick = (type: 'WO' | 'PO', identifier: string, isUlp: boolean, isCctv: boolean) => {
    if (!data) return;

    const headers = type === 'WO' ? data.woHeaders : data.poHeaders;
    const rawRows = type === 'WO' ? data.rawWoRows : data.rawPoRows;
    const indices = type === 'WO' ? data.woIndices : data.poIndices;

    // Build officer to ULP map for fallback
    const officerToUlpMap = new Map<string, string>();
    data.officerPerformance.forEach(op => {
      officerToUlpMap.set(op.name.toLowerCase().trim(), op.ulp.toUpperCase().trim());
    });

    let filteredRows = rawRows;

    // 1. Filter by CCTV if requested
    if (isCctv) {
      filteredRows = filteredRows.filter(row => {
        const cctvVal = String(row[indices.cctv] || '').toUpperCase();
        return cctvVal.includes('CCTV');
      });
    }

    // 2. Filter by ULP or Officer
    if (isUlp) {
      const targetUlp = identifier.toUpperCase().trim();
      filteredRows = filteredRows.filter(row => {
        let rowUlp = "";
        if (indices.ulp !== -1 && row[indices.ulp]) {
          rowUlp = String(row[indices.ulp]).toUpperCase().replace(/^POSKO ULP\s+/i, '').trim();
        } else {
          // Fallback to officer mapping
          const rowName = String(row[indices.name] || '').toLowerCase().trim();
          rowUlp = officerToUlpMap.get(rowName) || "";
        }
        return rowUlp === targetUlp;
      });
      setModalTitle(`DETAIL DATA ${type}${isCctv ? ' (CCTV)' : ''} - ULP: ${identifier}`);
    } else {
      const targetName = identifier.toLowerCase().trim();
      filteredRows = filteredRows.filter(row => {
        const rowName = String(row[indices.name] || '').toLowerCase().trim();
        return rowName === targetName;
      });
      setModalTitle(`DETAIL DATA ${type}${isCctv ? ' (CCTV)' : ''} - PETUGAS: ${identifier}`);
    }

    setModalHeaders(headers);
    setModalRows(filteredRows);
    setModalOpen(true);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await GoogleSheetsService.fetchData(startDate, endDate);
        
        // Check if we actually got any data
        const hasData = result.officerPerformance.length > 0 || result.summary.dataAktif > 0;
        if (!hasData) {
          setError("Tidak ada data yang ditemukan. Pastikan Google Sheets sudah 'Published to the Web' dan ID Spreadsheet sudah benar.");
        } else {
          setError(null);
        }
        
        setData(result);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Gagal menghubungkan ke Google Sheets. Periksa koneksi internet atau pengaturan berbagi spreadsheet.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a1128] text-white gap-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 size={48} className="text-brand-accent" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-black tracking-widest uppercase mb-2">MENYINKRONKAN SISTEM...</h2>
          <p className="text-brand-accent/60 text-xs font-bold tracking-[0.3em] uppercase">MENGHUBUNGKAN KE BASIS DATA GOOGLE SHEETS</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a1128] text-white p-6 gap-6">
        <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-lg max-w-2xl w-full text-center">
          <h2 className="text-2xl font-black text-red-500 tracking-widest uppercase mb-4">KESALAHAN SINKRONISASI</h2>
          <p className="text-white/80 font-bold mb-6">{error}</p>
          <div className="text-left bg-black/40 p-4 rounded text-xs font-mono text-brand-accent/80 space-y-2">
            <p className="font-bold text-white mb-1 underline">LANGKAH PERBAIKAN:</p>
            <p>1. Buka Google Sheet Anda.</p>
            <p>2. Klik menu <span className="text-white">File &gt; Share &gt; Publish to web</span>.</p>
            <p>3. Pilih <span className="text-white">"Entire Document"</span> dan <span className="text-white">"Comma-separated values (.csv)"</span>.</p>
            <p>4. Klik <span className="text-white">Publish</span>.</p>
            <p>5. Refresh halaman ini.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 bg-brand-accent text-[#0a1128] px-8 py-3 font-black tracking-widest uppercase hover:bg-white transition-colors"
          >
            COBA LAGI SEKARANG
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Filter logic
  const ulpList = Array.from(new Set(data.ulpPerformance.map(u => u.ulp))).sort();
  
  const filteredData = {
    ...data,
    ulpPerformance: selectedUlp 
      ? data.ulpPerformance.filter(u => u.ulp === selectedUlp)
      : data.ulpPerformance,
    officerPerformance: selectedUlp
      ? data.officerPerformance.filter(o => o.ulp === selectedUlp)
      : data.officerPerformance,
    summary: selectedUlp 
      ? {
          ...data.summary,
          totalBaca: data.officerPerformance.filter(o => o.ulp === selectedUlp).reduce((a, b) => a + b.jumlahWoTotal, 0),
          totalValid: data.officerPerformance.filter(o => o.ulp === selectedUlp).reduce((a, b) => a + b.totalWoPakaiCctv, 0),
          totalPo: data.officerPerformance.filter(o => o.ulp === selectedUlp).reduce((a, b) => a + b.jumlahPoTotal, 0),
          totalPoCctv: data.officerPerformance.filter(o => o.ulp === selectedUlp).reduce((a, b) => a + b.totalPoPakaiCctv, 0),
          dataAktif: data.officerPerformance.filter(o => o.ulp === selectedUlp).reduce((a, b) => a + b.jumlahPoTotal, 0),
        }
      : data.summary
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SubHeader 
        lastSync={data.summary.lastSync} 
        dataAktif={data.summary.dataAktif} 
        selectedUlp={selectedUlp}
        onUlpChange={setSelectedUlp}
        ulpList={ulpList}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />
      
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-x-hidden">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
          {/* Left Column - WO UP3 & ULP Cards */}
          <div className="lg:col-span-3 flex flex-col">
            <WOUP3Card 
              totalWo={filteredData.summary.totalBaca} 
              totalWoCctv={filteredData.summary.totalValid} 
            />
            <ULPStatsCard ulpData={filteredData.ulpPerformance} />
          </div>

          {/* Center Column - Performance Tables */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <PerformanceTable 
              data={filteredData.officerPerformance} 
              onDetailClick={(type, name, isCctv) => handleDetailClick(type, name, false, isCctv)}
            />
            <ULPPerformanceTable 
              data={filteredData.ulpPerformance} 
              onDetailClick={(type, ulp, isCctv) => handleDetailClick(type, ulp, true, isCctv)}
            />
          </div>

          {/* Right Column - PO UP3 & ULP Cards */}
          <div className="lg:col-span-3 flex flex-col">
            <POUP3Card 
              totalPo={filteredData.summary.totalPo} 
              totalPoCctv={filteredData.summary.totalPoCctv} 
            />
            <ULPPOStatsCard ulpData={filteredData.ulpPerformance} />
          </div>
        </div>
      </main>

      <DetailModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        headers={modalHeaders}
        rows={modalRows}
      />

      <footer className="bg-white border-t border-gray-100 p-4 text-center">
        <p className="text-[10px] font-black text-gray-300 tracking-[0.5em] uppercase">
          © 2026 PT PLN (PERSERO) • UNIT INDUK WILAYAH SUMATERA BARAT • UP3 BUKITTINGGI
        </p>
      </footer>
    </div>
  );
}
