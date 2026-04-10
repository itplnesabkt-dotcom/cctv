import React from 'react';
import { ULPPerformance } from '../types';
import { Building2, TrendingUp } from 'lucide-react';

interface ULPPerformanceTableProps {
  data: ULPPerformance[];
}

export const ULPPerformanceTable: React.FC<ULPPerformanceTableProps> = ({ data }) => {
  return (
    <div className="dashboard-card flex flex-col mt-6">
      <div className="bg-brand-primary p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-brand-accent p-1.5 rounded text-brand-primary">
            <Building2 size={14} />
          </div>
          <h3 className="text-[11px] font-black text-white tracking-widest uppercase">REKAPITULASI KINERJA PER ULP</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-brand-accent uppercase">SUMMARY</span>
          <TrendingUp size={12} className="text-brand-accent" />
        </div>
      </div>

      <div className="overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
            <tr className="border-b border-gray-100">
              <th className="p-2 text-[8px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">UNIT LAYANAN (ULP)</th>
              <th className="p-2 text-[8px] font-black text-gray-400 tracking-widest uppercase text-center">WO TOTAL</th>
              <th className="p-2 text-[8px] font-black text-brand-primary tracking-widest uppercase text-center">WO CCTV</th>
              <th className="p-2 text-[8px] font-black text-red-500 tracking-widest uppercase text-center">%</th>
              <th className="p-2 text-[8px] font-black text-gray-400 tracking-widest uppercase text-center">PO TOTAL</th>
              <th className="p-2 text-[8px] font-black text-brand-secondary tracking-widest uppercase text-center">PO CCTV</th>
              <th className="p-2 text-[8px] font-black text-red-500 tracking-widest uppercase text-center">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i} className="table-row h-[40px]">
                <td className="p-2 font-black text-brand-primary uppercase text-[10px] whitespace-nowrap">{item.ulp}</td>
                <td className="p-2 text-center font-bold text-gray-600 text-[10px]">{item.jumlahWoTotal}</td>
                <td className="p-2 text-center font-bold text-brand-primary text-[10px]">{item.totalWoPakaiCctv}</td>
                <td className="p-2 text-center font-bold text-red-600 italic text-[10px]">{item.persenWo}</td>
                <td className="p-2 text-center font-bold text-gray-600 text-[10px]">{item.jumlahPoTotal}</td>
                <td className="p-2 text-center font-bold text-brand-secondary text-[10px]">{item.totalPoPakaiCctv}</td>
                <td className="p-2 text-center font-bold text-red-600 italic text-[10px]">{item.persenPo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
