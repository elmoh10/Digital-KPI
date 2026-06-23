import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { HardHat, Wrench, Sparkles, ServerCrash, ArrowRight } from "lucide-react";

interface MaintenancePageProps {
  onBack?: () => void;
}

export default function MaintenancePage({ onBack }: MaintenancePageProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 1;
      });
    }, 120);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden" dir="rtl">
      {/* Background Shapes */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-we-purple/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-we-pink/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 flex flex-col items-center max-w-lg w-full px-6 text-center"
      >
        {/* WE Logo */}
        <div className="w-24 h-24 mb-8 shrink-0 drop-shadow-xl relative">
          <div className="absolute inset-0 bg-we-purple/20 rounded-full animate-ping"></div>
          <svg viewBox="0 0 100 100" className="w-full h-full relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#512588" />
            <path 
              d="M 18,39 L 18,51 C 18,57 22.5,61 28,61 C 33.5,61 38,57 38,51 L 38,39 L 38,51 C 38,57 42.5,61 48,61 C 53.5,61 58,57 58,51 L 58,39 M 62,50 L 82,50 A 10,10 0 1,0 62,50 A 10,10 0 0,0 80,56" 
              stroke="white" 
              strokeWidth="7" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
        </div>

        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="mb-4 text-emerald-500 bg-emerald-50 rounded-full px-4 py-1 flex items-center justify-center gap-2 border border-emerald-100 shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-bold tracking-wider">المنصة تحت التطوير والتحسين</span>
        </motion.div>

        <h1 className="text-3xl md:text-4xl font-black text-we-purple mb-4">
          نعمل على تطوير النظام
        </h1>
        
        <p className="text-slate-500 text-sm md:text-base mb-10 leading-relaxed font-semibold">
          نحن نقوم حالياً بتحديثات شاملة لتحسين تجربة المستخدم وتطوير أداء المنصة. يرجى الانتظار، سنعود قريباً جداً!
        </p>

        {/* Progress Bar Container */}
        <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-slate-700">تحديثات قواعد البيانات والأنظمة</span>
            <span className="text-2xl font-black text-we-pink tabular-nums">{progress}%</span>
          </div>
          
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
            <motion.div 
              className="h-full bg-gradient-to-l from-we-pink to-we-purple rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
            >
              <div className="absolute inset-0 bg-white/20 w-full h-full animate-[progress-pulse_1.5s_linear_infinite]"></div>
            </motion.div>
          </div>
          
          <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-slate-400">
            <Wrench className="w-3.5 h-3.5 animate-pulse" />
            <span className="animate-pulse">جاري تنفيذ المزامنة...</span>
          </div>
        </div>

        {onBack && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={onBack}
            className="mt-8 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold shadow-sm border border-slate-200 transition-all flex items-center gap-2"
          >
            <ArrowRight className="w-5 h-5" />
            العودة للرئيسية
          </motion.button>
        )}

      </motion.div>
    </div>
  );
}
