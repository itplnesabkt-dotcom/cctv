import React from 'react';
import { UnitRecap } from '../types';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { formatNumber } from '../lib/utils';

interface RecapTableProps {
  data: UnitRecap[];
}

export const RecapTable: React.FC<RecapTableProps> = ({ data }) => {
  return (
    <div className="dashboard-card h-full flex flex-col">
      <div className="bg-brand-primary p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-brand-secondary p-1.5 rounded text-white">
            <ClipboardList size={14} />
          </div>
          <h3 className="text-[11px] font-black text-white tracking-widest uppercase">REKAPITULASI UNIT</h3>
        </div>
        <span className="text-[9px] font-bold text-brand-accent">{data.length} UNIT</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="p-3 text-[9px] font-black text-gray-400 tracking-widest uppercase">KANTOR UNIT</th>
              <th className="p-3 text-[9px] font-black text-gray-400 tracking-widest uppercase text-center">TOTAL</th>
              <th className="p-3 text-[9px] font-black text-green-500 tracking-widest uppercase text-center">VAL</th>
              <th className="p-3 text-[9px] font-black text-red-500 tracking-widest uppercase text-center">INV</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i} className="table-row">
                <td className="p-3 font-black text-brand-primary uppercase">{item.unit}</td>
                <td className="p-3 text-center font-bold text-gray-600">{item.total}</td>
                <td className="p-3 text-center font-bold text-green-600">{item.valid}</td>
                <td className="p-3 text-center font-bold text-red-600">{item.invalid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-[#0a1128] p-3 flex items-center justify-between">
        <span className="text-[10px] font-black text-white tracking-widest uppercase">TOTAL AGREGAT</span>
        <div className="flex gap-4">
          <span className="text-[10px] font-black text-brand-secondary">{formatNumber(data.reduce((a, b) => a + (Number(b.total) || 0), 0))}</span>
          <span className="text-[10px] font-black text-green-400">{formatNumber(data.reduce((a, b) => a + (Number(b.valid) || 0), 0))}</span>
          <span className="text-[10px] font-black text-red-400">{formatNumber(data.reduce((a, b) => a + (Number(b.invalid) || 0), 0))}</span>
        </div>
      </div>
    </div>
  );
};
