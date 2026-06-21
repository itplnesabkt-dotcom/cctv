import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  Camera, 
  Upload, 
  Trash2, 
  Settings2, 
  CheckCircle2, 
  ExternalLink, 
  AlertTriangle, 
  Search, 
  Building2, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  RefreshCw,
  LogOut,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPageProps {
  anomaliList: any[][]; // Table row structure: [No Laporan, Tgl Laporan, Nama Petugas, ULP, Jenis Anomali, Deskripsi, RPT, RCT]
}

export interface EvidenUpload {
  fotoEviden1?: string;
  fotoEviden2?: string;
  uploadedAt1?: string;
  uploadedAt2?: string;
  fileName1?: string;
  fileName2?: string;
}

export type EvidenMap = { [noTugas: string]: EvidenUpload };

export const AdminPage: React.FC<AdminPageProps> = ({ anomaliList = [] }) => {
  // Authentication states
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // GAS Web App configuration
  const [gasUrl, setGasUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Connection diagnostics states
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

  // Eviden data state (loaded from localStorage)
  const [evidenMap, setEvidenMap] = useState<EvidenMap>({});

  // Table search and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Active uploading states
  const [uploadingState, setUploadingState] = useState<{ [key: string]: boolean }>({});
  const [uploadMessage, setUploadMessage] = useState<{ [key: string]: { type: 'success' | 'error', text: string } }>({});

  const folderUrl = "https://drive.google.com/drive/folders/1NvIw5QLalD-eK1u7Hv6vhW5PS0JWjwK2?usp=sharing";

  // Load auth state on init (using sessionStorage so it expires on tab close)
  useEffect(() => {
    const sessionAuth = sessionStorage.getItem('admin_authenticated');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    }

    // Load GAS Web App URL from localStorage
    const savedGasUrl = localStorage.getItem('gas_web_app_url');
    if (savedGasUrl) {
      setGasUrl(savedGasUrl);
    }

    // Load Eviden mappings
    const savedEviden = localStorage.getItem('anomali_evidens');
    if (savedEviden) {
      try {
        setEvidenMap(JSON.parse(savedEviden));
      } catch (e) {
        console.error("Gagal membaca anomali_evidens dari localStorage", e);
      }
    }
  }, []);

  // Save eviden map helper
  const saveEvidenMap = (newMap: EvidenMap) => {
    setEvidenMap(newMap);
    localStorage.setItem('anomali_evidens', JSON.stringify(newMap));
    
    // Dispatch custom event to notify AnomaliPage
    window.dispatchEvent(new Event('anomali_evidens_updated'));
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'ADMIND') {
      setIsAuthenticated(true);
      setAuthError('');
      sessionStorage.setItem('admin_authenticated', 'true');
    } else {
      setAuthError('Password salah! Coba lagi.');
      setPassword('');
      // Autoclear error after 3s
      setTimeout(() => setAuthError(''), 3000);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_authenticated');
    setPassword('');
  };

  // Save GAS config
  const handleSaveGasConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gas_web_app_url', gasUrl);
    setShowSettings(false);
  };

  // Reset GAS config
  const handleResetGasConfig = () => {
    setGasUrl('');
    setTestResult(null);
    localStorage.removeItem('gas_web_app_url');
  };

  // Test connection to Google Apps Script URL
  const handleTestConnection = async () => {
    if (!gasUrl) {
      setTestResult({ type: 'error', text: 'Masukkan Web App URL terlebih dahulu!' });
      return;
    }
    
    setTestingConnection(true);
    setTestResult(null);
    
    try {
      const urlLower = gasUrl.toLowerCase().trim();
      if (urlLower.includes('drive.google.com')) {
        throw new Error('URL yang dimasukkan adalah link Google Drive Folder, bukan URL Web App Google Apps Script hasil deploy.');
      }
      if (urlLower.includes('/edit') && !urlLower.includes('/exec')) {
        throw new Error('URL yang dimasukkan adalah link Google Apps Script Editor. Anda harus melakukan Deploy -> New Deployment sebagai Web App dan menyalin URL hasil deploy yang berakhiran "/exec".');
      }
      if (!urlLower.startsWith('https://script.google.com/')) {
        throw new Error('URL Web App tidak valid. Harus diawali dengan "https://script.google.com/macros/s/.../exec".');
      }

      // We send a ping packet in plain text format to avoid CORS preflight options block
      const response = await fetch(gasUrl.trim(), {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ action: 'ping' })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} (${response.statusText})`);
      }

      const resData = await response.json();
      
      if (resData.success) {
        setTestResult({
          type: 'success',
          text: resData.message || 'KONEKSI SUKSES! Web App Anda berhasil terhubung dengan Google Drive dan siap digunakan.'
        });
      } else if (resData.error && (resData.error.includes('DriveApp') || resData.error.includes('permission') || resData.error.includes('createFile') || resData.error.includes('tidak memiliki izin'))) {
        setTestResult({
          type: 'warning',
          text: `TERHUBUNG DENGAN CATATAN: Web App terkoneksi, tetapi Google Drive belum diotorisasi. Error: ${resData.error}. Solusi: Buka editor Apps Script Anda, pilih fungsi "otorisasiIzinDrive" di dropdown atas lalu klik Run/Jalankan.`
        });
      } else if (resData.error && resData.error.includes('substring')) {
        // Old deployed script version without action handling, but CORS and route are working!
        setTestResult({
          type: 'success',
          text: 'KONEKSI SUKSES UNTUK VERSI SEBELUMNYA! Web App Anda menyambung dengan baik. (Disarankan salin CODETEMPLATE.gs terbaru di panel sebelah kanan untuk mendapatkan pembaruan fungsi ping jika ingin fitur PING yang diperbarui).'
        });
      } else {
        setTestResult({
          type: 'error',
          text: resData.error || 'Server Apps Script mengembalikan error tidak dikenal.'
        });
      }
    } catch (err: any) {
      console.error("Test connection failure:", err);
      let errorMsg = err.message || 'Koneksi gagal!';
      
      if (err.message === 'Failed to fetch') {
        errorMsg = 'Kors / Jaringan diblokir (Failed to fetch). Pastikan saat Anda melakukan Klik "Deploy -> New Deployment" di Google Apps Script, setel kolom "Who has access" (Siapa yang memiliki akses) menjadi "Anyone" (Siapa Saja) serta status deployment dalam kondisi Aktif.';
      }
      
      setTestResult({
        type: 'error',
        text: 'KONEKSI GAGAL: ' + errorMsg
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Google Apps Script template for the user to copy-paste
  const gasTemplateCode = `function doPost(e) {
  var origin = "*";
  var headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  
  // Jika dijalankan manual di editor Apps Script (tanpa parameter event)
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("PENTING: Jangan klik tombol 'Run' / 'Debug' langsung di dalam editor Google Apps Script! Fungsi doPost(e) memerlukan parameter event HTTP POST yang dikirim oleh web. Silakan lakukan 'Deploy > New deployment' sebagai Web App, lalu salin URL yang berakhiran '/exec' ke Halaman Admin web.")
      .setMimeType(ContentService.MimeType.TEXT);
  }
  
  if (e.parameter.OPTIONS) {
    return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT).setHeaders(headers);
  }
  
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Fitur cek koneksi (ping)
    if (data && data.action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "KONEKSI SUKSES! Google Apps Script milik Anda siap menerima file."
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
    }
    
    var base64Data = data.base64;
    var fileName = data.fileName;
    // Folder ID target yang ditentukan user
    var folderId = "1NvIw5QLalD-eK1u7Hv6vhW5PS0JWjwK2";
    
    var contentType = base64Data.substring(5, base64Data.indexOf(';'));
    var byteCharacters = Utilities.base64Decode(base64Data.split(',')[1]);
    var blob = Utilities.newBlob(byteCharacters, contentType, fileName);
    
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    // Ubah izin agar siapa saja yang memiliki link bisa melihat file
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    // Gunakan URL thumbnail display langsung google drive
    var resultUrl = "https://lh3.googleusercontent.com/d/" + fileId;
    
    var response = {
      success: true,
      url: resultUrl,
      fileUrl: file.getUrl()
    };
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
  }
}

// ==========================================
// PENTING: CARA MENGATASI ERROR "IZIN DRIVE" (DriveApp.Folder.createFile)
// ==========================================
// Jika Anda mendapatkan Error "Anda tidak memiliki izin untuk memanggil DriveApp...":
// 1. Pada bagian atas editor Apps Script, ganti pilihan fungsi dari 'doPost' menjadi 'otorisasiIzinDrive'.
// 2. Klik tombol 'Run' (Jalankan) atau segitiga play di sebelahnya.
// 3. Jendela persetujuan dari Google akan muncul. Klik 'Review Permissions' (Tinjau Izin).
// 4. Pilih akun Google Anda.
// 5. Akan muncul tulisan 'Google hasn't verified this app'. Klik tulisan 'Advanced' (Lanjutan) kecil di kiri bawah.
// 6. Klik 'Go to Untitled project (unsafe)' atau 'Buka [Nama Project] (tidak aman)'.
// 7. Klik 'Allow' (Izinkan).
// 8. Otorisasi selesai! Silakan LAKUKAN DEPLOY ULANG (New Deployment) agar versi Web App diperbarui.
function otorisasiIzinDrive() {
  Logger.log("Memulai otorisasi izin Drive...");
  DriveApp.getRootFolder();
  Logger.log("SUKSES! Google Drive berhasil diotorisasi. Sekarang silakan lakukan New Deployment.");
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gasTemplateCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // File upload processing
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, noTugas: string, evidenIdx: 1 | 2) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadMessage(prev => ({
        ...prev,
        [`${noTugas}_${evidenIdx}`]: { type: 'error', text: 'Ukuran file terlalu besar! Maksimal 5MB.' }
      }));
      return;
    }

    const stateKey = `${noTugas}_${evidenIdx}`;
    setUploadingState(prev => ({ ...prev, [stateKey]: true }));
    setUploadMessage(prev => {
      const copy = { ...prev };
      delete copy[stateKey];
      return copy;
    });

    try {
      // Validate GAS URL if present
      if (gasUrl) {
        const urlLower = gasUrl.toLowerCase().trim();
        if (urlLower.includes('drive.google.com')) {
          throw new Error('URL yang dimasukkan adalah link Google Drive Folder, bukan URL Web App Google Apps Script hasil deploy. Silakan periksa kembali langkah-langkah setup.');
        }
        if (urlLower.includes('/edit') && !urlLower.includes('/exec')) {
          throw new Error('URL yang dimasukkan adalah link Google Apps Script Editor. Anda harus melakukan Deploy -> New Deployment sebagai Web App dan menyalin URL hasil deploy yang berakhiran "/exec".');
        }
        if (!urlLower.startsWith('https://script.google.com/')) {
          throw new Error('URL Web App Google Apps Script tidak valid. URL resmi harus diawali dengan "https://script.google.com/macros/s/.../exec".');
        }
      }

      // Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const fileName = `EVIDEN_${evidenIdx}_${noTugas}_${Date.now()}.${file.name.split('.').pop()}`;

      let imageUrl = '';

      if (gasUrl) {
        // ACTUAL Google Apps Script API upload
        // We use text/plain content type to make it a CORS simple request, bypassing complex preflight/redirect CORS errors!
        const response = await fetch(gasUrl.trim(), {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            base64: base64,
            fileName: fileName
          })
        });

        if (!response.ok) {
          throw new Error(`Server GAS merespon dengan status error: ${response.status} (${response.statusText})`);
        }

        const resData = await response.json();
        if (resData.success) {
          imageUrl = resData.url;
        } else {
          throw new Error(resData.error || "Gagal mengunggah ke Google Drive");
        }
      } else {
        // SIMULATION Mode fallback (stores base64 locally in localStorage)
        try {
          imageUrl = base64;
        } catch (storageErr) {
          imageUrl = evidenIdx === 1 
            ? "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80"
            : "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80";
        }
      }

      // Update local storage mappings
      const existingUpload = evidenMap[noTugas] || {};
      const newUpload: EvidenUpload = {
        ...existingUpload,
        ...(evidenIdx === 1 
          ? { fotoEviden1: imageUrl, uploadedAt1: new Date().toLocaleString('id-ID'), fileName1: file.name }
          : { fotoEviden2: imageUrl, uploadedAt2: new Date().toLocaleString('id-ID'), fileName2: file.name }
        )
      };

      const newMap = {
        ...evidenMap,
        [noTugas]: newUpload
      };

      saveEvidenMap(newMap);

      setUploadMessage(prev => ({
        ...prev,
        [stateKey]: { 
          type: 'success', 
          text: gasUrl ? 'Foto berhasil diunggah ke Google Drive!' : 'Materi berhasil diunggah (Mode Simulasi)!' 
        }
      }));

    } catch (err: any) {
      console.error("Upload error details:", err);
      let errorMsg = err.message || 'Koneksi gagal!';
      
      const isDriveError = err.message && (
        err.message.includes('DriveApp') || 
        err.message.includes('createFile') || 
        err.message.includes('permission') || 
        err.message.includes('tidak memiliki izin') ||
        err.message.includes('Exception')
      );

      if (isDriveError) {
        errorMsg = 'Error Izin Drive: Google Apps Script Anda belum diotorisasi untuk mengakses Google Drive Anda. Solusi: Buka editor Apps Script Anda, ganti pilihan fungsi di toolbar atas dari "doPost" menjadi "otorisasiIzinDrive", lalu klik "Run/Jalankan". Selesaikan popup izin Google (Review Permissions -> Lanjutan -> Go to [Project] -> Allow), lalu DEPLOY ULANG (New Deployment) Web App Anda.';
      } else if (err.message === 'Failed to fetch') {
        errorMsg = 'Upload Gagal (Failed to fetch). Pastikan saat Deploy Google Apps Script, kolom "Who has access" disetel ke "Anyone" (Siapa Saja) serta status Web App adalah aktif. Bila salah disetel, browser akan menolak koneksi karena kendala CORS.';
      }
      
      setUploadMessage(prev => ({
        ...prev,
        [stateKey]: { type: 'error', text: errorMsg }
      }));
    } finally {
      setUploadingState(prev => ({ ...prev, [stateKey]: false }));
    }
  };

  // Delete uploaded photo
  const handleDeletePhoto = (noTugas: string, evidenIdx: 1 | 2) => {
    const existingUpload = evidenMap[noTugas];
    if (!existingUpload) return;

    const newUpload = { ...existingUpload };
    if (evidenIdx === 1) {
      delete newUpload.fotoEviden1;
      delete newUpload.uploadedAt1;
      delete newUpload.fileName1;
    } else {
      delete newUpload.fotoEviden2;
      delete newUpload.uploadedAt2;
      delete newUpload.fileName2;
    }

    const newMap = { ...evidenMap };
    if (Object.keys(newUpload).length === 0) {
      delete newMap[noTugas];
    } else {
      newMap[noTugas] = newUpload;
    }

    saveEvidenMap(newMap);

    const stateKey = `${noTugas}_${evidenIdx}`;
    setUploadMessage(prev => ({
      ...prev,
      [stateKey]: { type: 'success', text: 'Foto berhasil dihapus dari daftar lokal.' }
    }));
  };

  // Submit manual URL link as fallback
  const handleManualUrlSubmit = (noTugas: string, evidenIdx: 1 | 2, urlUrl: string) => {
    if (!urlUrl.trim()) return;

    const existingUpload = evidenMap[noTugas] || {};
    const newUpload: EvidenUpload = {
      ...existingUpload,
      ...(evidenIdx === 1 
        ? { fotoEviden1: urlUrl.trim(), uploadedAt1: new Date().toLocaleString('id-ID'), fileName1: 'Pautan Link Manual' }
        : { fotoEviden2: urlUrl.trim(), uploadedAt2: new Date().toLocaleString('id-ID'), fileName2: 'Pautan Link Manual' }
      )
    };

    const newMap = {
      ...evidenMap,
      [noTugas]: newUpload
    };

    saveEvidenMap(newMap);

    const stateKey = `${noTugas}_${evidenIdx}`;
    setUploadMessage(prev => ({
      ...prev,
      [stateKey]: { type: 'success', text: 'Tautan manual berhasil dipasang!' }
    }));
  };

  // Filter & Search rows
  const filteredRows = useMemo(() => {
    return anomaliList.filter(row => {
      const noTugas = String(row[0] || '').toLowerCase();
      const tgl = String(row[1] || '').toLowerCase();
      const petugas = String(row[2] || '').toLowerCase();
      const ulp = String(row[3] || '').toLowerCase();
      const jenis = String(row[4] || '').toLowerCase();
      const search = searchTerm.toLowerCase().trim();

      return !search ||
        noTugas.includes(search) ||
        tgl.includes(search) ||
        petugas.includes(search) ||
        ulp.includes(search) ||
        jenis.includes(search);
    });
  }, [anomaliList, searchTerm]);

  // Pagination rows
  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950/20 rounded-3xl min-h-[600px]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
          id="admin_login_box"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-blue-700 to-[#102a43] p-8 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <ShieldCheck size={160} />
            </div>
            
            <div className="mx-auto w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-4 shadow-inner">
              <Lock size={28} className="text-[#00e5ff]" />
            </div>
            <h2 className="text-lg font-black tracking-widest uppercase">OTENTIKASI ADMIN</h2>
            <p className="text-[10px] text-cyan-200 font-extrabold uppercase tracking-wide mt-1">DASHBOARD MONITORING YANDAL</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-8 flex flex-col gap-5">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Password Admin</label>
              <div className="relative mt-1.5 flex items-center">
                <Key className="absolute left-3.5 text-slate-400" size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password admin..."
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs font-bold text-slate-800 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 hover:text-blue-500 text-slate-400 font-bold text-[10px] uppercase cursor-pointer"
                >
                  {showPassword ? "Sembunyi" : "Lihat"}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {authError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-50 text-rose-600 border border-rose-100 p-3 rounded-lg flex items-center gap-2"
                >
                  <AlertTriangle size={15} className="shrink-0 animate-bounce" />
                  <span className="text-[10px] font-bold uppercase">{authError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs tracking-widest uppercase shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              LOG IN SEKARANG
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // AUTHENTICATED PANEL
  return (
    <div id="admin_dashboard_root" className="flex flex-col gap-6 p-6 bg-slate-50/50 rounded-2xl min-h-full">
      
      {/* Upper Panel Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-[#102a43] rounded-3xl p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-lg border border-blue-600/30">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <ShieldCheck size={260} />
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
            <ShieldCheck size={26} className="text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight">TINDAK LANJUT ADMIN</h2>
              <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">TEROTENTIKASI</span>
            </div>
            <p className="text-[10px] text-slate-300 font-bold uppercase mt-1">
              Upload foto bukti kegiatan eviden anomali yang disimpan di folder Google Drive
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 self-start md:self-auto">
          {/* Folder URL Link */}
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/25 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all"
            title="Buka Folder Google Drive"
          >
            <ExternalLink size={12} />
            BUKA GOOGLE DRIVE FOLDER
          </a>

          {/* Settings Config Trigger */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap cursor-pointer ${
              showSettings 
                ? "bg-cyan-500 text-slate-900 shadow-md"
                : "bg-white/10 hover:bg-white/20 border border-white/25 text-white"
            }`}
          >
            <Settings2 size={13} />
            {showSettings ? "Tutup API Setup" : "Setup GAS API"}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/25 px-3 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer"
          >
            <LogOut size={13} />
            Keluar
          </button>
        </div>
      </div>

      {/* GAS Setup Panel overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            id="gas_settings_panel"
          >
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-md flex flex-col md:flex-row gap-6">
              
              {/* Form setting */}
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <h3 className="text-xs font-black tracking-wider text-slate-800 uppercase flex items-center gap-1.5 mb-1.5">
                    <Settings2 size={14} className="text-blue-600" />
                    KONFIGURASI GOOGLE APPS SCRIPT (GAS)
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed">
                    Masukkan URL hasil deployment Web App Google Apps Script Anda untuk mengaktifkan sinkronisasi pengunggahan langsung ke folder Google Drive Anda secara real-time.
                  </p>
                </div>

                <form onSubmit={handleSaveGasConfig} className="flex flex-col gap-3">
                  <div>
                    <label className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Web App URL</label>
                    <div className="relative mt-1 flex gap-2">
                      <input
                        type="url"
                        value={gasUrl}
                        onChange={(e) => setGasUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="flex-1 px-4 py-2.5 bg-slate-50 text-[10px] font-bold text-slate-800 rounded-lg border border-slate-200 focus:border-blue-500 outline-none placeholder:text-slate-400"
                        required
                      />
                      {gasUrl && (
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={testingConnection}
                          className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-[9px] tracking-widest uppercase transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-sm shrink-0"
                        >
                          <RefreshCw size={11} className={testingConnection ? "animate-spin" : ""} />
                          {testingConnection ? "MENGUJI..." : "TES KONEKSI"}
                        </button>
                      )}
                    </div>
                    
                    {testResult && (
                      <div id="test_connection_result" className={`mt-2 p-3 rounded-xl text-[9px] font-bold border leading-relaxed flex items-start gap-2 ${
                        testResult.type === 'success' 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                          : testResult.type === 'warning'
                            ? 'bg-amber-50 border-amber-100 text-amber-800'
                            : 'bg-rose-50 border-rose-100 text-rose-800'
                      }`}>
                        <div className="shrink-0 mt-0.5">
                          {testResult.type === 'success' ? (
                            <CheckCircle2 size={13} className="text-emerald-500" />
                          ) : (
                            <AlertTriangle size={13} className={testResult.type === 'warning' ? 'text-amber-500' : 'text-rose-500'} />
                          )}
                        </div>
                        <p className="uppercase leading-normal">{testResult.text}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] tracking-widest uppercase shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      SIMPAN KONFIGURASI
                    </button>
                    {gasUrl && (
                      <button
                        type="button"
                        onClick={handleResetGasConfig}
                        className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-[9px] tracking-widest uppercase border border-rose-200 transition-all cursor-pointer"
                      >
                        RESET API
                      </button>
                    )}
                  </div>
                </form>

                <div className="bg-sky-50 border border-sky-100 text-sky-700 p-4 rounded-xl text-[10px] font-semibold leading-relaxed flex flex-col gap-2.5">
                  <div className="flex gap-2 items-start">
                    <Info size={14} className="shrink-0 mt-0.5 text-sky-600" />
                    <div>
                      <p className="font-extrabold uppercase text-[9px] text-sky-850">MODE LAYANAN TERSEDIA:</p>
                      {gasUrl ? (
                        <p className="mt-1">
                          <strong className="text-blue-750">● LIVE RUNNING:</strong> Terkoneksi ke Google Apps Script. File akan diunggah ke Google Drive Folder dan dapat diakses publik secara global.
                        </p>
                      ) : (
                        <p className="mt-1">
                          <strong className="text-amber-800">● MODE SIMULASI (Default):</strong> GAS Web App belum dipasang. Semua file yang diunggah akan tersimpan di browser lokal Anda (localStorage) untuk keperluan demo tanpa setup external.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-sky-200/50 pt-2.5">
                    <p className="font-black text-[9px] text-slate-800 uppercase mb-1.5 flex items-center gap-1.5">
                      <Sparkles size={11} className="text-amber-500 animate-pulse" />
                      PANDUAN SETUP SUPAYA BEBAS CORS &quot;FAILED TO FETCH&quot;:
                    </p>
                    <ol className="list-decimal list-inside pl-1 flex flex-col gap-1.5 text-[8.5px] text-slate-600 font-medium">
                      <li>Salin script <strong className="text-slate-800">CODETEMPLATE.gs</strong> di panel sebelah kanan.</li>
                      <li>Buka <strong className="text-slate-800">Extensions &gt; Apps Script</strong> dari Google Sheets, atau kunjungi <strong className="text-slate-800">script.google.com</strong>.</li>
                      <li>Tempel kode tersebut. Pastikan ID folder di dalamnya sudah sesuai: <code className="bg-slate-150 px-1 py-0.5 rounded text-rose-700 font-mono text-[7.5px]">1NvIw5QLalD-eK1u7Hv6vhW5PS0JWjwK2</code>.</li>
                      <li>
                        <strong className="text-blue-700 font-extrabold">PENTING (SOLUSI IZIN DRIVE):</strong> Sebelum mengklik Deploy, Anda <strong className="text-rose-700">wajib memberi izin akses Drive sekali</strong>. Klik dropdown fungsi di bagian atas editor yang awalnya tertulis <code className="bg-slate-150 px-1 rounded font-mono text-slate-800">doPost</code>, lalu pilih <code className="bg-emerald-100 text-[#0f5132] font-black font-mono px-1 rounded">otorisasiIzinDrive</code>. Klik tombol <strong className="text-slate-800">Run (Jalankan)</strong>. Kemudian klik <strong className="text-slate-800">Review Permissions</strong>, pilih akun Google Anda, klik <strong className="text-slate-500">Advanced (Lanjutan)</strong> di kiri bawah, klik <strong className="text-slate-500">Go to Untitled project (unsafe)</strong>, lalu klik <strong className="text-slate-800 font-black">Allow (Izinkan)</strong>.
                      </li>
                      <li>Klik ikon <strong className="text-slate-800">Save</strong>, lalu klik <strong className="text-slate-800">Deploy &gt; New Deployment</strong>.</li>
                      <li>Pilih jenis <strong className="text-slate-800">Web App</strong> (klik ikon roda gigi jika belum terpilih).</li>
                      <li>Setel <code className="bg-slate-150 text-blue-800 font-extrabold px-1 rounded">Execute as: Me (akun Anda)</code>.</li>
                      <li>Setel <code className="bg-rose-100 text-rose-800 font-extrabold px-1.5 rounded">Who has access: Anyone (Siapa saja)</code>. <span className="text-rose-600 font-bold">(PENTING: Wajib disetel ke &apos;Anyone&apos; agar tidak kena kendala otentikasi login / Failed to fetch!)</span></li>
                      <li>Klik <strong className="text-slate-800">Deploy</strong>. Bila jendela persetujuan Google muncul kembali, klik izinkan/Allow seperti langkah ke-4.</li>
                      <li>Salin <strong className="text-blue-700">URL Web App</strong> yang berakhiran <strong className="text-blue-700">/exec</strong>, lalu tempel ke form di atas dan klik Simpan.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Code Script Copier */}
              <div className="flex-1 bg-slate-900 text-slate-100 rounded-2xl p-4 flex flex-col justify-between max-h-[300px] overflow-hidden border border-slate-800 relative group">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800 shrink-0">
                  <span className="text-[8px] font-black text-[#00e5ff] uppercase tracking-wider font-mono">CODETEMPLATE.gs</span>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer"
                  >
                    {copiedScript ? <Check size={10} className="text-green-400 stroke-[3]" /> : <Copy size={10} />}
                    {copiedScript ? "Tersalin!" : "Salin Kode"}
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 font-mono text-[7.5px] leading-relaxed select-text custom-scrollbar text-slate-350 pr-2">
                  <pre>{gasTemplateCode}</pre>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden flex flex-col gap-4">
        
        {/* Table Header Filter */}
        <div className="px-5 py-4 bg-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black tracking-widest text-[#00e5ff] uppercase flex items-center gap-1.5">
              <ShieldCheck size={14} />
              TABEL MATRIX TINDAK LANJUT EVIDEN
            </h3>
            <p className="text-[9px] text-slate-300 font-bold uppercase mt-0.5 opacity-80">
              Total Temuan Kasus Terbaca: {filteredRows.length} Anomali
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-56 flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
              <Search size={11} className="text-white/75" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari No Tugas/Petugas/ULP..."
                className="bg-transparent text-white placeholder-white/50 text-[10px] font-bold outline-none w-full"
              />
            </div>
          </div>
        </div>

        {/* Real Table */}
        <div className="p-5 flex flex-col gap-4">
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-[11px] font-semibold text-slate-800 min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black text-[8.5px] tracking-wider">
                  <th scope="col" className="px-4 py-3 text-center w-12">No</th>
                  <th scope="col" className="px-4 py-3 w-36">No Tugas</th>
                  <th scope="col" className="px-4 py-3 w-36">ULP</th>
                  <th scope="col" className="px-4 py-3 w-40">Petugas</th>
                  <th scope="col" className="px-4 py-3">Jenis Kerawanan (Anomali)</th>
                  <th scope="col" className="px-4 py-3 text-center w-56">Foto Eviden 1</th>
                  <th scope="col" className="px-4 py-3 text-center w-56">Foto Eviden 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 bg-white">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((row, idx) => {
                    const runningNo = (currentPage - 1) * itemsPerPage + idx + 1;
                    const noTugas = row[0] || "-";
                    const tgl = row[1] || "-";
                    const petugas = row[2] || "-";
                    const ulp = row[3] || "-";
                    const jenis = row[4] || "-";
                    const desc = row[5] || "-";

                    const eviden = evidenMap[noTugas] || {};

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        {/* No */}
                        <td className="px-4 py-3 text-center text-slate-400 tabular-nums font-extrabold">{runningNo}</td>

                        {/* No Tugas */}
                        <td className="px-4 py-3 font-mono font-black text-slate-700">
                          <span className="bg-slate-100 text-slate-800 border border-slate-200 px-1.5 py-1 rounded text-[10px]">
                            {noTugas}
                          </span>
                        </td>

                        {/* ULP */}
                        <td className="px-4 py-3 font-black text-[#1b3d5d] truncate uppercase max-w-[140px]" title={ulp}>
                          {ulp}
                        </td>

                        {/* Petugas */}
                        <td className="px-4 py-3 font-bold text-slate-600 truncate uppercase max-w-[150px]" title={petugas}>
                          {petugas}
                        </td>

                        {/* Anomali list */}
                        <td className="px-4 py-3 max-w-[250px]">
                          <div className="flex flex-wrap gap-1 max-h-[40px] overflow-y-auto custom-scrollbar">
                            {jenis.split(",").map((v: string, vIdx: number) => (
                              <span key={vIdx} className="px-1.5 py-0.5 text-[7px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-100 rounded">
                                {v.trim()}
                              </span>
                            ))}
                          </div>
                          {desc && desc !== "-" && (
                            <p className="text-[7.5px] font-bold text-slate-400 mt-1 truncate" title={desc}>{desc}</p>
                          )}
                        </td>

                        {/* EVIDEN 1 column */}
                        <td className="px-4 py-3 border-l border-slate-100 bg-slate-50/20">
                          <EvidenUploadCell 
                            noTugas={noTugas}
                            evidenIdx={1}
                            evidenData={eviden}
                            isUploading={uploadingState[`${noTugas}_1`] || false}
                            msg={uploadMessage[`${noTugas}_1`]}
                            onUploadChange={(e) => handleFileUpload(e, noTugas, 1)}
                            onDelete={() => handleDeletePhoto(noTugas, 1)}
                            onManualSubmit={(url) => handleManualUrlSubmit(noTugas, 1, url)}
                          />
                        </td>

                        {/* EVIDEN 2 column */}
                        <td className="px-4 py-3 border-l border-slate-100 bg-slate-100/5">
                          <EvidenUploadCell 
                            noTugas={noTugas}
                            evidenIdx={2}
                            evidenData={eviden}
                            isUploading={uploadingState[`${noTugas}_2`] || false}
                            msg={uploadMessage[`${noTugas}_2`]}
                            onUploadChange={(e) => handleFileUpload(e, noTugas, 2)}
                            onDelete={() => handleDeletePhoto(noTugas, 2)}
                            onManualSubmit={(url) => handleManualUrlSubmit(noTugas, 2, url)}
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-extrabold uppercase tracking-widest bg-slate-50/50">
                      Tidak ada data yang cocok dengan kriteria pencarian
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-3 gap-3" id="admin_pagination_bar">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase">
              Menampilkan <span className="text-slate-800 font-black">{filteredRows.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> - <span className="text-slate-800 font-black">{Math.min(currentPage * itemsPerPage, filteredRows.length)}</span> dari <span className="text-blue-600 font-black">{filteredRows.length}</span> baris
            </span>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-600 hover:bg-slate-100 text-[8px] font-black uppercase disabled:opacity-45 transition-colors cursor-pointer"
                >
                  Prev
                </button>
                <span className="text-[10px] font-black text-slate-500 min-w-[60px] text-center">
                  Hlm {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-600 hover:bg-slate-100 text-[8px] font-black uppercase disabled:opacity-45 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};

// COMPACT CELL COMPONENT FOR UPLOADING
interface EvidenCellProps {
  noTugas: string;
  evidenIdx: 1 | 2;
  evidenData: EvidenUpload;
  isUploading: boolean;
  msg?: { type: 'success' | 'error', text: string };
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
  onManualSubmit: (url: string) => void;
}

const EvidenUploadCell: React.FC<EvidenCellProps> = ({
  noTugas,
  evidenIdx,
  evidenData,
  isUploading,
  msg,
  onUploadChange,
  onDelete,
  onManualSubmit
}) => {
  const photoUrl = evidenIdx === 1 ? evidenData.fotoEviden1 : evidenData.fotoEviden2;
  const fileName = evidenIdx === 1 ? evidenData.fileName1 : evidenData.fileName2;
  const uploadedAt = evidenIdx === 1 ? evidenData.uploadedAt1 : evidenData.uploadedAt2;
  
  const uniqueId = `file_input_${noTugas}_${evidenIdx}`;
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const submitManual = () => {
    if (manualUrl.trim()) {
      onManualSubmit(manualUrl.trim());
      setIsManualInput(false);
      setManualUrl('');
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {photoUrl ? (
        // IMAGE ALREADY UPLOADED VIEW
        <div className="flex items-center justify-between gap-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl p-2">
          <div className="flex items-center gap-2 overflow-hidden">
            {/* Miniature thumbnail */}
            <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group/thumb">
              {photoUrl.startsWith('http') ? (
                <img 
                  src={photoUrl} 
                  alt="Eviden" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-cyan-150 flex items-center justify-center text-[8px] font-black text-cyan-800">
                  LINK
                </div>
              )}
              <a 
                href={photoUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity text-[8px] font-black"
                title="Buka Link Foto"
              >
                LIHAT
              </a>
            </div>
            
            <div className="overflow-hidden">
              <div className="flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                <span className="text-[8px] font-black text-emerald-800 uppercase tracking-tight truncate">SIAP TAMPIL</span>
              </div>
              <p className="text-[7px] text-slate-400 font-extrabold truncate mt-0.5" title={fileName}>
                {fileName || "File gambar"}
              </p>
              <p className="text-[6.5px] text-slate-650 font-semibold truncate">
                {uploadedAt || "-"}
              </p>
            </div>
          </div>

          <button
            onClick={onDelete}
            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors border border-rose-100 shrink-0 cursor-pointer"
            title="Hapus foto eviden ini"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ) : isManualInput ? (
        // MANUAL LINK ENTRY BOX
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col gap-1.5">
          <input 
            type="text"
            className="w-full bg-white px-2 py-1 text-[8.5px] font-bold text-slate-800 border border-slate-200 outline-none rounded focus:border-blue-500"
            placeholder="Tempel URL Direct Foto (HTTP/HTTPS)..."
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
          />
          <div className="flex items-center gap-1">
            <button
              onClick={submitManual}
              disabled={!manualUrl.trim()}
              className="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[7.5px] font-black uppercase tracking-wider disabled:opacity-45 cursor-pointer"
            >
              Simpan
            </button>
            <button
              onClick={() => {
                setIsManualInput(false);
                setManualUrl('');
              }}
              className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 text-[7.5px] font-bold uppercase cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        // FILE UPLOADER INPUT VIEW WITH ALTERNATIVE MANUAL INPUT
        <div className="flex flex-col gap-1.5 w-full">
          <label 
            htmlFor={uniqueId}
            className={`border border-dashed rounded-xl px-3 py-2 flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
              isUploading 
                ? "bg-slate-50 border-blue-350 pointer-events-none" 
                : "bg-slate-50/50 hover:bg-slate-50 border-slate-300 hover:border-blue-400"
            }`}
          >
            {isUploading ? (
              <RefreshCw size={12} className="text-blue-500 animate-spin" />
            ) : (
              <Camera size={12} className="text-slate-400 shrink-0" />
            )}
            <span className={`text-[8px] uppercase tracking-wider font-extrabold ${isUploading ? "text-blue-500 font-black animate-pulse" : "text-slate-500"}`}>
              {isUploading ? "Mengunggah..." : "Upload Foto"}
            </span>
            <input 
              id={uniqueId}
              type="file" 
              accept="image/*"
              onChange={onUploadChange}
              disabled={isUploading}
              className="hidden" 
            />
          </label>
          
          {!isUploading && (
            <button
              onClick={() => setIsManualInput(true)}
              className="text-[7.5px] text-blue-600 hover:text-blue-700 font-black tracking-wider uppercase text-center mt-0.5"
            >
              Atau Input Link Manual
            </button>
          )}
        </div>
      )}

      {/* Upload response status messages */}
      {msg && (
        <span className={`text-[7px] font-black uppercase tracking-tight px-1 py-0.5 rounded ${
          msg.type === 'success' 
            ? "bg-emerald-50 text-emerald-600 line-clamp-2" 
            : "bg-rose-50 text-rose-600 line-clamp-3"
        }`}>
          {msg.text}
        </span>
      )}
    </div>
  );
};
