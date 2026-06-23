import React from "react";
import { Employee, KPITargets } from "../types";
import { Construction } from "lucide-react";

interface WeeklyPerformanceProps {
  employees: Employee[];
  targetsChat: KPITargets;
  targetsUniversal: KPITargets;
}

export default function WeeklyPerformance({ employees, targetsChat, targetsUniversal }: WeeklyPerformanceProps) {
  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm" dir="rtl">
      <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
        <Construction className="w-10 h-10 text-emerald-500" />
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">قسم الأداء الأسبوعي</h2>
      <p className="text-sm text-slate-500 max-w-md text-center leading-relaxed">
        هذا القسم مخصص لمتابعة الأداء الأسبوعي للموظفين. جاري العمل على تطوير هذه الشاشة لتوفير تحليلات وتقارير أسبوعية مفصلة.
      </p>
    </div>
  );
}
