import React, { useEffect, useState } from 'react';
import { Header } from './components/Header.tsx';
import { SubHeader } from './components/SubHeader.tsx';
import { WOUP3Card } from './components/WOUP3Card.tsx';
import { ULPStatsCard } from './components/ULPStatsCard.tsx';
import { POUP3Card } from './components/POUP3Card.tsx';
import { ULPPOStatsCard } from './components/ULPPOStatsCard.tsx';
import { PerformanceTable } from './components/PerformanceTable.tsx';
import { ULPPerformanceTable } from './components/ULPPerformanceTable.tsx';
import { CCTVUsageTable } from './components/CCTVUsageTable.tsx';
import { DataTable } from './components/DataTable.tsx';
import { DetailModal } from './components/DetailModal.tsx';
import { AdminPanel } from './components/AdminPanelComponent.tsx';
import { OverSLAPage } from './components/OverSLAPage.tsx';
import { GoogleSheetsService } from './services/googleSheetsService.ts';
import { DashboardData } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUlp, setSelectedUlp] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<'CCTV' | 'OVER_SLA'>('CCTV');
  
  // Clear filter when changing tabs since the filter source (ULP vs Posko) changes
  useEffect(() => {
    setSelectedUlp("");
  }, [activeTab]);

  const formatDateForQuery = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Set default date range to current month on initial load
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(formatDateForQuery(firstDay));
    setEndDate(formatDateForQuery(now));
  }, []);

  // Memoized filter logic
  const filteredData = React.useMemo(() => {
    if (!data) return null;
    
    return {
      ...data,
      ulpPerformance: (selectedUlp 
        ? data.ulpPerformance.filter(u => u.ulp === selectedUlp)
        : data.ulpPerformance
      ).sort((a, b) => {
        const avgA = (parseFloat(a.persenWo) || 0) + (parseFloat(a.persenPo) || 0);
        const avgB = (parseFloat(b.persenWo) || 0) + (parseFloat(b.persenPo) || 0);
        return avgB - avgA;
      }),
      officerPerformance: (selectedUlp
        ? data.officerPerformance.filter(o => o.ulp === selectedUlp)
        : data.officerPerformance
      ).sort((a, b) => {
        const avgA = (parseFloat(a.persenWo) || 0) + (parseFloat(a.persenPo) || 0);
        const avgB = (parseFloat(b.persenWo) || 0) + (parseFloat(b.persenPo) || 0);
        return avgB - avgA;
      }),
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
  }, [data, selectedUlp]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalHeaders, setModalHeaders] = useState<string[]>([]);
  const [modalRows, setModalRows] = useState<any[][]>([]);

  // Admin Panel State
  const [adminOpen, setAdminOpen] = useState(false);

  // Filter logic options
  const filterList = React.useMemo(() => {
    if (!data) return [];
    if (activeTab === 'OVER_SLA') return data.allPoskos || [];
    return data.allUlps || [];
  }, [data, activeTab]);

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
    const loadData = async (showLoading = false) => {
      // If we already have data and are just changing ULP, we don't need a full-page loader
      // the new caching logic in GoogleSheetsService handles this instantly
      const needsFullLoader = !data || (showLoading && !isRefreshing);
      
      if (needsFullLoader) setIsRefreshing(true);
      
      try {
        const result = await GoogleSheetsService.fetchData(startDate, endDate, selectedUlp);
        const hasData = result.officerPerformance.length > 0 || result.summary.dataAktif > 0;
        if (!hasData) {
          setError("Tidak ada data yang ditemukan untuk rentang tanggal ini.");
        } else {
          setError(null);
        }
        setData(result);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Gagal menghubungkan ke Google Sheets.");
      } finally {
        setIsRefreshing(false);
      }
    };

    loadData(!data);
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, [startDate, endDate, selectedUlp]);

  if (error && !data) {
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

  if (!data) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a1128] text-white">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
          <h2 className="text-xl font-black tracking-widest uppercase">MEMUAT DATA...</h2>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {isRefreshing && (
        <div className="fixed top-0 left-0 w-full h-1 z-[100]">
          <motion.div 
            initial={{ x: "-100%" }} 
            animate={{ x: "100%" }} 
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="h-full bg-brand-accent w-full"
          />
        </div>
      )}

      <Header 
        onAdminClick={() => setAdminOpen(true)} 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <SubHeader 
        lastSync={data.summary.lastSync} 
        dataAktif={data.summary.dataAktif} 
        selectedUlp={selectedUlp}
        onUlpChange={setSelectedUlp}
        ulpList={filterList}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        activeTab={activeTab}
      />
      
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={startDate + endDate + selectedUlp + activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={isRefreshing ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}
          >
            {activeTab === 'CCTV' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
                {/* Left Column - WO UP3 & ULP Cards */}
                <div className="lg:col-span-3 flex flex-col">
                  <WOUP3Card 
                    totalWo={filteredData?.summary.totalBaca || 0} 
                    totalWoCctv={filteredData?.summary.totalValid || 0} 
                  />
                  <ULPStatsCard ulpData={filteredData?.ulpPerformance || []} />
                </div>

                {/* Center Column - Performance Tables */}
                <div className="lg:col-span-6 flex flex-col gap-6">
                  <PerformanceTable 
                    data={filteredData?.officerPerformance || []} 
                    onDetailClick={(type, name, isCctv) => handleDetailClick(type, name, false, isCctv)}
                  />
                  <ULPPerformanceTable 
                    data={filteredData?.ulpPerformance || []} 
                    onDetailClick={(type, ulp, isCctv) => handleDetailClick(type, ulp, true, isCctv)}
                  />
                </div>

                {/* Right Column - PO UP3 & ULP Cards */}
                <div className="lg:col-span-3 flex flex-col">
                  <POUP3Card 
                    totalPo={filteredData?.summary.totalPo || 0} 
                    totalPoCctv={filteredData?.summary.totalPoCctv || 0} 
                  />
                  <ULPPOStatsCard ulpData={filteredData?.ulpPerformance || []} />
                </div>
              </div>
            ) : (
              <OverSLAPage data={filteredData?.overSla || data.overSla} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <DetailModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        headers={modalHeaders}
        rows={modalRows}
      />

      <AdminPanel 
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
      />

      <footer className="bg-white border-t border-gray-100 p-4 text-center">
        <p className="text-[10px] font-black text-gray-300 tracking-[0.5em] uppercase">
          © 2026 PLN ELECTRICITY SERVICES • REGIONAL SUMATERA BARAT • UL BUKITTINGGI
        </p>
      </footer>
    </div>
  );
}
