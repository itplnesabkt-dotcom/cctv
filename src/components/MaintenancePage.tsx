import React from 'react';
import { motion } from 'motion/react';
import { Wrench, Settings, AlertTriangle, Clock, Mail, ShieldAlert } from 'lucide-react';

export function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#0a1128] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decorative Patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-[#0a1128] to-[#0a1128] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Glow Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative max-w-xl w-full text-center z-10">
        {/* Animated Icon Container */}
        <div className="flex justify-center gap-4 mb-8">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="w-16 h-16 bg-cyan-950 border border-cyan-500/30 rounded-2xl flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.15)]"
          >
            <Settings size={32} />
          </motion.div>
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [-4, 4, -4] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="w-16 h-16 bg-orange-950 border border-orange-500/30 rounded-2xl flex items-center justify-center text-orange-400 shadow-[0_0_20px_rgba(255,77,0,0.15)] mt-4"
          >
            <Wrench size={30} />
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-slate-950/60 backdrop-blur-md rounded-2xl border border-white/5 p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-6">
            <ShieldAlert size={14} className="animate-pulse" />
            Sistem Sedang Diperbarui
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none mb-4 uppercase">
            Sistem Sedang <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300">
              Pemeliharaan
            </span>
          </h1>

          <p className="text-sm text-gray-400 font-medium leading-relaxed mb-8 max-w-md mx-auto">
            Kami sedang melakukan pemeliharaan sistem rutin untuk peningkatan performa, pembaruan fitur, serta optimalisasi integrasi data 
            <span className="text-white font-semibold"> PLN UP3 Bukittinggi</span>.
          </p>

          {/* Progress Simulation */}
          <div className="bg-slate-900 border border-white/5 rounded-xl p-4 mb-6 text-left">
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span className="text-gray-400 font-mono">STATUS PROSES:</span>
              <span className="text-cyan-400 font-mono">PENGURUTAN REPORT ID & OPTIMASI (92%)</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "92%" }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-400"
              />
            </div>
          </div>

          {/* Estimation & Contact Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium tracking-wide">
            <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-cyan-950 rounded-lg text-cyan-400">
                <Clock size={16} />
              </div>
              <div className="text-left">
                <p className="text-gray-500 text-[10px] font-bold uppercase">Estimasi Selesai</p>
                <p className="text-white font-extrabold font-mono">DIPERBARUI SEGERA</p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-teal-950 rounded-lg text-teal-400">
                <Mail size={16} />
              </div>
              <div className="text-left">
                <p className="text-gray-500 text-[10px] font-bold uppercase">Dukungan Teknis</p>
                <a href="mailto:halo.hpabkt@gmail.com" className="text-white font-extrabold font-mono hover:text-cyan-400 transition-colors">
                  halo.hpabkt@gmail.com
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Brand Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <p className="text-[10px] font-bold text-gray-500 tracking-[0.4em] uppercase">
            © 2026 PLN ELECTRICITY SERVICES • REGIONAL SUMATERA BARAT
          </p>
        </motion.div>
      </div>
    </div>
  );
}
