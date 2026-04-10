import React from 'react';
import { CCTVUsage } from '../types';

interface CCTVUsageTableProps {
  data: CCTVUsage[];
}

export const CCTVUsageTable: React.FC<CCTVUsageTableProps> = ({ data }) => {
  return (
    <div className="dashboard-card h-full flex flex-col bg-white">
      <div className="overflow-auto">
        <table className="w-full text-center border-collapse border border-gray-300">
          <thead>
            <tr className="bg-[#002060] text-white text-[11px] font-bold">
              <th rowSpan={2} className="border border-white p-2 w-12">NO</th>
              <th rowSpan={2} className="border border-white p-2 min-w-[200px]">NAMA PETUGAS</th>
              <th rowSpan={2} className="border border-white p-2 bg-[#bf8f00] w-24">ULP</th>
              <th colSpan={7} className="border border-white p-2">PEMAKAIAN CCTV</th>
            </tr>
            <tr className="bg-[#0070c0] text-white text-[10px] font-bold">
              <th className="border border-white p-2 w-24">JUMLAH WO TOTAL</th>
              <th className="border border-white p-2 w-24">TOTAL WO PAKAI CCTV</th>
              <th className="border border-white p-2 w-20">% WO</th>
              <th className="border border-white p-2 w-24">JUMLAH PO TOTAL</th>
              <th className="border border-white p-2 w-24">TOTAL PO PAKAI CCTV</th>
              <th className="border border-white p-2 w-20">% PO</th>
              <th className="border border-white p-2 bg-[#00b050] min-w-[100px]">% PENGUNAAN CCVT</th>
            </tr>
          </thead>
          <tbody className="text-[12px] font-bold text-black">
            {data.map((item, index) => (
              <tr key={index} className="border-b border-gray-300">
                <td className="border border-gray-300 p-2">{item.no}</td>
                <td className="border border-gray-300 p-2 text-left px-4">{item.namaPetugas}</td>
                <td className="border border-gray-300 p-2">{item.ulp}</td>
                <td className="border border-gray-300 p-2">{item.jumlahWoTotal}</td>
                <td className="border border-gray-300 p-2">{item.totalWoPakaiCctv}</td>
                <td className="border border-gray-300 p-2 text-red-600 italic">{item.persenWo}</td>
                <td className="border border-gray-300 p-2">{item.jumlahPoTotal}</td>
                <td className="border border-gray-300 p-2">{item.totalPoPakaiCctv}</td>
                <td className="border border-gray-300 p-2 text-red-600 italic">{item.persenPo}</td>
                <td className="border border-gray-300 p-2 text-red-600 italic">{item.persenPenggunaanCctv}</td>
              </tr>
            ))}
            {/* Empty rows to fill space if needed */}
            {Array.from({ length: Math.max(0, 10 - data.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-10 border-b border-gray-300 bg-[#002060]/5">
                <td colSpan={10} className="border border-gray-300"></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#002060] h-10">
              <td colSpan={10} className="border border-white"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
