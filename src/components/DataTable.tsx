import React from 'react';
import { MainTableEntry } from '../types';
import { Database, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { safeToFixed } from '../lib/utils';

interface DataTableProps {
  data: MainTableEntry[];
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
  return (
    <div className="dashboard-card flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="bg-teal-600 p-2 rounded-lg text-brand-accent">
            <Database size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-brand-primary tracking-tight uppercase">PENJELAJAH BASIS DATA</h3>
            <p className="text-[9px] font-bold text-brand-accent tracking-[0.2em] uppercase">STREAM OPERASIONAL REAL-TIME</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 gap-2">
            <PaginationButton icon={<ChevronsLeft size={16} />} disabled />
            <PaginationButton icon={<ChevronLeft size={16} />} disabled />
            <div className="flex items-center gap-2 px-4 border-x border-gray-200">
              <span className="text-[10px] font-black text-gray-400 uppercase">HAL</span>
              <input type="text" value="1" className="w-8 text-center text-xs font-black text-brand-primary bg-white border border-gray-200 rounded p-1" readOnly />
              <span className="text-[10px] font-black text-gray-400 uppercase">DARI 125</span>
            </div>
            <PaginationButton icon={<ChevronRight size={16} />} />
            <PaginationButton icon={<ChevronsRight size={16} />} />
          </div>

          <button className="bg-teal-600 text-white px-4 py-2 rounded-xl font-black text-[10px] tracking-widest flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Filter size={14} />
            FILTER VALIDASI
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-teal-600 text-white">
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">UNIT</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">IDPEL</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">NAMA</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">PETUGAS</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">VALIDASI</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">KETERANGAN</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">TEGANGAN</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">ARUS</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">COSPHI</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">TARIF</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">DAYA</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">KWH</th>
              <th className="p-4 text-[9px] font-black tracking-widest uppercase">KWH KUM.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i} className="table-row border-b border-gray-100">
                <td className="p-4 font-black uppercase text-gray-400">{item.unit}</td>
                <td className="p-4 font-black text-brand-primary">{item.idpel}</td>
                <td className="p-4 font-black text-brand-primary uppercase">{item.name}</td>
                <td className="p-4 font-black text-gray-500 uppercase">{item.petugas}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${item.valid ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {item.valid ? 'VALID' : 'INVALID'}
                  </span>
                </td>
                <td className="p-4 text-gray-400 font-bold uppercase">{item.keterangan}</td>
                <td className="p-4 font-bold text-brand-primary">{safeToFixed(item.tegangan, 1)}V</td>
                <td className="p-4 font-bold text-brand-primary">{safeToFixed(item.arus, 2)}A</td>
                <td className="p-4 font-bold text-brand-primary">{safeToFixed(item.cosphi, 2)}</td>
                <td className="p-4 font-bold text-gray-500">{item.tarif}</td>
                <td className="p-4 font-bold text-brand-primary">{item.daya}VA</td>
                <td className="p-4 font-bold text-brand-primary">{safeToFixed(item.kwh, 2)}</td>
                <td className="p-4 font-bold text-brand-primary">{safeToFixed(item.kwhKumulatif, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PaginationButton: React.FC<{ icon: React.ReactNode; disabled?: boolean }> = ({ icon, disabled }) => (
  <button className={`p-1.5 rounded-lg transition-colors ${disabled ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-100 hover:text-brand-primary'}`}>
    {icon}
  </button>
);
