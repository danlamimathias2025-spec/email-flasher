import React, { useEffect } from "react";
import { motion } from "motion/react";

interface SplashScreenProps {
  logo: string;
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ logo, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950"
    >
      <div className="relative flex flex-col items-center gap-6">
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Neon rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="absolute w-32 h-32 border-2 border-t-blue-500 border-r-blue-500 border-b-transparent border-l-transparent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          />
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-700">
            <img src={logo} alt="Global Apex Logo" className="w-full h-full object-cover" />
          </div>
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-2xl font-black tracking-widest text-white uppercase font-sans"
        >
          Global Apex
        </motion.h1>
      </div>
    </motion.div>
  );
};
