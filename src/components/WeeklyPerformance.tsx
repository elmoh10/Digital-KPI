import React, { useState, useMemo } from "react";
import { Employee, KPITargets, WeeklyMetrics } from "../types";
import { Search, Calendar as CalendarIcon, Filter, LayoutDashboard, Users, UserCircle, SortAsc, ChevronRight, AlertTriangle, User, Phone, FileText, MapPin, Printer, GitCompare, X, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { MonthYearSelector } from "./MonthYearSelector";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

interface WeeklyPerformanceProps {
  employees: Employee[];
  targetsChat: KPITargets;
  targetsUniversal: KPITargets;
}

export default function WeeklyPerformance({ employees: rawEmployees, targetsChat, targetsUniversal }: WeeklyPerformanceProps) {
  // Only include non-archived agent employees
  const employees = useMemo(() => rawEmployees.filter(emp => {
    if (emp.isArchived) return false;
    if (emp.id.toString().startsWith("TL-") || emp.fullName.startsWith("تيم ليدر كود")) return false;
    if (emp.leaderPerformance !== undefined && emp.performance.length === 0) return false;
    return true;
  }), [rawEmployees]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    employees.forEach(emp => {
      if (emp.weeklyPerformance) {
        emp.weeklyPerformance.forEach(wp => months.add(wp.month));
      }
    });
    return Array.from(months);
  }, [employees]);

  const [selectedId, setSelectedId] = useState<string>(employees[0]?.id || "");
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[availableMonths.length - 1] || "");
  const [activeWeekTab, setActiveWeekTab] = useState<"all" | "week1" | "week2" | "week3" | "week4" | "compare">("all");
  const [compareWeekA, setCompareWeekA] = useState<"week1" | "week2" | "week3" | "week4">("week1");
  const [compareWeekB, setCompareWeekB] = useState<"week1" | "week2" | "week3" | "week4">("week2");
  const [searchQuery, setSearchQuery] = useState("");
  const [lobFilter, setLobFilter] = useState<string>("All");
  const [tlFilter, setTlFilter] = useState<string>("All");
  const [svFilter, setSvFilter] = useState<string>("All");
  const [bottom20Metric, setBottom20Metric] = useState<string>("");
  const [showIframeModal, setShowIframeModal] = useState(false);

  React.useEffect(() => {
    if (employees.length > 0) {
      if (!selectedId || !employees.some(emp => emp.id === selectedId)) {
        setSelectedId(employees[0].id);
      }
    }
  }, [employees, selectedId]);

  const handlePrintPdf = () => {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      setShowIframeModal(true);
    } else {
      window.print();
    }
  };

  const lobs = useMemo(() => ["All", ...Array.from(new Set(employees.map(e => e.lob).filter(Boolean)))], [employees]);
  const tls = useMemo(() => ["All", ...Array.from(new Set(employees.map(e => e.newTL).filter(Boolean)))], [employees]);
  const svs = useMemo(() => ["All", ...Array.from(new Set(employees.map(e => e.newSV).filter(Boolean)))], [employees]);

  const filteredEmployees = useMemo(() => {
    let result = employees.filter(emp => !emp.isArchived);
    const q = searchQuery.toLowerCase();
    if (q) {
      result = result.filter(emp => 
        emp.fullName.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q) ||
        emp.newTL.toLowerCase().includes(q)
      );
    }
    
    if (lobFilter !== "All") result = result.filter(e => e.lob === lobFilter);
    if (tlFilter !== "All") result = result.filter(e => e.newTL === tlFilter);
    if (svFilter !== "All") result = result.filter(e => e.newSV === svFilter);

    if (bottom20Metric && selectedMonth) {
      const getMetricValue = (emp: Employee) => {
        const record = emp.weeklyPerformance?.find(w => w.month === selectedMonth);
        if (!record) return null;
        
        // Aggregate the metric over the 4 weeks
        let sum = 0, count = 0;
        ["week1", "week2", "week3", "week4"].forEach(wKey => {
          const w = record.weeks[wKey as keyof typeof record.weeks];
          if (w && w[bottom20Metric as keyof typeof w] !== undefined) {
             const val = w[bottom20Metric as keyof typeof w];
             if (typeof val === "number" && val > 0) {
               sum += val;
               count++;
             } else if (bottom20Metric === "aht" && typeof val === "string" && val !== "00:00" && val !== "0:00" && val !== "-") {
               // roughly parse aht
               const parts = val.split(":");
               if (parts.length >= 2) {
                 const secs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                 sum += secs;
                 count++;
               } else if (!isNaN(Number(val))) {
                 sum += Number(val) < 1 ? Number(val) * 86400 : Number(val);
                 count++;
               }
             }
          }
        });
        return count > 0 ? sum / count : null;
      };

      const withMetrics = result.map(emp => ({ emp, val: getMetricValue(emp) })).filter(item => item.val !== null);
      
      // For AHT, bottom 20% means highest AHT. For others, it means lowest value.
      withMetrics.sort((a, b) => {
        if (bottom20Metric === "aht") return (b.val as number) - (a.val as number);
        return (a.val as number) - (b.val as number);
      });
      
      const bottomCount = Math.max(1, Math.ceil(withMetrics.length * 0.20));
      result = withMetrics.slice(0, bottomCount).map(item => item.emp);
    }
    
    return result;
  }, [employees, searchQuery, lobFilter, tlFilter, svFilter, bottom20Metric, selectedMonth]);

  const currentEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedId) || null;
  }, [employees, selectedId]);

  const activeWeeklyRecord = useMemo(() => {
    if (!currentEmployee || !selectedMonth) return null;
    return currentEmployee.weeklyPerformance?.find(w => w.month === selectedMonth) || null;
  }, [currentEmployee, selectedMonth]);

  const aggregateMetrics = useMemo(() => {
    if (!activeWeeklyRecord) return null;
    const weeks = activeWeeklyRecord.weeks;
    
    let totalAnswered = 0;
    let totalAhtSecs = 0;
    let ahtCount = 0;
    
    let tnpsSum = 0, tnpsCount = 0;
    let fcrSum = 0, fcrCount = 0;
    let ttbSum = 0, ttbCount = 0;
    let bbSum = 0, bbCount = 0;

    ["week1", "week2", "week3", "week4"].forEach((key) => {
      const w = weeks[key as keyof typeof weeks];
      if (!w) return;
      
      if (typeof w.answered === 'number') totalAnswered += w.answered;
      
      const ahtStr = w.aht as string;
      if (ahtStr && ahtStr !== "-" && ahtStr !== "0:00" && ahtStr !== "00:00") {
        let totalSecs = 0;
        const num = Number(ahtStr);
        if (!isNaN(num) && num > 0) {
          if (num < 1) totalSecs = Math.round(num * 86400);
          else totalSecs = Math.round(num);
        } else {
          const parts = ahtStr.split(":");
          if (parts.length === 2) {
            totalSecs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          } else if (parts.length === 3) {
            totalSecs = parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
          }
        }
        if (totalSecs > 0) {
          totalAhtSecs += totalSecs;
          ahtCount++;
        }
      }

      if (typeof w.tnps === 'number' && w.tnps > 0) { tnpsSum += w.tnps; tnpsCount++; }
      if (typeof w.fcr === 'number' && w.fcr > 0) { fcrSum += w.fcr; fcrCount++; }
      if (typeof w.ttb === 'number' && w.ttb > 0) { ttbSum += w.ttb; ttbCount++; }
      if (typeof w.bb === 'number' && w.bb > 0) { bbSum += w.bb; bbCount++; }
    });

    return {
      answered: totalAnswered > 0 ? totalAnswered : "-",
      aht: ahtCount > 0 ? `${Math.floor((totalAhtSecs / ahtCount) / 60).toString().padStart(2, '0')}:${Math.round((totalAhtSecs / ahtCount) % 60).toString().padStart(2, '0')}` : "-",
      tnps: tnpsCount > 0 ? tnpsSum / tnpsCount : "-",
      fcr: fcrCount > 0 ? fcrSum / fcrCount : "-",
      ttb: ttbCount > 0 ? ttbSum / ttbCount : "-",
      bb: bbCount > 0 ? bbSum / bbCount : "-",
    };
  }, [activeWeeklyRecord]);

  const weekLabels: Record<string, string> = {
    all: "مجمع (الكل)",
    week1: "الأسبوع الأول",
    week2: "الأسبوع الثاني",
    week3: "الأسبوع الثالث",
    week4: "الأسبوع الرابع",
    compare: "مقارنة الأداء"
  };

  const compareData = useMemo(() => {
    if (!activeWeeklyRecord || activeWeekTab !== "compare") return [];
    
    const wA = activeWeeklyRecord.weeks[compareWeekA];
    const wB = activeWeeklyRecord.weeks[compareWeekB];
    
    const getVal = (v: any) => {
      if (typeof v === 'number') {
         if (v > 0 && v <= 2.5 && !Number.isInteger(v)) return v * 100;
         return v;
      }
      return 0;
    };

    return [
      {
        name: "TNPS",
        [weekLabels[compareWeekA]]: getVal(wA?.tnps),
        [weekLabels[compareWeekB]]: getVal(wB?.tnps),
      },
      {
        name: "FCR",
        [weekLabels[compareWeekA]]: getVal(wA?.fcr),
        [weekLabels[compareWeekB]]: getVal(wB?.fcr),
      },
      {
        name: "TTB",
        [weekLabels[compareWeekA]]: getVal(wA?.ttb),
        [weekLabels[compareWeekB]]: getVal(wB?.ttb),
      },
      {
        name: "BB",
        [weekLabels[compareWeekA]]: getVal(wA?.bb),
        [weekLabels[compareWeekB]]: getVal(wB?.bb),
      }
    ];
  }, [activeWeeklyRecord, activeWeekTab, compareWeekA, compareWeekB]);

  const trendData = useMemo(() => {
    if (!activeWeeklyRecord || activeWeekTab !== "all") return [];
    const getVal = (v: any) => {
      if (typeof v === 'number') {
         if (v > 0 && v <= 2.5 && !Number.isInteger(v)) return v * 100;
         return v;
      }
      return 0;
    };
    return [
      { name: "الأسبوع 1", TNPS: getVal(activeWeeklyRecord.weeks.week1?.tnps), FCR: getVal(activeWeeklyRecord.weeks.week1?.fcr), TTB: getVal(activeWeeklyRecord.weeks.week1?.ttb), BB: getVal(activeWeeklyRecord.weeks.week1?.bb) },
      { name: "الأسبوع 2", TNPS: getVal(activeWeeklyRecord.weeks.week2?.tnps), FCR: getVal(activeWeeklyRecord.weeks.week2?.fcr), TTB: getVal(activeWeeklyRecord.weeks.week2?.ttb), BB: getVal(activeWeeklyRecord.weeks.week2?.bb) },
      { name: "الأسبوع 3", TNPS: getVal(activeWeeklyRecord.weeks.week3?.tnps), FCR: getVal(activeWeeklyRecord.weeks.week3?.fcr), TTB: getVal(activeWeeklyRecord.weeks.week3?.ttb), BB: getVal(activeWeeklyRecord.weeks.week3?.bb) },
      { name: "الأسبوع 4", TNPS: getVal(activeWeeklyRecord.weeks.week4?.tnps), FCR: getVal(activeWeeklyRecord.weeks.week4?.fcr), TTB: getVal(activeWeeklyRecord.weeks.week4?.ttb), BB: getVal(activeWeeklyRecord.weeks.week4?.bb) },
    ];
  }, [activeWeeklyRecord, activeWeekTab]);

  const ahtToSeconds = (aht: string): number => {
    if (!aht || aht === "00:00" || aht === "0:00" || aht === "-") return 0;
    const num = Number(aht);
    if (!isNaN(num) && num > 0) {
      if (num < 1) {
        return Math.round(num * 86400);
      } else {
        return Math.round(num);
      }
    }
    const parts = aht.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (isNaN(mins) || isNaN(secs)) return 0;
      return mins * 60 + secs;
    } else if (parts.length === 3) {
      const mins = parseInt(parts[1], 10);
      const secs = parseInt(parts[2], 10);
      if (isNaN(mins) || isNaN(secs)) return 0;
      return mins * 60 + secs;
    }
    return 0;
  };

  const secondsToAht = (totalSecs: number): string => {
    if (totalSecs <= 0) return "00:00";
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.round(totalSecs % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const checkTarget = (metric: string, value: any, lob: string): { met: boolean; text: string; color: string; bg: string } => {
    const targets = lob === "Universal" ? targetsUniversal : targetsChat;
    if (!targets) return { met: false, text: "", color: "text-slate-500 bg-slate-100", bg: "bg-slate-500" };
    
    switch (metric.toLowerCase()) {
      case "tnps":
        return { 
          met: value >= targets.nps, 
          text: `${targets.nps}%`, 
          color: value >= targets.nps ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50",
          bg: value >= targets.nps ? "bg-emerald-500" : "bg-rose-500"
        };
      case "fcr":
        return { 
          met: value >= targets.fcr, 
          text: `${targets.fcr}%`, 
          color: value >= targets.fcr ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50",
          bg: value >= targets.fcr ? "bg-emerald-500" : "bg-rose-500"
        };
      case "ttb":
        return { 
          met: value >= targets.ttb, 
          text: `${targets.ttb}%`, 
          color: value >= targets.ttb ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50",
          bg: value >= targets.ttb ? "bg-emerald-500" : "bg-rose-500"
        };
      case "bb":
        return { 
          met: value >= targets.ctb, 
          text: `${targets.ctb}%`, 
          color: value >= targets.ctb ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50",
          bg: value >= targets.ctb ? "bg-emerald-500" : "bg-rose-500"
        };
      case "aht":
        const actualSecs = ahtToSeconds(value);
        const targetSecs = targets.ahtSeconds;
        const metAht = actualSecs === 0 || actualSecs <= targetSecs;
        return { 
          met: metAht, 
          text: secondsToAht(targetSecs), 
          color: metAht ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50",
          bg: metAht ? "bg-emerald-500" : "bg-rose-500"
        };
      default:
        return { met: true, text: "", color: "text-slate-500 bg-slate-100", bg: "bg-slate-500" };
    }
  };

  const renderTargetMetricCard = (title: string, value: any, metric: string, lob: string, isPercent: boolean = false) => {
    const isAnswered = metric === "answered";
    const valString = (value === undefined || value === null || value === "" || value === 0 || value === "0:00") ? "-" : value;
    
    let formattedVal: string | number = valString;
    
    if (valString !== "-") {
      if (metric === "aht" && typeof valString === "string") {
        const num = Number(valString);
        if (!isNaN(num) && num > 0) {
          let totalSecs = 0;
          if (num < 1) {
            totalSecs = Math.round(num * 86400);
          } else {
            totalSecs = Math.round(num);
          }
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          formattedVal = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
          // If it's already "07:20", try to clean it
          const parts = valString.split(":");
          if (parts.length === 2) {
             formattedVal = valString;
          } else if (parts.length === 3) {
             formattedVal = `${parts[1]}:${parts[2]}`;
          }
        }
      } else if (isPercent && typeof valString === "number") {
        let v = valString;
        if (v > 0 && v <= 2.5 && !Number.isInteger(v)) {
          v = v * 100; // Correct previously uploaded fractional percentages
        }
        formattedVal = Math.round(v);
      } else if (typeof valString === "number") {
        formattedVal = Number.isInteger(valString) ? valString : valString.toFixed(1);
      }
    }

    const displayVal = valString === "-" ? "-" : `${formattedVal}${isPercent ? "%" : ""}`;
    
    if (isAnswered) {
      return (
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 text-right flex flex-col justify-between" dir="rtl">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="px-2.5 py-1 text-[10px] rounded-full font-semibold text-slate-500 bg-slate-100">
                إجمالي
              </span>
              <span className="text-slate-400 text-xs font-semibold">{title}</span>
            </div>
            <p className="text-2xl font-bold font-mono text-slate-800">{displayVal}</p>
          </div>
        </div>
      );
    }

    const { color, text, bg } = checkTarget(metric, value, lob);
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 text-right flex flex-col justify-between" dir="rtl">
        <div>
          <div className="flex justify-between items-start mb-2">
            <span className={`px-2.5 py-1 text-[10px] rounded-full font-semibold ${color}`}>
              الهدف: {text}
            </span>
            <span className="text-slate-400 text-xs font-semibold">{title}</span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-800">{displayVal}</p>
        </div>
        {isPercent && valString !== "-" && (
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-auto">
            <div className={`h-full rounded-full transition-all duration-1000 ${bg}`} style={{ width: `${Math.min(Number(valString) <= 2.5 ? Number(valString) * 100 : Number(valString), 100)}%` }}></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:block" id="weekly-main-grid" dir="rtl">
      {/* Search Sidebar Column */}
      <div className="lg:col-span-4 space-y-6 order-1 lg:order-2 print:hidden" id="weekly-search-column">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6" id="weekly-search-box">
          <h2 className="text-lg font-display font-semibold text-slate-800 mb-4 flex items-center gap-2 font-black">
            <Search className="w-5 h-5 text-indigo-500" />
            البحث عن موظف
          </h2>
          
          <div className="relative mb-5">
            <input
              type="text"
              placeholder="اكتب اسم الموظف أو الكود (ID) ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-sans"
              dir="rtl"
            />
            <Search className="absolute right-3.5 top-3.5 w-5 h-5 text-slate-400" />
          </div>

          <div className="flex flex-col gap-3 mb-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> تصفية النتائج</h3>
            <div className="grid grid-cols-2 gap-2">
              <select value={lobFilter} onChange={(e) => setLobFilter(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-2 py-1.5 outline-none focus:border-indigo-500">
                <option value="All">LOB (الكل)</option>
                {lobs.filter(l => l !== "All").map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={tlFilter} onChange={(e) => setTlFilter(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-2 py-1.5 outline-none focus:border-indigo-500">
                <option value="All">TL (الكل)</option>
                {tls.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={svFilter} onChange={(e) => setSvFilter(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-2 py-1.5 outline-none focus:border-indigo-500">
                <option value="All">SV (الكل)</option>
                {svs.filter(s => s !== "All").map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={bottom20Metric} onChange={(e) => setBottom20Metric(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-2 py-1.5 outline-none focus:border-indigo-500">
                <option value="">Bottom 20% (بدون)</option>
                <option value="tnps">TNPS</option>
                <option value="fcr">FCR</option>
                <option value="aht">AHT</option>
                <option value="ttb">TTB</option>
                <option value="bb">BB</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1" id="weekly-employee-list">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setSelectedId(emp.id);
                    setSearchQuery("");
                  }}
                  className={`w-full text-right p-4 rounded-2xl border transition-all flex justify-between items-center ${
                    selectedId === emp.id
                      ? "bg-indigo-950 text-white border-indigo-900 shadow-md"
                      : "bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-transparent"
                  }`}
                  dir="rtl"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-sm truncate">{emp.fullName}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs opacity-80 font-mono">
                      <span>ID: {emp.id}</span>
                      <span>•</span>
                      <span>{emp.newTL.split(" ")[0]}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 ml-1 transition-transform ${selectedId === emp.id ? "rotate-90 text-indigo-400" : "text-slate-400"}`} />
                </button>
              ))
            ) : (
              <p className="text-center text-slate-400 text-sm py-8" dir="rtl">
                لا توجد نتائج مطابقة لبحثك.
              </p>
            )}
          </div>
        </div>

        {/* Selected Employee Info Card */}
        {currentEmployee && (
          <div className="bg-slate-900 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
            {/* Background elements */}
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all duration-700"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-start justify-between mb-8">
                <div className="flex gap-2">
                  <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1 text-xs font-bold rounded-full font-mono shadow-sm">
                    {currentEmployee.lob}
                  </span>
                </div>
              </div>
              
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-1">{currentEmployee.fullName}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-indigo-300 font-mono font-bold text-sm bg-indigo-950/50 px-2 py-0.5 rounded">ID: {currentEmployee.id}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-100 font-semibold">{currentEmployee.newTL}</span>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px]">(TL) قائد الفريق</span>
                    <Users className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-100 font-semibold">{currentEmployee.newSV}</span>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px]">(Supervisor) المشرف</span>
                    <User className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-100 font-mono">{currentEmployee.mobileNumber || "-"}</span>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px]">رقم الموبايل</span>
                    <Phone className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-100 font-mono">{currentEmployee.nationalId || "-"}</span>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px]">الرقم القومي</span>
                    <FileText className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-100 font-semibold bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/20 text-xs">
                    {currentEmployee.location === "WFH" ? "العمل من المنزل (WFH)" : (currentEmployee.location === "NC" ? "مقر مدينة نصر (NC)" : (currentEmployee.location === "Dokki" ? "مقر الدقي (Dokki)" : (currentEmployee.location || "-")))}
                  </span>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px]">موقع العمل</span>
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main KPI Dashboard Area */}
      <div className="lg:col-span-8 space-y-6 order-2 lg:order-1 print:col-span-12 print:w-full" id="weekly-dashboard-area">
        {!currentEmployee ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm" id="no-employee">
            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-display font-medium text-slate-700 mb-2">الرجاء اختيار أحد الموظفين</h3>
            <p className="text-slate-400 text-sm">استعمل قائمة البحث في الجانب الأيمن لاستعراض تفاصيل الأداء الأسبوعي</p>
          </div>
        ) : (
          <>
            {/* Header Controls */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4 no-print mb-6">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "مجمع (الكل)" },
                  { id: "week1", label: "الأسبوع الأول" },
                  { id: "week2", label: "الأسبوع الثاني" },
                  { id: "week3", label: "الأسبوع الثالث" },
                  { id: "week4", label: "الأسبوع الرابع" },
                  { id: "compare", label: "مقارنة الأداء" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveWeekTab(tab.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeWeekTab === tab.id ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100" : "text-slate-500 hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {availableMonths.length > 0 && (
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap" dir="rtl">
                  <button
                    onClick={handlePrintPdf}
                    className="bg-gradient-to-r from-we-pink to-we-pink-light hover:brightness-110 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all no-print shrink-0"
                    id="print-pdf-report-btn-weekly"
                    title="تصدير الصفحة الحالية لملف PDF"
                  >
                    <Printer className="w-4 h-4" />
                    <span>تصدير PDF</span>
                  </button>
                  <div className="h-4 w-px bg-slate-200 no-print" />
                  <CalendarIcon className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span className="text-slate-500 text-xs font-bold">الشهر المراد عرضه:</span>
                  <MonthYearSelector
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    className="w-48"
                  />
                </div>
              )}
            </div>

            {!activeWeeklyRecord ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-display font-medium text-slate-700 mb-2">لا توجد بيانات متاحة لهذا الشهر</h3>
                <p className="text-slate-400 text-sm">لم يتم تسجيل أداء أسبوعي للموظف <strong>{currentEmployee.fullName}</strong> في شهر <strong>{selectedMonth}</strong></p>
              </div>
            ) : (
              <div id="pdf-export-content-weekly">
                {/* Print Header Section (Visible only during printing / PDF generation) */}
            <div className="hidden print:block text-right mb-6 border-b-2 border-slate-900 pb-5" dir="rtl" id="pdf-print-header-weekly">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 font-display">تقرير الأداء الأسبوعي للموظف</h1>
                  <p className="text-xs text-slate-500 mt-1">بوابة Digital Chat KPI - قطاع الدعم الفني والدردشة الرقمية (WE)</p>
                </div>
                {/* WE logo icon */}
                <div className="w-14 h-14 bg-[#512588] rounded-full flex items-center justify-center shadow-sm">
                  <svg viewBox="0 0 100 100" className="w-9 h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-8 mt-5 pt-3 border-t border-slate-100 text-[12px] font-semibold text-slate-700">
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">اسم الموظف:</span>
                  <span className="text-slate-900 font-black">{currentEmployee.fullName}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">كود الموظف (ID):</span>
                  <span className="text-slate-900 font-mono font-bold">{currentEmployee.id}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">قائد الفريق (TL):</span>
                  <span className="text-slate-900">{currentEmployee.newTL}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">المشرف (Supervisor):</span>
                  <span className="text-slate-950">{currentEmployee.newSV}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">الخط (LOB):</span>
                  <span className="text-slate-900 font-bold">{currentEmployee.lob}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">شهر التقرير:</span>
                  <span className="text-slate-900 font-mono font-bold">{selectedMonth}</span>
                </div>
              </div>
            </div>

            {/* Content Area for Selected Week */}
            {(() => {
              if (activeWeekTab === "compare") {
                return (
                  <motion.div
                    key="compare"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                      <h4 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2 justify-end">
                        <GitCompare className="w-4 h-4 text-indigo-500" />
                        مقارنة أداء الأسابيع
                      </h4>
                      <div className="flex items-center gap-2">
                        <select 
                          value={compareWeekA} 
                          onChange={(e) => setCompareWeekA(e.target.value as any)}
                          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                        >
                          <option value="week1">الأسبوع الأول</option>
                          <option value="week2">الأسبوع الثاني</option>
                          <option value="week3">الأسبوع الثالث</option>
                          <option value="week4">الأسبوع الرابع</option>
                        </select>
                        <span className="text-slate-400 font-bold text-xs">VS</span>
                        <select 
                          value={compareWeekB} 
                          onChange={(e) => setCompareWeekB(e.target.value as any)}
                          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                        >
                          <option value="week1">الأسبوع الأول</option>
                          <option value="week2">الأسبوع الثاني</option>
                          <option value="week3">الأسبوع الثالث</option>
                          <option value="week4">الأسبوع الرابع</option>
                        </select>
                      </div>
                    </div>

                    <div className="h-80 w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={compareData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <RechartsTooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                          <Bar dataKey={weekLabels[compareWeekA]} fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={60} />
                          <Bar dataKey={weekLabels[compareWeekB]} fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={60} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                );
              }

              const metrics = activeWeekTab === "all" ? aggregateMetrics : activeWeeklyRecord.weeks[activeWeekTab as keyof typeof activeWeeklyRecord.weeks];
              
              if (!metrics) {
                return (
                  <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                     <p className="text-slate-500">لا توجد بيانات لهذا الأسبوع</p>
                  </div>
                );
              }
              return (
                <motion.div
                  key={activeWeekTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"
                >
                  <h4 className="text-slate-800 font-display font-semibold text-sm mb-6 flex items-center gap-2 justify-end">
                    <LayoutDashboard className="w-4 h-4 text-indigo-500" />
                    تفاصيل الأداء - {weekLabels[activeWeekTab]}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {renderTargetMetricCard("Answered (الردود)", metrics?.answered, "answered", currentEmployee.lob)}
                    {renderTargetMetricCard("AHT (سرعة الرد)", metrics?.aht, "aht", currentEmployee.lob)}
                    {renderTargetMetricCard("TNPS (مؤشر التوصية)", metrics?.tnps, "tnps", currentEmployee.lob, true)}
                    {renderTargetMetricCard("FCR (الحل من أول مرة)", metrics?.fcr, "fcr", currentEmployee.lob, true)}
                    {renderTargetMetricCard("TTB (الأساسيات)", metrics?.ttb, "ttb", currentEmployee.lob, true)}
                    {renderTargetMetricCard("BB (الخصومات)", metrics?.bb, "bb", currentEmployee.lob, true)}
                  </div>
                  
                  {activeWeekTab === "all" && (
                    <div className="border-t border-slate-100 pt-8 mt-4">
                      <h4 className="text-slate-800 font-display font-semibold text-sm mb-6 flex items-center gap-2 justify-end">
                        <GitCompare className="w-4 h-4 text-indigo-500" />
                        تطور الأداء خلال الشهر
                      </h4>
                      <div className="h-72 w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <RechartsTooltip 
                              cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }}
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                            <Line type="monotone" dataKey="TNPS" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="FCR" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="TTB" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="BB" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </div>
          )}
          </>
        )}
        {/* Safe PDF Export / Iframe Helper Modal */}
        {showIframeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-opacity">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative text-right"
              dir="rtl"
            >
              <button 
                onClick={() => setShowIframeModal(false)}
                className="absolute top-4 left-4 p-1.5 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">تنبيه هام لتصدير التقرير PDF بنجاح</h3>
                  <p className="text-[10px] text-slate-400 font-medium font-sans">بسبب قيود المتصفح الأمنية داخل بيئة العرض التجريبية</p>
                </div>
              </div>

              <div className="space-y-4 text-xs leading-relaxed text-slate-600">
                <p className="bg-amber-50 text-amber-800 p-3 rounded-2xl border border-amber-100 font-medium text-[11px] leading-relaxed">
                  عزيزي الموظف، نظراً لأنك تقوم باستعراض التطبيق داخل نافذة تجريبية مدمجة (iFrame) تابعة لمنصة التطوير، فإن المتصفح يمنع تشغيل الطباعة المباشرة تلقائياً للمحافظة على أمان الصفحة.
                </p>

                <div className="space-y-2">
                  <span className="font-bold text-slate-800 block">خطوات بسيطة وسريعة لتصدير PDF:</span>
                  <ul className="list-decimal list-inside space-y-1.5 pr-1 text-[11px]">
                    <li>يرجى فتح التطبيق في <strong>علامة تبويب جديدة مستقلة (Open App)</strong> من الزر العلوي في شريط منصة AI Studio.</li>
                    <li>أو خذ الرابط المباشر للمعاينة أدناه وافتحه في المتصفح الخاص بك:</li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between gap-2 font-mono text-[10px] select-all">
                  <span className="text-slate-600 truncate text-[10px] text-left block w-full outline-none" style={{ direction: 'ltr' }}>
                    {window.location.origin || "https://ais-dev-2wkmibvpsdiusw6tvje2tc-445036694921.europe-west3.run.app"}
                  </span>
                  <button 
                    onClick={() => {
                      try {
                        const url = window.location.href;
                        navigator.clipboard.writeText(url);
                      } catch (err) {}
                    }}
                    type="button"
                    className="bg-slate-900 text-white rounded-lg px-2.5 py-1 text-[9px] hover:bg-slate-800 font-sans font-bold shrink-0 cursor-pointer"
                  >
                    نسخ الرابط
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  بمجرد فتح الرابط في نافذة جديدة، اضغط على زر <span className="font-bold text-we-pink">"تصدير PDF"</span> مجدداً وسيفتح لك المتصفح خيارات الحفظ الفوري كملف PDF فائق ومثالي للطباعة!
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#512588] hover:bg-[#3d1968] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح التطبيق في نافذة مستقلة</span>
                </a>
                <button 
                  onClick={() => setShowIframeModal(false)}
                  type="button"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
