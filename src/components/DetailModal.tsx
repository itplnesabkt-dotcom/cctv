import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Download } from 'lucide-react';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  headers: string[];
  rows: any[][];
}

export function DetailModal({ isOpen, onClose, title, headers, rows }: DetailModalProps) {
  if (!isOpen) return null;

  const handleExportCSV = () => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-7xl h-full max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-[#0a1128] text-white p-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-accent rounded-lg flex items-center justify-center">
                <FileText size={20} className="text-[#0a1128]" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-widest uppercase">{title}</h3>
                <p className="text-[10px] font-bold text-brand-accent/60 tracking-widest uppercase">DETAIL DATA DARI GOOGLE SHEETS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all"
              >
                <Download size={14} />
                EXPORT CSV
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center hover:bg-red-500 transition-colors rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto p-4 bg-gray-50 custom-scrollbar">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-auto max-h-full">
              <table className="w-full text-left border-collapse min-w-max">
                <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm">
                  <tr className="border-b border-gray-200">
                    {headers.map((header, i) => (
                      <th key={i} className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap border-r border-gray-200 last:border-0">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-3 text-[11px] font-medium text-gray-700 whitespace-nowrap border-r border-gray-100 last:border-0">
                            {String(cell || '')}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={headers.length} className="px-4 py-10 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                        Tidak ada data yang ditemukan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 p-3 border-t border-gray-200 flex justify-between items-center">
            <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              TOTAL: {rows.length} BARIS DATA
            </p>
            <p className="text-[10px] font-black text-gray-300 tracking-[0.3em] uppercase">
              PT PLN (PERSERO) • UP3 BUKITTINGGI
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
