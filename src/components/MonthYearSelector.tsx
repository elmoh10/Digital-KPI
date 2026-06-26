import React from "react";

export const MonthYearSelector = ({ value, onChange, className }: { value: string, onChange: (v: string) => void, className?: string }) => {
  const [monthStr, yearStr] = value.split("-");
  const safeMonth = monthStr || "Jan";
  const safeYear = yearStr || "25";
  const yearFull = "20" + safeYear;
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  
  const years = Array.from({ length: 10 }, (_, i) => (2025 + i).toString());

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${e.target.value}-${safeYear}`);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${safeMonth}-${e.target.value.slice(-2)}`);
  };

  return (
    <div className={`flex items-center gap-2 w-full ${className || ""}`}>
      <select value={safeMonth} onChange={handleMonthChange} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer">
        {months.map((m, i) => (
          <option key={m} value={m}>{arMonths[i]} ({m})</option>
        ))}
      </select>
      <select value={yearFull} onChange={handleYearChange} className="w-24 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-700 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer">
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
};
