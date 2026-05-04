import React from 'react';
import { LayoutGrid, FileText, Scissors, Zap, Wallet, BarChart2, ShieldCheck, Settings } from 'lucide-react';

interface HeaderProps {
  onAdminClick: () => void;
  activeTab: 'CCTV' | 'OVER_SLA';
  onTabChange: (tab: 'CCTV' | 'OVER_SLA') => void;
}

export const Header: React.FC<HeaderProps> = ({ onAdminClick, activeTab, onTabChange }) => {
  return (
    <header className="bg-[#0a1128] text-white h-16 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="bg-white p-1 rounded-lg">
          <img 
            src="https://lh3.googleusercontent.com/d/1oVyyV8xNI5Xse4CMC2Ovn11w18uVXp7E" 
            alt="Logo" 
            className="w-8 h-8 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h1 className="text-sm font-black tracking-tighter leading-none">DASHBOARD MONITORING YANDAL</h1>
          <p className="text-[10px] text-brand-accent font-bold opacity-80 uppercase">PLN ES BUKITTINGGI</p>
        </div>
      </div>

      <nav className="flex items-center gap-1">
        <NavItem 
          icon={<LayoutGrid size={16} />} 
          label="CCTV" 
          active={activeTab === 'CCTV'} 
          onClick={() => onTabChange('CCTV')}
        />
        <NavItem 
          icon={<BarChart2 size={16} />} 
          label="OVER SLA" 
          active={activeTab === 'OVER_SLA'} 
          onClick={() => onTabChange('OVER_SLA')}
        />
        <NavItem icon={<ShieldCheck size={16} />} label="ADMIN" onClick={onAdminClick} />
      </nav>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> SISTEM AKTIF
          </span>
          <span className="text-[9px] opacity-60 uppercase">NODE: BPLN ES BKT</span>
        </div>
        <div className="w-10 h-10 bg-gray-700 rounded-full overflow-hidden border-2 border-brand-accent">
          <img src="https://picsum.photos/seed/admin/100/100" alt="Admin" referrerPolicy="no-referrer" />
        </div>
      </div>
    </header>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${active ? 'bg-[#00e5ff22] text-brand-accent border border-brand-accent/30 shadow-[0_0_15px_rgba(0,229,255,0.1)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
  >
    {icon}
    <span className="text-[11px] font-black tracking-widest">{label}</span>
  </button>
);
