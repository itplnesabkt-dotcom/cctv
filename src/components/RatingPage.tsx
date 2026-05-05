import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Award, TrendingUp, Users, Zap, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardData } from '../types.ts';

interface RatingPageProps {
  data: DashboardData;
}

export const RatingPage: React.FC<RatingPageProps> = ({ data }) => {
  const { rating } = data;
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 12;

  const totalPct = rating.totalWoPlnMobile > 0 
    ? Math.round((rating.rating5 / rating.totalWoPlnMobile) * 100)
    : 100;

  const [modalData, setModalData] = useState<{ isOpen: boolean; title: string; data: any[][] }>({
    isOpen: false,
    title: "",
    data: []
  });

  const sidebarCards = [
    { label: "% KOMULATIF", value: `${totalPct}%`, color: totalPct === 100 ? "bg-[#00B050]" : "bg-[#FF0000]", textColor: "text-white", clickable: false },
    { label: "TOTAL WO PLN MOBILE", value: rating.totalWoPlnMobile.toLocaleString(), color: "bg-[#0000FF]", textColor: "text-white", clickable: true, detail: rating.totalWoPlnMobileList },
    { label: "WO RATING 5", value: rating.rating5.toLocaleString(), color: "bg-[#00B050]", textColor: "text-white", clickable: true, detail: rating.rating5List },
    { label: "WO RATING 3-4", value: rating.rating34.toLocaleString(), color: "bg-[#FFFF00]", textColor: "text-black", clickable: true, detail: rating.rating34List },
    { label: "WO RATING 1-2", value: rating.rating12.toLocaleString(), color: "bg-[#FF0000]", textColor: "text-white", clickable: true, detail: rating.rating12List },
    { label: "WO TIDAK ADA RATING", value: rating.noRating.toLocaleString(), color: "bg-[#212121]", textColor: "text-white", clickable: true, detail: rating.noRatingList },
  ];

  const handleCardClick = (card: typeof sidebarCards[0]) => {
    if (!card.clickable || !card.detail) return;
    setModalData({
      isOpen: true,
      title: card.label,
      data: card.detail
    });
  };

  const totalPages = Math.ceil(rating.officerRatings.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = rating.officerRatings.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="flex flex-col gap-6 relative">
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar - RINGKASAN DATA ULP */}
        <div className="lg:w-64 flex flex-col gap-4">
          <div className="bg-brand-primary p-4 rounded-t-xl text-white">
            <h3 className="text-xs font-black italic uppercase tracking-tighter text-center">RINGKASAN DATA UP3</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            {sidebarCards.map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleCardClick(card)}
                className={`${card.color} p-4 rounded-xl shadow-sm border border-black/10 flex flex-col items-center justify-center text-center ${card.clickable ? 'cursor-pointer hover:scale-105 transition-transform active:scale-95' : ''}`}
              >
                <p className={`text-[10px] font-black uppercase tracking-widest ${card.textColor} opacity-80 mb-2`}>{card.label}</p>
                <h3 className={`text-2xl font-black italic ${card.textColor}`}>{card.value}</h3>
                {card.clickable && (
                  <div className={`mt-2 text-[8px] font-black uppercase tracking-widest ${card.textColor} opacity-40 border-t border-current/20 pt-1 w-full`}>
                    KLIK UNTUK DETAIL
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Main Content - Rating Table */}
        <div className="flex-1 w-full overflow-hidden">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm h-full">
            <div className="px-6 py-4 bg-brand-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-brand-secondary" />
                <h3 className="text-sm font-black italic tracking-tighter uppercase">RATING PLN MOBILE PER PETUGAS</h3>
              </div>
              <div className="bg-brand-secondary text-brand-primary px-3 py-1 rounded-full text-[10px] font-black uppercase">
                TOP PERFORMANCE
              </div>
            </div>
            <div className="max-h-[720px] overflow-y-auto">
            <table className="w-full text-center border-collapse border border-gray-800">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="text-white text-[11px] font-black uppercase tracking-tighter">
                  <th rowSpan={2} className="bg-[#1b3d5d] py-3 px-2 border-r border-gray-200 min-w-[200px]">NAMA PETUGAS</th>
                  <th rowSpan={2} className="bg-[#4472C4] py-3 px-2 border-r border-gray-200 min-w-[120px]">ULP</th>
                  <th rowSpan={2} className="bg-[#d38c1a] py-3 px-2 border-r border-gray-200 min-w-[150px]">NAMA REGU</th>
                  <th colSpan={6} className="bg-[#000080] py-2 border-b border-gray-200">KOMULATIF RATING</th>
                </tr>
                <tr className="text-white text-[9px] font-black uppercase tracking-tighter">
                  <th className="bg-[#0000FF] p-2 border-r border-gray-200 w-24">TOTAL WO PLN MOBILE</th>
                  <th className="bg-[#00B050] p-2 border-r border-gray-200 w-24">WO RATING 5</th>
                  <th className="bg-[#FFFF00] p-2 border-r border-gray-200 text-black w-24">WO RATING 3 - 4</th>
                  <th className="bg-[#FF0000] p-2 border-r border-gray-200 w-24">WO RATING 1 - 2</th>
                  <th className="bg-[#212121] p-2 border-r border-gray-200 w-24">WO TIDAK ADA RATING</th>
                  <th className="bg-[#4472C4] p-2 w-24">% KOMULATIF</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paginatedData.length > 0 ? (
                  paginatedData.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-800 text-sm font-black italic text-brand-primary h-[40px]">
                      <td className="p-3 text-left border-r border-gray-800 uppercase tracking-tight">{item.name}</td>
                      <td className="p-3 text-left border-r border-gray-800 uppercase tracking-tight">{item.ulp}</td>
                      <td className="p-3 text-left border-r border-gray-800 uppercase tracking-tight">{item.regu}</td>
                      <td className="p-3 border-r border-gray-800">{item.totalWoPlnMobile}</td>
                      <td className="p-3 border-r border-gray-800">{item.rating5}</td>
                      <td className="p-3 border-r border-gray-800">{item.rating34}</td>
                      <td className="p-3 border-r border-gray-800">{item.rating12}</td>
                      <td className="p-3 border-r border-gray-800">{item.noRating}</td>
                      <td className={`p-3 text-white ${item.percentageKomulatif === '100%' ? 'bg-[#00B050]' : 'bg-[#FF0000]'}`}>
                        {item.percentageKomulatif}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-gray-400 font-bold italic uppercase tracking-widest text-xs">
                      TIDAK ADA DATA RATING DITEMUKAN
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-gray-500 uppercase italic">
                HALAMAN {currentPage} DARI {totalPages} ({rating.officerRatings.length} DATA)
              </span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg border flex items-center justify-center transition-all ${
                  currentPage === 1 
                    ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed' 
                    : 'bg-white text-brand-primary border-gray-200 hover:border-brand-primary active:scale-95'
                }`}
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  if (pageNum < 1 || pageNum > totalPages) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                        currentPage === pageNum
                          ? 'bg-brand-primary text-white'
                          : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-primary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg border flex items-center justify-center transition-all ${
                  currentPage === totalPages 
                    ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed' 
                    : 'bg-white text-brand-primary border-gray-200 hover:border-brand-primary active:scale-95'
                }`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

