import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Award, TrendingUp, Users, Zap, ShieldCheck, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { DashboardData } from '../types.ts';

interface RatingPageProps {
  data: DashboardData;
}

export const RatingPage: React.FC<RatingPageProps> = ({ data }) => {
  const { rating } = data;
  const [currentPage, setCurrentPage] = useState(1);
  const [currentKPPage, setCurrentKPPage] = useState(1);
  const [selectedRegu, setSelectedRegu] = useState('Semua Regu');
  const [selectedUnit, setSelectedUnit] = useState('Semua Unit');
  const rowsPerPage = 12;
  const kpRowsPerPage = 10;

  const totalPct = rating.totalWoPlnMobile > 0 
    ? Math.round((rating.rating5 / rating.totalWoPlnMobile) * 100)
    : 100;

  const [modalData, setModalData] = useState<{ isOpen: boolean; title: string; data: any[][] }>({
    isOpen: false,
    title: "",
    data: []
  });

  const sidebarCards = [
    { label: "% KOMULATIF", value: `${totalPct}%`, color: totalPct === 100 ? "bg-emerald-500" : "bg-red-500", textColor: "text-white", clickable: false },
    { label: "TOTAL WO", value: rating.totalWoPlnMobile.toLocaleString(), color: "bg-blue-600", textColor: "text-white", clickable: true, detail: rating.totalWoPlnMobileList },
    { label: "RATING 5", value: rating.rating5.toLocaleString(), color: "bg-emerald-600", textColor: "text-white", clickable: true, detail: rating.rating5List },
    { label: "RATING 3-4", value: rating.rating34.toLocaleString(), color: "bg-amber-400", textColor: "text-slate-900", clickable: true, detail: rating.rating34List },
    { label: "RATING 1-2", value: rating.rating12.toLocaleString(), color: "bg-rose-600", textColor: "text-white", clickable: true, detail: rating.rating12List },
    { label: "NO RATING", value: rating.noRating.toLocaleString(), color: "bg-slate-800", textColor: "text-white", clickable: true, detail: rating.noRatingList },
  ];

  const handleCardClick = (card: typeof sidebarCards[0]) => {
    if (!card.clickable || !card.detail) return;
    setModalData({
      isOpen: true,
      title: card.label,
      data: card.detail
    });
  };

  const uniqueRegus = ['Semua Regu', ...new Set(rating.officerRatings.map(officer => officer.regu).filter(Boolean))].sort();
  const uniqueUnits = ['Semua Unit', ...new Set(rating.kpRatings.map(kp => kp.ulp).filter(Boolean))].sort();

  const filteredOfficers = selectedRegu === 'Semua Regu' 
    ? rating.officerRatings 
    : rating.officerRatings.filter(officer => officer.regu === selectedRegu);

  const totalPages = Math.ceil(filteredOfficers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredOfficers.slice(startIndex, startIndex + rowsPerPage);

  const filteredKPs = selectedUnit === 'Semua Unit' 
    ? rating.kpRatings 
    : rating.kpRatings.filter(kp => kp.ulp === selectedUnit);

  const totalKPPages = Math.ceil(filteredKPs.length / kpRowsPerPage);
  const startKPIndex = (currentKPPage - 1) * kpRowsPerPage;
  const paginatedKPData = filteredKPs.slice(startKPIndex, startKPIndex + kpRowsPerPage);

  return (
    <div className="flex flex-col gap-8 relative px-2 pb-12">
      {modalData.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20"
          >
            <div className="bg-brand-primary p-6 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-brand-secondary" size={24} />
                <h3 className="text-xl font-black italic tracking-tighter uppercase">DETAIL DATA: {modalData.title}</h3>
              </div>
              <button 
                onClick={() => setModalData(prev => ({ ...prev, isOpen: false }))}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <ChevronLeft size={24} className="rotate-90 md:rotate-0" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1b3d5d] text-white">
                    <tr className="text-[11px] font-black uppercase italic tracking-tighter">
                      <th className="p-4 border-b border-white/10 whitespace-nowrap">NO LAPORAN</th>
                      <th className="p-4 border-b border-white/10 whitespace-nowrap">TANGGAL</th>
                      <th className="p-4 border-b border-white/10 whitespace-nowrap">NAMA PETUGAS</th>
                      <th className="p-4 border-b border-white/10 whitespace-nowrap">ULP</th>
                      <th className="p-4 border-b border-white/10 whitespace-nowrap">RATING</th>
                      <th className="p-4 border-b border-white/10 whitespace-nowrap">SUMBER LAPOR</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-black italic uppercase text-brand-primary">
                    {modalData.data.length > 0 ? (
                      modalData.data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 border-b border-gray-100 transition-colors">
                          {row.map((cell, j) => (
                            <td key={j} className="p-4 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-gray-400">TIDAK ADA DATA DITEMUKAN</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-white text-right shrink-0">
              <span className="text-[10px] font-black text-gray-400 uppercase mr-4">MENAMPILKAN {modalData.data.length} DATA</span>
              <button 
                onClick={() => setModalData(prev => ({ ...prev, isOpen: false }))}
                className="bg-brand-primary text-white px-6 py-2 rounded-xl text-xs font-black uppercase italic tracking-widest hover:bg-brand-primary/90 transition-all active:scale-95 shadow-lg shadow-brand-primary/20"
              >
                TUTUP
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* TOP METRICS: RINGKASAN DATA UP3 (Horizontal) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {sidebarCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => handleCardClick(card)}
            className={`${card.color} p-4 rounded-xl shadow-md border border-white/10 flex flex-col items-center justify-center text-center ${card.clickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg transition-all active:scale-95' : ''} relative overflow-hidden h-24`}
          >
            <div className="absolute top-0 right-0 p-1 opacity-20 text-white">
              <Zap size={20} />
            </div>
            <p className={`text-[9px] font-black uppercase tracking-widest ${card.textColor} opacity-80 mb-1 z-10`}>{card.label}</p>
            <h3 className={`text-xl font-black italic ${card.textColor} z-10 tracking-tighter`}>{card.value}</h3>
            {card.clickable && (
              <div className={`mt-1 text-[7.5px] font-black uppercase tracking-widest ${card.textColor} opacity-50 border-t border-current/20 pt-1 w-full z-10`}>
                Lihat Detail
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-10">
        <div className="flex flex-col xl:flex-row gap-8 items-stretch">
          {/* LEFT COLUMN: RINGKASAN DATA ULP (1/3 width) - Stretching to match total height */}
          <div className="xl:w-80 2xl:w-1/4 3xl:w-1/3 flex flex-col gap-6">
            <div className="flex items-center gap-3 px-2 shrink-0">
              <Award size={18} className="text-brand-secondary" />
              <h3 className="text-sm font-black italic uppercase tracking-widest text-slate-800">RINGKASAN DATA ULP</h3>
            </div>
            <div className="flex-1 flex flex-col gap-4">
              {rating.ulpRatings.map((ulp, idx) => (
                <ULPSummaryCard key={idx} ulp={ulp} delay={idx * 0.05} />
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: TABLES (2/3 width) */}
          <div className="flex-1 min-w-0 flex flex-col gap-10">
            {/* TABLE 1: RATING PLN MOBILE PER PETUGAS */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-5 bg-brand-primary text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-brand-secondary/20 rounded-xl text-brand-secondary">
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black italic tracking-tighter uppercase leading-none">RATING PLN MOBILE PER PETUGAS</h3>
                    <p className="text-[10px] text-white/50 font-bold uppercase mt-1.5 tracking-wider">Evaluasi Kinerja Individu</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                    <span className="text-[10px] font-black uppercase text-white/60">FILTER REGU:</span>
                    <select 
                      value={selectedRegu}
                      onChange={(e) => {
                        setSelectedRegu(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-transparent text-white text-[10px] font-black uppercase outline-none cursor-pointer"
                    >
                      {uniqueRegus.map(regu => (
                        <option key={regu} value={regu} className="text-brand-primary">{regu}</option>
                      ))}
                    </select>
                    {selectedRegu !== 'Semua Regu' && (
                      <button 
                        onClick={() => {
                          setSelectedRegu('Semua Regu');
                          setCurrentPage(1);
                        }}
                        className="ml-1 p-1 hover:bg-white/10 rounded-full transition-colors"
                        title="Reset Filter"
                      >
                        <RotateCcw size={12} className="text-brand-secondary" />
                      </button>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
                    <Users size={16} className="text-brand-secondary" />
                    <span className="text-[11px] font-black uppercase tracking-widest">{filteredOfficers.length} Petugas</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="text-white text-[11px] font-black uppercase tracking-tighter">
                      <th rowSpan={2} className="bg-[#1b3d5d] py-5 px-6 border-r border-white/5 min-w-[240px] text-left">PETUGAS</th>
                      <th rowSpan={2} className="bg-[#4472C4] py-5 px-6 border-r border-white/5 min-w-[130px] text-left">UNIT ULP</th>
                      <th rowSpan={2} className="bg-[#d38c1a] py-5 px-6 border-r border-white/5 min-w-[180px] text-left">REGU</th>
                      <th colSpan={6} className="bg-[#000080] py-3 border-b border-white/10">KOMULATIF RATING PELAYANAN</th>
                    </tr>
                    <tr className="text-white text-[9px] font-black uppercase tracking-tighter">
                      <th className="bg-[#0000FF] p-3.5 border-r border-white/5 w-28 uppercase">Total WO</th>
                      <th className="bg-[#00B050] p-3.5 border-r border-white/5 w-28 text-white uppercase font-black tracking-widest">R5</th>
                      <th className="bg-[#FFFF00] p-3.5 border-r border-white/5 text-black uppercase font-black tracking-widest">R3-4</th>
                      <th className="bg-[#FF0000] p-3.5 border-r border-white/5 w-28 text-white uppercase font-black tracking-widest">R1-2</th>
                      <th className="bg-[#212121] p-3.5 border-r border-white/5 w-28 text-white uppercase font-black tracking-widest">NONE</th>
                      <th className="bg-[#2b2b2b] p-3.5 w-28 text-brand-secondary uppercase italic font-black">% KOM</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedData.length > 0 ? (
                      paginatedData.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50 text-xs font-bold italic text-brand-primary h-[56px] hover:bg-blue-50/30 transition-colors group">
                          <td className="px-6 py-4 text-left border-r border-gray-50 uppercase tracking-tight group-hover:text-blue-700 font-black">{item.name}</td>
                          <td className="px-6 py-4 text-left border-r border-gray-50 uppercase tracking-tight text-gray-400 font-medium">{item.ulp}</td>
                          <td className="px-6 py-4 text-left border-r border-gray-50 uppercase tracking-tight text-brand-primary/60">{item.regu}</td>
                          <td className="px-4 border-r border-gray-50 font-black text-slate-700">{item.totalWoPlnMobile}</td>
                          <td className="px-4 border-r border-gray-50 text-emerald-600 font-black">{item.rating5}</td>
                          <td className="px-4 border-r border-gray-50 text-amber-600 font-black">{item.rating34}</td>
                          <td className="px-4 border-r border-gray-50 text-rose-600 font-black">{item.rating12}</td>
                          <td className="px-4 border-r border-gray-50 bg-slate-50 text-slate-800 font-medium">{item.noRating}</td>
                          <td className="p-0">
                            <div className={`h-full w-full flex items-center justify-center font-black italic text-white text-[11px] shadow-inner ${item.percentageKomulatif === '100%' ? 'bg-emerald-500' : 'bg-rose-600'}`}>
                              {item.percentageKomulatif}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-24 text-center text-gray-200 font-black italic uppercase tracking-[0.2em] text-sm">
                          BELUM ADA DATA
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-slate-50 px-6 py-5 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm animate-pulse"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">
                    Halaman {currentPage} Dari {totalPages}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-brand-primary disabled:opacity-20 hover:border-brand-primary hover:shadow-sm transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-brand-primary disabled:opacity-20 hover:border-brand-primary hover:shadow-sm transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* TABLE 2: RATING PER KP */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-5 bg-[#1b3d5d] text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/10 rounded-xl text-brand-secondary">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black italic tracking-tighter uppercase leading-none">RATING PER KANTOR PELAYANAN</h3>
                    <p className="text-[10px] text-white/40 font-bold uppercase mt-1.5 tracking-wider">Unit Pelayanan</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                    <span className="text-[10px] font-black uppercase text-white/60">FILTER UNIT:</span>
                    <select 
                      value={selectedUnit}
                      onChange={(e) => {
                        setSelectedUnit(e.target.value);
                        setCurrentKPPage(1);
                      }}
                      className="bg-transparent text-white text-[10px] font-black uppercase outline-none cursor-pointer"
                    >
                      {uniqueUnits.map(unit => (
                        <option key={unit} value={unit} className="text-brand-primary">{unit}</option>
                      ))}
                    </select>
                    {selectedUnit !== 'Semua Unit' && (
                      <button 
                        onClick={() => {
                          setSelectedUnit('Semua Unit');
                          setCurrentKPPage(1);
                        }}
                        className="ml-1 p-1 hover:bg-white/10 rounded-full transition-colors"
                        title="Reset Filter"
                      >
                        <RotateCcw size={12} className="text-brand-secondary" />
                      </button>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
                    <ShieldCheck size={16} className="text-brand-secondary" />
                    <span className="text-[11px] font-black uppercase tracking-widest">{filteredKPs.length} Unit</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="text-white text-[11px] font-black uppercase tracking-tighter">
                      <th rowSpan={2} className="bg-[#1e293b] py-5 px-6 border-r border-white/5 min-w-[200px] text-left">KANTOR PELAYANAN</th>
                      <th rowSpan={2} className="bg-[#b45309] py-5 px-6 border-r border-white/5 min-w-[130px] text-left">ULP</th>
                      <th colSpan={6} className="bg-[#1e1b4b] py-3 border-b border-white/5">DATA RATING SEUMUR HIDUP</th>
                    </tr>
                    <tr className="text-white text-[9px] font-black uppercase tracking-tighter">
                      <th className="bg-[#1d4ed8] p-4 border-r border-white/5 w-24">TOTAL WO</th>
                      <th className="bg-[#059669] p-4 border-r border-white/5 w-24 uppercase font-black">R5</th>
                      <th className="bg-[#ca8a04] p-4 border-r border-white/5 text-white w-24 uppercase font-black">R3-4</th>
                      <th className="bg-[#dc2626] p-4 border-r border-white/5 w-24 uppercase font-black">R1-2</th>
                      <th className="bg-[#111827] p-4 border-r border-white/5 w-24 italic opacity-80 uppercase font-black">N/R</th>
                      <th className="bg-[#334155] p-4 w-24 uppercase font-black">% PERSEN</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedKPData.length > 0 ? (
                      paginatedKPData.map((kp, idx) => (
                        <tr key={idx} className="border-b border-gray-50 text-[10px] font-bold italic text-brand-primary h-[48px] hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-3 text-left border-r border-gray-50 uppercase tracking-tight font-black group-hover:text-blue-600">{kp.namaKp}</td>
                          <td className="px-6 py-3 text-left border-r border-gray-50 uppercase tracking-tight text-slate-400 font-bold">{kp.ulp}</td>
                          <td className="px-4 border-r border-gray-50 text-slate-600 font-black">{kp.totalWoPlnMobile}</td>
                          <td className="px-4 border-r border-gray-50 text-emerald-600 font-black">{kp.rating5}</td>
                          <td className="px-4 border-r border-gray-50 text-amber-600 font-black">{kp.rating34}</td>
                          <td className="px-4 border-r border-gray-50 text-rose-600 font-black">{kp.rating12}</td>
                          <td className="px-4 border-r border-gray-50 bg-slate-50/50 text-slate-400">{kp.noRating}</td>
                          <td className="p-0">
                            <div className={`h-full w-full flex items-center justify-center font-black text-white ${kp.percentageKomulatif === '100%' ? 'bg-emerald-500 shadow-sm' : 'bg-rose-500'}`}>
                              {kp.percentageKomulatif}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-24 text-center text-slate-200 text-sm font-black uppercase italic tracking-widest">
                          DATA KOSONG
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 px-6 py-5 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest leading-none">
                  Hal {currentKPPage} / {totalKPPages} ({filteredKPs.length} Unit)
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentKPPage(prev => Math.max(1, prev - 1))}
                    disabled={currentKPPage === 1}
                    className="p-2 rounded-xl border border-gray-200 bg-white text-brand-primary disabled:opacity-30 hover:border-brand-primary transition-all shadow-sm"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => setCurrentKPPage(prev => Math.min(totalKPPages, prev + 1))}
                    disabled={currentKPPage === totalKPPages}
                    className="p-2 rounded-xl border border-gray-200 bg-white text-brand-primary disabled:opacity-30 hover:border-brand-primary transition-all shadow-sm"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ULPSummaryCardProps {
  ulp: any;
  delay: number;
}

const ULPSummaryCard: React.FC<ULPSummaryCardProps> = ({ ulp, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className="flex-1 flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all group"
    >
      <div className="bg-[#1b3d5d] px-5 py-3 flex items-center justify-between shrink-0">
        <h4 className="text-[10px] font-black italic uppercase text-white tracking-widest truncate mr-4 leading-none">{ulp.namaUlp}</h4>
        <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black shadow-lg ${ulp.percentageKomulatif === '100%' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {ulp.percentageKomulatif}
        </div>
      </div>
      <div className="p-4 bg-gradient-to-b from-transparent to-slate-50/50 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col bg-blue-50/50 p-2 rounded-2xl border border-blue-100/50 hover:bg-blue-50 transition-colors">
            <span className="text-[7px] font-black text-blue-400 ml-1 uppercase tracking-tighter mb-1">TOTAL WO</span>
            <span className="text-base font-black text-blue-700 leading-none">{ulp.totalWoPlnMobile}</span>
          </div>
          <div className="flex flex-col bg-emerald-50/50 p-2 rounded-2xl border border-emerald-100/50 hover:bg-emerald-50 transition-colors">
            <span className="text-[7px] font-black text-emerald-500 ml-1 uppercase tracking-tighter mb-1">RATING 5</span>
            <span className="text-base font-black text-emerald-600 leading-none">{ulp.rating5}</span>
          </div>
          <div className="flex flex-col bg-amber-50/50 p-2 rounded-2xl border border-amber-100/50 hover:bg-amber-50 transition-colors">
            <span className="text-[7px] font-black text-amber-500 ml-1 uppercase tracking-tighter mb-1">RATING 3-4</span>
            <span className="text-base font-black text-amber-600 leading-none">{ulp.rating34}</span>
          </div>
          <div className="flex flex-col bg-rose-50/50 p-2 rounded-2xl border border-rose-100/50 hover:bg-rose-50 transition-colors">
            <span className="text-[7px] font-black text-rose-500 ml-1 uppercase tracking-tighter mb-1">RATING 1-2</span>
            <span className="text-base font-black text-rose-600 leading-none">{ulp.rating12}</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between group-hover:border-blue-100 transition-colors shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-slate-400"></div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none">TANPA RATING</span>
          </div>
          <span className="text-xs font-black text-slate-800">{ulp.noRating}</span>
        </div>
      </div>
    </motion.div>
  );
};
