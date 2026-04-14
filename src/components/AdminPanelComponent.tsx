import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { GoogleSheetsService } from '../services/googleSheetsService.ts';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'SETTINGS'>('UPLOAD');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Adminbkt') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Password Salah!');
    }
  };

  const downloadTemplate = (type: 'WO' | 'PO') => {
    let headers: string[] = [];
    
    if (type === 'WO') {
      // Based on indices: J(9)=Regu, K(10)=Petugas, N(13)=NoLaporan, R(17)=Tanggal, AQ(42)=CCTV
      headers = new Array(43).fill("");
      headers[9] = "NAMA REGU";
      headers[10] = "NAMA PETUGAS";
      headers[13] = "NO LAPORAN";
      headers[17] = "TANGGAL";
      headers[42] = "CCTV";
      // Fill some other common ones for context
      headers[0] = "NO";
      headers[2] = "IDPEL";
      headers[3] = "NAMA PELANGGAN";
    } else {
      // Based on indices: E(4)=NoTugas, I(8)=Regu, K(10)=Petugas, O(14)=Tanggal, Y(24)=CCTV
      headers = new Array(25).fill("");
      headers[4] = "NO TUGAS";
      headers[8] = "NAMA REGU";
      headers[10] = "NAMA PETUGAS";
      headers[14] = "TANGGAL";
      headers[24] = "CCTV";
      // Fill some other common ones
      headers[0] = "NO";
      headers[1] = "IDPEL";
    }
    
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Sheet1`);
    XLSX.writeFile(wb, `Template_${type}_PLN.xlsx`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'WO' | 'PO') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);

    try {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Get raw data as array of arrays to preserve column structure
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        console.log(`Uploaded ${type} data:`, data);
        
        if (data.length <= 1) {
          setUploading(false);
          setUploadStatus({
            type: 'error',
            message: 'File kosong atau hanya berisi header.'
          });
          return;
        }

        // Call the service to update the spreadsheet
        GoogleSheetsService.updateSheetData(type, data).then(success => {
          setUploading(false);
          if (success) {
            setUploadStatus({
              type: 'success',
              message: `Berhasil mengunggah ${data.length - 1} baris data ${type} ke Spreadsheet.`
            });
          } else {
            setUploadStatus({
              type: 'error',
              message: 'Gagal mengirim data. Pastikan VITE_APPS_SCRIPT_URL sudah diisi dengan benar di menu Settings (tanpa tanda kutip).'
            });
          }
        }).catch(err => {
          setUploading(false);
          setUploadStatus({
            type: 'error',
            message: `Terjadi kesalahan: ${err.message || 'Gagal menghubungi server'}`
          });
        });
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setUploading(false);
      setUploadStatus({
        type: 'error',
        message: 'Gagal memproses file. Pastikan format file benar (.xlsx)'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-blue-600 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {!isAuthenticated ? (
            <div className="p-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-brand-accent/10 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck size={40} className="text-brand-accent" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-widest uppercase mb-2">ADMIN ACCESS</h2>
              <p className="text-white/40 text-xs font-bold tracking-widest uppercase mb-8">MASUKKAN KATA SANDI UNTUK MELANJUTKAN</p>
              
              <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="KATA SANDI"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white text-sm font-bold tracking-widest focus:outline-none focus:border-brand-accent transition-colors"
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-2">
                    <AlertCircle size={14} /> {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full bg-white text-blue-600 py-4 rounded-xl font-black tracking-widest uppercase hover:bg-blue-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  VERIFIKASI
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col h-[600px]">
              {/* Header */}
              <div className="bg-white/5 p-6 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-lg">
                    <ShieldCheck size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white tracking-widest uppercase">ADMIN PANEL</h2>
                    <p className="text-[10px] text-blue-200 font-bold tracking-widest uppercase">PLN ES BUKITTINGGI</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('UPLOAD')}
                  className={`flex-1 py-4 text-[11px] font-black tracking-widest uppercase transition-all ${activeTab === 'UPLOAD' ? 'text-white border-b-2 border-white bg-white/10' : 'text-white/60 hover:text-white'}`}
                >
                  UPLOAD DATA
                </button>
                <button
                  onClick={() => setActiveTab('SETTINGS')}
                  className={`flex-1 py-4 text-[11px] font-black tracking-widest uppercase transition-all ${activeTab === 'SETTINGS' ? 'text-white border-b-2 border-white bg-white/10' : 'text-white/60 hover:text-white'}`}
                >
                  PENGATURAN
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8">
                {activeTab === 'UPLOAD' ? (
                  <div className="space-y-8">
                    {/* Status Message */}
                    {uploadStatus && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl flex items-center gap-4 ${uploadStatus.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-500' : 'bg-red-500/10 border border-red-500/30 text-red-500'}`}
                      >
                        {uploadStatus.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                        <p className="text-[11px] font-bold tracking-widest uppercase">{uploadStatus.message}</p>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* WO Upload */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-500">
                              <FileSpreadsheet size={20} />
                            </div>
                            <h3 className="text-xs font-black text-white tracking-widest uppercase">DATA WO</h3>
                          </div>
                          <button
                            onClick={() => downloadTemplate('WO')}
                            className="text-[9px] font-black text-blue-200 hover:underline tracking-widest uppercase flex items-center gap-1"
                          >
                            <Download size={12} /> TEMPLATE
                          </button>
                        </div>
                        
                        <label className="relative group cursor-pointer">
                          <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={(e) => handleFileUpload(e, 'WO')}
                            disabled={uploading}
                            className="hidden"
                          />
                          <div className="border-2 border-dashed border-white/10 group-hover:border-brand-accent/50 rounded-xl p-8 flex flex-col items-center gap-3 transition-all bg-white/[0.02]">
                            {uploading ? (
                              <Loader2 size={32} className="text-white animate-spin" />
                            ) : (
                              <Upload size={32} className="text-white/20 group-hover:text-white transition-colors" />
                            )}
                            <p className="text-[10px] font-black text-white/40 group-hover:text-white tracking-widest uppercase text-center">
                              {uploading ? 'SEDANG MENGUNGGAH...' : 'KLIK UNTUK UNGGAH FILE WO'}
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* PO Upload */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-purple-500/20 p-2 rounded-lg text-purple-500">
                              <FileSpreadsheet size={20} />
                            </div>
                            <h3 className="text-xs font-black text-white tracking-widest uppercase">DATA PO</h3>
                          </div>
                          <button
                            onClick={() => downloadTemplate('PO')}
                            className="text-[9px] font-black text-blue-200 hover:underline tracking-widest uppercase flex items-center gap-1"
                          >
                            <Download size={12} /> TEMPLATE
                          </button>
                        </div>
                        
                        <label className="relative group cursor-pointer">
                          <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={(e) => handleFileUpload(e, 'PO')}
                            disabled={uploading}
                            className="hidden"
                          />
                          <div className="border-2 border-dashed border-white/10 group-hover:border-brand-accent/50 rounded-xl p-8 flex flex-col items-center gap-3 transition-all bg-white/[0.02]">
                            {uploading ? (
                              <Loader2 size={32} className="text-white animate-spin" />
                            ) : (
                              <Upload size={32} className="text-white/20 group-hover:text-white transition-colors" />
                            )}
                            <p className="text-[10px] font-black text-white/40 group-hover:text-white tracking-widest uppercase text-center">
                              {uploading ? 'SEDANG MENGUNGGAH...' : 'KLIK UNTUK UNGGAH FILE PO'}
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-white/20">
                      <Lock size={32} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white tracking-widest uppercase">PENGATURAN SISTEM</h3>
                      <p className="text-[10px] text-white/40 font-bold tracking-widest uppercase mt-2">FITUR INI SEDANG DALAM PENGEMBANGAN</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 bg-white/5 border-t border-white/10 flex justify-between items-center">
                <p className="text-[9px] font-bold text-white/20 tracking-widest uppercase">
                  LOGGED IN AS: SUPERADMIN
                </p>
                <button
                  onClick={() => setIsAuthenticated(false)}
                  className="text-[9px] font-black text-red-500 hover:text-red-400 tracking-widest uppercase transition-colors"
                >
                  LOGOUT
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
