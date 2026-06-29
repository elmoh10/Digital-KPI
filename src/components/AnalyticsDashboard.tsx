/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Employee, KPITargets, HistoricalTargets } from "../types";
import { 
  TrendingUp, Award, Users, ShieldAlert, ArrowUpRight, BarChart3, 
  HelpCircle, Sparkles, Filter, Calendar, Zap, AlertCircle, LineChart as LineChartIcon, Printer, X, ExternalLink, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ahtToSeconds, secondsToAht, sortMonths } from "./EmployeeDashboard";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { useLanguage } from "../lib/LanguageContext";

interface AnalyticsDashboardProps {
  employees: Employee[];
  targetsChat: KPITargets;
  targetsUniversal: KPITargets;
  historicalTargets?: HistoricalTargets;
}

export default function AnalyticsDashboard({ employees: rawEmployees, targetsChat, targetsUniversal, historicalTargets }: AnalyticsDashboardProps) {
  const { t, isRtl } = useLanguage();
  // Only include non-archived agent employees in analytics by default
  const employees = useMemo(() => rawEmployees.filter(emp => 
    !emp.isArchived && 
    !(emp.performance.length === 0 && emp.leaderPerformance && emp.leaderPerformance.length > 0)
  ), [rawEmployees]);

  // Available Months Aggregated
  const allMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    employees.forEach(e => {
      e.performance.forEach(p => monthsSet.add(p.month));
    });
    return sortMonths(Array.from(monthsSet));
  }, [employees]);

  // Available Team Leaders
  const allTLs = useMemo(() => {
    const tlSet = new Set<string>();
    employees.forEach(e => {
      if (e.newTL) tlSet.add(e.newTL);
    });
    return Array.from(tlSet).sort();
  }, [employees]);

  // Selected Month and TL for report
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedTL, setSelectedTL] = useState<string>("All");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [showIframeModal, setShowIframeModal] = useState(false);

  const handlePrintPdf = () => {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      setShowIframeModal(true);
    } else {
      window.print();
    }
  };

  React.useEffect(() => {
    if (allMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(allMonths[allMonths.length - 1]);
    }
  }, [allMonths, selectedMonth]);

  // Selected Employee Chart Data
  const empChartData = useMemo(() => {
    if (!selectedEmpId) return null;
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return null;

    const availableMonths = emp.performance.map(p => p.month);
    const sortedMonths = sortMonths(availableMonths);

    const chartData = sortedMonths.map(month => {
      const p = emp.performance.find(perf => perf.month === month)!;
      
      let targetForMonthChat = targetsChat;
      let targetForMonthUniversal = targetsUniversal;
      if (historicalTargets && historicalTargets[month]) {
        targetForMonthChat = historicalTargets[month].chat;
        targetForMonthUniversal = historicalTargets[month].universal;
      }

      return {
        month: p.month,
        score: p.finalScore,
        target: emp.lob && !emp.lob.toLowerCase().includes("adsl") ? targetForMonthUniversal.finalScore : targetForMonthChat.finalScore
      };
    });
    
    return {
      name: emp.fullName,
      id: emp.id,
      chartData
    };
  }, [selectedEmpId, employees, targetsChat, targetsUniversal, historicalTargets]);

  // Overall statistics for the selected month and selected TL
  const monthStats = useMemo(() => {
    if (!selectedMonth || employees.length === 0) return null;

    let targetForMonthChat = targetsChat;
    let targetForMonthUniversal = targetsUniversal;
    if (historicalTargets && historicalTargets[selectedMonth]) {
      targetForMonthChat = historicalTargets[selectedMonth].chat;
      targetForMonthUniversal = historicalTargets[selectedMonth].universal;
    }

    let totalScore = 0;
    let totalCSI = 0;
    let totalNPS = 0;
    let totalAHTSecs = 0;
    let ahtCount = 0;
    let activeEmpCount = 0;
    let passingTargetsCount = 0;

    const rankings: { id: string; name: string; score: number; tl: string; targetScore: number; lob: string; aht: string; csi: number; nps: number }[] = [];

    employees.forEach(emp => {
      if (selectedTL !== "All" && emp.newTL !== selectedTL) return;

      const perf = emp.performance.find(p => p.month === selectedMonth);
      if (perf) {
        activeEmpCount++;
        totalScore += perf.finalScore;
        totalCSI += perf.csi;
        totalNPS += perf.nps;
        const secs = ahtToSeconds(perf.aht);
        if (secs > 0) {
          totalAHTSecs += secs;
          ahtCount++;
        }

        const empTargets = emp.lob && !emp.lob.toLowerCase().includes("adsl") ? targetForMonthUniversal : targetForMonthChat;
        if (perf.finalScore >= empTargets.finalScore) {
          passingTargetsCount++;
        }

        rankings.push({
          id: emp.id,
          name: emp.fullName,
          score: perf.finalScore,
          tl: emp.newTL,
          targetScore: empTargets.finalScore,
          lob: emp.lob || "N/A",
          aht: perf.aht,
          csi: perf.csi,
          nps: perf.nps
        });
      }
    });

    if (activeEmpCount === 0) return null;

    // Sort rankings to find Top Performers
    rankings.sort((a, b) => b.score - a.score);

    return {
      avgScore: totalScore / activeEmpCount,
      avgCSI: totalCSI / activeEmpCount,
      avgNPS: totalNPS / activeEmpCount,
      avgAHTStr: ahtCount > 0 ? secondsToAht(totalAHTSecs / ahtCount) : "00:00",
      activeEmpCount,
      passingRatio: (passingTargetsCount / activeEmpCount) * 100,
      topPerformers: rankings.slice(0, 3),
      needsCoaching: rankings.filter(r => r.score < r.targetScore),
      fullTeamList: rankings
    };
  }, [employees, selectedMonth, selectedTL, targetsChat, targetsUniversal]);

  // Team Leader Stats for comparative breakdown
  const tlStats = useMemo(() => {
    if (!selectedMonth) return [];

    const tlMap: { [key: string]: { totalScore: number; count: number; name: string } } = {};

    employees.forEach(emp => {
      // For TL comparative, we probably want to show all TLs regardless of selectedTL filter so admin can compare
      // if selectedTL is "All", show all. If selectedTL is specific, we still might only want to show that one or all?
      // Let's just show the ones filtered by the current view to be consistent.
      if (selectedTL !== "All" && emp.newTL !== selectedTL) return;

      const perf = emp.performance.find(p => p.month === selectedMonth);
      if (perf) {
        const tlName = emp.newTL || "غير محدد";
        if (!tlMap[tlName]) {
          tlMap[tlName] = { totalScore: 0, count: 0, name: tlName };
        }
        tlMap[tlName].totalScore += perf.finalScore;
        tlMap[tlName].count++;
      }
    });

    return Object.values(tlMap).map(tl => ({
      name: tl.name,
      avgScore: tl.totalScore / tl.count,
      count: tl.count
    })).sort((a, b) => b.avgScore - a.avgScore);

  }, [employees, selectedMonth, selectedTL]);

  return (
    <div className="space-y-6" id="analytics-workspace" dir={isRtl ? "rtl" : "ltr"}>
      {/* Filters bar */}
      <div className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex justify-between items-center no-print ${isRtl ? "flex-row-reverse" : "flex-row"}`} dir={isRtl ? "rtl" : "ltr"}>
        <div className={isRtl ? "text-right" : "text-left"}>
          <h3 className={`text-slate-800 font-display font-semibold text-sm flex items-center gap-2 font-bold ${isRtl ? "justify-end" : "justify-start"}`}>
            <Filter className="w-5 h-5 text-we-pink" />
            {t("تقارير وإحصائيات قائد الفريق والتشغيل")}
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">{t("تقييم جماعي ومؤشرات جودة الأداء العام للشركة")}</p>
        </div>

        <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
          <button
            onClick={handlePrintPdf}
            className="bg-gradient-to-r from-we-pink to-we-pink-light hover:brightness-110 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all no-print shrink-0"
            id="print-pdf-report-btn-analytics"
            title={t("تصدير الصفحة الحالية لملف PDF")}
          >
            <Printer className="w-4 h-4" />
            <span>{t("تصدير PDF")}</span>
          </button>
          
          <div className="h-4 w-px bg-slate-200 no-print" />

          <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
            <Users className="w-4 h-4 text-slate-400" />
            <select
              value={selectedTL}
              onChange={(e) => setSelectedTL(e.target.value)}
              className="bg-slate-50 border border-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-we-purple font-mono"
            >
              <option value="All">{t("كل قادة الفرق")}</option>
              {allTLs.map((tl) => (
                <option key={tl} value={tl}>
                  {tl}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-we-purple font-mono"
            >
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!monthStats ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-100 shadow-sm" id="analytics-no-data">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-display font-medium text-slate-700 mb-2">{t("لا توجد بيانات كافية")}</h3>
          <p className="text-slate-400 text-sm">{t("الرجاء إدخال بيانات أو رفع شيت تقييم لشهر")} {selectedMonth} {t("أولاً في لوحة التحكم لمشاهدة التحليل الجماعي.")}</p>
        </div>
      ) : (
        <div id="pdf-export-content-analytics">
          {/* Print Header Section (Visible only during printing / PDF generation) */}
          <div className={`hidden print:block mb-6 border-b-2 border-slate-900 pb-5 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"} id="pdf-print-header-analytics">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-display">{t("تقرير إحصائيات وأداء الفرق")}</h1>
                <p className="text-xs text-slate-500 mt-1">{t("بوابة Digital Chat KPI - قطاع الدعم الفني والدردشة الرقمية (WE)")}</p>
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
            <div className={`grid grid-cols-2 gap-y-2 gap-x-8 mt-5 pt-3 border-t border-slate-100 text-[12px] font-semibold text-slate-700 ${isRtl ? "text-right" : "text-left"}`}>
              <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                <span className="text-slate-400 font-normal">{t("شهر التقرير:")}</span>
                <span className="text-slate-900 font-mono font-bold">{selectedMonth}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                <span className="text-slate-400 font-normal">{t("تصفية القادة (TL):")}</span>
                <span className="text-slate-900 font-bold">{selectedTL === "All" ? t("كافة الفرق (All)") : selectedTL}</span>
              </div>
            </div>
          </div>

          {/* Main Analytics Cards Group */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6" id="analytics-grid-cards">
            
            <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-2 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
              <span className="text-slate-400 text-xs font-semibold block">{t("الموظفين النشطين")}</span>
              <p className="text-3xl font-bold font-mono text-slate-800">{monthStats.activeEmpCount}</p>
              <span className="text-[10px] text-slate-400 block">{t("* الذين يمتلكون سجل تقييم لشهر")} {selectedMonth}</span>
            </div>

            <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-2 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
              <span className="text-slate-400 text-xs font-semibold block">{t("متوسط الكفاءة العام")}</span>
              <p className="text-3xl font-bold font-mono text-we-purple">{monthStats.avgScore.toFixed(1)}%</p>
              <div className={`flex items-center gap-1 text-[10px] text-slate-500 ${isRtl ? "justify-end" : "justify-start"}`}>
                <span className="font-semibold text-emerald-600 font-mono">Chat: {targetsChat.finalScore}% | Univ: {targetsUniversal.finalScore}%</span>
                <span>{t("المستهدف:")}</span>
              </div>
            </div>

            <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-2 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
              <span className="text-slate-400 text-xs font-semibold block">{t("نسبة نجاح الفريق (KPI)")}</span>
              <p className="text-3xl font-bold font-mono text-emerald-600">{monthStats.passingRatio.toFixed(0)}%</p>
              <span className="text-[10px] text-slate-400 block">{t("* الموظفون المحققون للهدف المخصص لخط العمل (LOB)")}</span>
            </div>

            <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-2 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
              <span className="text-slate-400 text-xs font-semibold block">{t("متوسط رضا العملاء (CSI)")}</span>
              <p className="text-3xl font-bold font-mono text-blue-600">{monthStats.avgCSI.toFixed(1)}%</p>
              <span className="text-[10px] text-slate-400 block">{t("إجمالي ردود الفعل الإيجابية بالدردشات")}</span>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Top Performers Podium */}
            <div className={`md:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
              <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-500" />
                {t("لوحة شرف الأداء الثلاثية - شهر")} {selectedMonth}
              </h3>
              <p className="text-slate-500 text-xs mb-3">{t("أفضل 3 عناصر حققوا أعلى تقييمات إجمالية متكاملة في هذا الشهر:")}</p>

              <div className="space-y-3">
                {monthStats.topPerformers.map((perf, index) => {
                  // Badges color per rank
                  const rankColors = [
                    "bg-amber-100 text-amber-700 border-amber-200", // Gold
                    "bg-slate-100 text-slate-700 border-slate-200", // Silver
                    "bg-orange-50 text-orange-700 border-orange-100"  // Bronze
                  ];
                  return (
                    <motion.div
                      key={perf.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold font-mono text-sm ${rankColors[index] || "bg-indigo-50 text-indigo-700"}`}>
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-xs text-slate-800">{perf.name}</p>
                          <span className="text-[10px] text-slate-400">{t("قائد الفريق")}: {perf.tl}</span>
                        </div>
                      </div>

                      <div className={isRtl ? "text-right" : "text-left"}>
                        <span className="text-emerald-700 font-black font-mono text-sm leading-none">{perf.score}%</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{t("التقييم الكلي")}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Team Leader Comparative Breakdown */}
            <div className={`md:col-span-5 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
              <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2 font-bold">
                <BarChart3 className="w-5 h-5 text-we-pink" />
                {t("معدلات الكفاءة حسب قادة الفرق (TL)")}
              </h3>
              
              <div className="space-y-4 pt-2">
                {tlStats.map((tl, index) => (
                  <div key={tl.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{tl.name} <span className="font-normal text-slate-400 font-sans text-[10px]">({tl.count} {t(" موظف حالي")})</span></span>
                      <span className="font-bold font-mono text-we-purple">{tl.avgScore.toFixed(1)}%</span>
                    </div>
                    {/* Visual Progress Bar comparison */}
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          tl.avgScore >= targetsChat.finalScore ? "bg-we-purple" : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(tl.avgScore, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Coaching Alert Warnings */}
          <div className={`bg-white rounded-3xl border border-slate-100 p-6 space-y-3 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
            <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              {t("تنبيهات جودة الأداء وحالات الدعم الفني المطلوبة (Coaching Alerts)")}
            </h3>
            <p className="text-slate-400 text-xs">{t("مجموعة الموظفين الذين يقل معدلهم العام عن هدف العمل المخصص لخط العمل الخاص بهم وبحاجة لجلسات تطوير أداء:")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {monthStats.needsCoaching.length > 0 ? (
                monthStats.needsCoaching.map(r => (
                  <div key={r.id} className="p-3 bg-rose-50/50 border border-rose-100/30 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => setSelectedEmpId(r.id)}>
                    <span className="font-mono text-rose-700 font-bold text-xs">{t("التقييم")}: {r.score}%</span>
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <p className="font-semibold text-xs text-slate-800">{r.name}</p>
                      <span className="text-[9px] text-slate-400">ID: {r.id} • {r.tl.split(" ")[0]}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-6 text-emerald-600 font-semibold text-xs">
                  {t("👏 مذهل! لا يوجد موظف تحت خط المستهدف هذا الشهر. جميع الكوادر ناجحة ومستوفية للشروط!")}
                </div>
              )}
            </div>
          </div>

          {/* Individual Employee Performance Chart */}
          <AnimatePresence mode="wait">
            {empChartData && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-6 ${isRtl ? "text-right" : "text-left"}`} 
                dir={isRtl ? "rtl" : "ltr"}
              >
                <div className={`flex justify-between items-center mb-6 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h3 className={`text-slate-800 font-display font-bold text-sm flex items-center gap-2 ${isRtl ? "justify-end" : "justify-start"}`}>
                      <LineChartIcon className="w-5 h-5 text-we-purple" />
                      {t("مقارنة الأداء التاريخي للموظف")}
                    </h3>
                    <p className="text-slate-500 text-xs font-semibold mt-1">
                      {empChartData.name} <span className="font-mono text-[10px] text-slate-400">({empChartData.id})</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedEmpId(null)}
                    className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer"
                  >
                    {t("إغلاق المخطط")}
                  </button>
                </div>

                <div className="w-full h-[250px]" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={empChartData.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#512588" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#512588" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', textAlign: isRtl ? 'right' : 'left', fontSize: '12px', fontWeight: 'bold' }}
                        labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                        itemStyle={{ color: '#512588' }}
                        formatter={(value: number) => [`${value}%`, t("التقييم")]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#512588" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorScore)" 
                        activeDot={{ r: 6, fill: "#d11270", strokeWidth: 0 }}
                      />
                      <Area 
                        type="step" 
                        dataKey="target" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fill="none" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center items-center gap-6 mt-4 text-[10px] font-bold text-slate-500">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-we-purple"></div>{t("تقييم الموظف")}</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded border-b-2 border-dashed border-emerald-500"></div>{t("المستهدف المطلوب")}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Full Team Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
            <div className={`p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
              <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2">
                <Users className="w-5 h-5 text-we-purple" />
                {t("قائمة الفريق بالكامل")}
              </h3>
              <p className="text-slate-400 text-xs mr-2">{t("انقر على أي موظف لعرض المخطط البياني التاريخي لأدائه")}</p>
              <span className={`${isRtl ? "mr-auto" : "ml-auto"} bg-white px-3 py-1 rounded-full text-xs font-bold text-we-purple border border-slate-200`}>
                {monthStats.fullTeamList.length} {t(" موظف")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isRtl ? "text-right" : "text-left"}`}>
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="px-6 py-4 whitespace-nowrap">{t("الموظف")}</th>
                    <th className="px-6 py-4 whitespace-nowrap">{t("قائد الفريق")}</th>
                    <th className="px-6 py-4 whitespace-nowrap">{t("خط العمل (LOB)")}</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">AHT</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">CSI</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">NPS</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">{t("التقييم النهائي")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {monthStats.fullTeamList.map((emp) => (
                    <tr 
                      key={emp.id} 
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`transition-colors cursor-pointer ${
                        selectedEmpId === emp.id ? 'bg-purple-50/50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{emp.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.id}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">{emp.tl || t("غير محدد")}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold tracking-wider">
                          {emp.lob}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-medium text-slate-600 text-xs">{emp.aht}</td>
                      <td className="px-6 py-4 text-center font-mono font-medium text-blue-600 text-xs">{emp.csi}%</td>
                      <td className="px-6 py-4 text-center font-mono font-medium text-indigo-600 text-xs">{emp.nps}%</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                          emp.score >= emp.targetScore 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                            : "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          {emp.score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Safe PDF Export / Iframe Helper Modal */}
      {showIframeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-opacity">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative ${isRtl ? "text-right" : "text-left"}`}
            dir={isRtl ? "rtl" : "ltr"}
          >
            <button 
              onClick={() => setShowIframeModal(false)}
              className={`absolute top-4 ${isRtl ? "left-4" : "right-4"} p-1.5 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer`}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{t("تنبيه هام لتصدير التقرير PDF بنجاح")}</h3>
                <p className="text-[10px] text-slate-400 font-medium font-sans">{t("بسبب قيود المتصفح الأمنية داخل بيئة العرض التجريبية")}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-600">
              <p className="bg-amber-50 text-amber-800 p-3 rounded-2xl border border-amber-100 font-medium text-[11px] leading-relaxed">
                {t("عزيزي الموظف، نظراً لأنك تقوم باستعراض التطبيق داخل نافذة تجريبية مدمجة (iFrame) تابعة لمنصة التطوير، فإن المتصفح يمنع تشغيل الطباعة المباشرة تلقائياً للمحافظة على أمان الصفحة.")}
              </p>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 block">{t("خطوات بسيطة وسريعة لتصدير PDF:")}</span>
                <ul className="list-decimal list-inside space-y-1.5 pr-1 text-[11px]">
                  <li>{t("يرجى فتح التطبيق في")} <strong>{t("علامة تبويب جديدة مستقلة (Open App)")}</strong> {t("من الزر العلوي في شريط منصة AI Studio.")}</li>
                  <li>{t("أو خذ الرابط المباشر للمعاينة أدناه وافتحه في المتصفح الخاص بك:")}</li>
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
                  {t("نسخ الرابط")}
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                {t("بمجرد فتح الرابط في نافذة جديدة، اضغط على زر")} <span className="font-bold text-we-pink">"{t("تصدير PDF")}"</span> {t("مجدداً وسيفتح لك المتصفح خيارات الحفظ الفوري كملف PDF فائق ومثالي للطباعة!")}
              </p>
            </div>

            <div className={`mt-5 pt-3 border-t border-slate-100 flex gap-2 ${isRtl ? "justify-end" : "justify-start"}`}>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#512588] hover:bg-[#3d1968] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t("فتح التطبيق في نافذة مستقلة")}</span>
              </a>
              <button 
                onClick={() => setShowIframeModal(false)}
                type="button"
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                {t("إغلاق النافذة")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
