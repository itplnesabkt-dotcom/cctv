import React from 'react';
import { OfficerPerformance } from '../types';
import { Users, ChevronRight, TrendingUp } from 'lucide-react';

interface PerformanceTableProps {
  data: OfficerPerformance[];
}

export const PerformanceTable: React.FC<PerformanceTableProps> = ({ data }) => {
  return (
    <div className="dashboard-card flex flex-col">
      <div className="bg-brand-primary p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-brand-secondary p-1.5 rounded text-white">
            <Users size={14} />
          </div>
          <h3 className="text-[11px] font-black text-white tracking-widest uppercase">KINERJA PETUGAS</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-brand-accent uppercase">PERINGKAT</span>
          <TrendingUp size={12} className="text-brand-accent" />
        </div>
      </div>

      <div className="overflow-y-auto overflow-x-auto custom-scrollbar" style={{ height: '436px' }}>
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
            <tr className="border-b border-gray-100 h-[36px]">
              <th className="px-2 text-[8px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">NAMA PETUGAS</th>
              <th className="px-2 text-[8px] font-black text-gray-400 tracking-widest uppercase text-center">ULP</th>
              <th className="px-2 text-[8px] font-black text-gray-400 tracking-widest uppercase text-center">WO TOTAL</th>
              <th className="px-2 text-[8px] font-black text-brand-primary tracking-widest uppercase text-center">WO CCTV</th>
              <th className="px-2 text-[8px] font-black text-red-500 tracking-widest uppercase text-center">%</th>
              <th className="px-2 text-[8px] font-black text-gray-400 tracking-widest uppercase text-center">PO TOTAL</th>
              <th className="px-2 text-[8px] font-black text-brand-secondary tracking-widest uppercase text-center">PO CCTV</th>
              <th className="px-2 text-[8px] font-black text-red-500 tracking-widest uppercase text-center">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i} className="table-row h-[40px] border-b border-gray-50/50 last:border-0">
                <td className="px-2 font-black text-brand-primary uppercase text-[10px] whitespace-nowrap">{item.name}</td>
                <td className="px-2 text-center font-bold text-gray-500 uppercase text-[9px]">{item.ulp}</td>
                <td className="px-2 text-center font-bold text-gray-600 text-[10px]">{item.jumlahWoTotal}</td>
                <td className="px-2 text-center font-bold text-brand-primary text-[10px]">{item.totalWoPakaiCctv}</td>
                <td className="px-2 text-center font-bold text-red-600 italic text-[10px]">{item.persenWo}</td>
                <td className="px-2 text-center font-bold text-gray-600 text-[10px]">{item.jumlahPoTotal}</td>
                <td className="px-2 text-center font-bold text-brand-secondary text-[10px]">{item.totalPoPakaiCctv}</td>
                <td className="px-2 text-center font-bold text-red-600 italic text-[10px]">{item.persenPo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 p-3 flex items-center justify-center border-t border-gray-100">
        <button className="text-[10px] font-black text-brand-primary tracking-widest uppercase flex items-center gap-2 hover:opacity-70 transition-opacity">
          LIHAT SEMUA CATATAN KINERJA
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
