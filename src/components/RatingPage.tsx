import React from 'react';
import { motion } from 'motion/react';
import { Construction } from 'lucide-react';

interface RatingPageProps {
  data: any;
}

export const RatingPage: React.FC<RatingPageProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-xl border border-gray-100 shadow-sm p-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center text-center"
      >
        <div className="bg-yellow-50 p-6 rounded-full mb-6">
          <Construction size={48} className="text-yellow-600" />
        </div>
        <h2 className="text-3xl font-black italic tracking-tighter text-brand-primary uppercase mb-2">
          UNDER <span className="text-brand-secondary">MAINTENANCE</span>
        </h2>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">
          Halaman sedang dalam pengembangan
        </p>
      </motion.div>
    </div>
  );
};

