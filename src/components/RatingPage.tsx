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

  const totals = rating.officerRatings.reduce((acc, curr) => ({
    totalWo: acc.totalWo + curr.totalWoPlnMobile,
    r5: acc.r5 + curr.rating5,
    r34: acc.r34 + curr.rating34,
    r12: acc.r12 + curr.rating12,
    noR: acc.noR + curr.noRating
  }), { totalWo: 0, r5: 0, r34: 0, r12: 0, noR: 0 });

  const totalPct = totals.totalWo > 0 
    ? Math.round((totals.r5 / totals.totalWo) * 100)
    : 100;

  const sidebarCards = [
    { label: "% KOMULATIF", value: `${totalPct}%`, color: totalPct === 100 ? "bg-[#00B050]" : "bg-[#FF0000]", textColor: "text-white" },
    { label: "TOTAL WO PLN MOBILE", value: totals.totalWo.toLocaleString(), color: "bg-[#0000FF]", textColor: "text-white" },
    { label: "WO RATING 5", value: totals.r5.toLocaleString(), color: "bg-[#00B050]", textColor: "text-white" },
    { label: "WO RATING 3-4", value: totals.r34.toLocaleString(), color: "bg-[#FFFF00]", textColor: "text-black" },
    { label: "WO RATING 1-2", value: totals.r12.toLocaleString(), color: "bg-[#FF0000]", textColor: "text-white" },
    { label: "WO TIDAK ADA RATING", value: totals.noR.toLocaleString(), color: "bg-[#212121]", textColor: "text-white" },
  ];

  const totalPages = Math.ceil(rating.officerRatings.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = rating.officerRatings.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar - RINGKASAN DATA ULP */}
        <div className="lg:w-64 flex flex-col gap-4">
          <div className="bg-brand-primary p-4 rounded-t-xl text-white">
            <h3 className="text-xs font-black italic uppercase tracking-tighter text-center">RINGKASAN DATA ULP</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            {sidebarCards.map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`${card.color} p-4 rounded-xl shadow-sm border border-black/10 flex flex-col items-center justify-center text-center`}
              >
                <p className={`text-[10px] font-black uppercase tracking-widest ${card.textColor} opacity-80 mb-2`}>{card.label}</p>
                <h3 className={`text-2xl font-black italic ${card.textColor}`}>{card.value}</h3>
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
                    <td colSpan={8} className="p-12 text-center text-gray-400 font-bold italic uppercase tracking-widest text-xs">
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

