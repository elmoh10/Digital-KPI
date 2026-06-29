/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Employee, KPITargets, MonthlyPerformance, HistoricalTargets } from "../types";
import { useLanguage } from "../lib/LanguageContext";
import { 
  User, Phone, MapPin, Layers, Award, ShieldAlert, CheckCircle2, 
  HelpCircle, Calendar, TrendingUp, AlertTriangle, FileText, 
  ChevronRight, Users, Clock, Search, BarChart3, Star, Sparkles,
  Printer, X, ExternalLink
} from "lucide-react";
import { motion } from "motion/react";
import { MonthYearSelector } from "./MonthYearSelector";

interface EmployeeDashboardProps {
  employees: Employee[];
  targetsChat: KPITargets;
  targetsUniversal: KPITargets;
  historicalTargets?: HistoricalTargets;
}

// Helper: Convert AHT "MM:SS" to seconds
export function ahtToSeconds(aht: string): number {
  if (!aht || aht === "00:00") return 0;
  const parts = aht.split(":");
  if (parts.length !== 2) return 0;
  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  if (isNaN(mins) || isNaN(secs)) return 0;
  return mins * 60 + secs;
}

// Helper: Convert seconds to AHT "MM:SS"
export function secondsToAht(totalSecs: number): string {
  if (totalSecs <= 0) return "00:00";
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.round(totalSecs % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const MONTH_MAP: { [key: string]: number } = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

export function sortMonths(months: string[]): string[] {
  return [...months].sort((a, b) => {
    if (!a || !b) return 0;
    const [aMonth, aYear] = a.split("-");
    const [bMonth, bYear] = b.split("-");
    
    if (!aMonth || !aYear || !bMonth || !bYear) return 0;
    
    const yearA = parseInt(aYear, 10) || 0;
    const yearB = parseInt(bYear, 10) || 0;
    
    if (yearA !== yearB) {
      return yearA - yearB;
    }
    
    const monthA = MONTH_MAP[aMonth] || 0;
    const monthB = MONTH_MAP[bMonth] || 0;
    
    return monthA - monthB;
  });
}

export default function EmployeeDashboard({ employees, targetsChat, targetsUniversal, historicalTargets }: EmployeeDashboardProps) {
  const { t, isRtl } = useLanguage();
  // Base active employees (excluding leaders-only)
  const activeAgentEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (emp.isArchived) return false;
      if (emp.id.toString().startsWith("TL-") || emp.fullName.startsWith("تيم ليدر كود")) return false;
      if (emp.leaderPerformance !== undefined && emp.performance.length === 0) return false;
      return true;
    });
  }, [employees]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(activeAgentEmployees[0]?.id || "");
  const [activeTab, setActiveTab] = useState<"card" | "trend" | "sheet">("card");
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
    if (activeAgentEmployees.length > 0) {
      if (!selectedId || !activeAgentEmployees.some(emp => emp.id === selectedId)) {
        setSelectedId(activeAgentEmployees[0].id);
      }
    }
  }, [activeAgentEmployees, selectedId]);

  // Find current selected employee
  const currentEmployee = useMemo(() => {
    return employees.find(emp => emp.id === selectedId) || null;
  }, [employees, selectedId]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Dynamically resolve target thresholds based on the employee's LOB and active month
  const targets = useMemo(() => {
    let activeChat = targetsChat;
    let activeUniversal = targetsUniversal;

    if (historicalTargets && selectedMonth && historicalTargets[selectedMonth]) {
      activeChat = historicalTargets[selectedMonth].chat;
      activeUniversal = historicalTargets[selectedMonth].universal;
    }

    if (currentEmployee?.lob && !currentEmployee.lob.toLowerCase().includes("adsl")) {
      return activeUniversal;
    }
    return activeChat;
  }, [currentEmployee, targetsChat, targetsUniversal, historicalTargets, selectedMonth]);

  // List of unique months available in current employee data
  const availableMonths = useMemo(() => {
    if (!currentEmployee) return [];
    return sortMonths(currentEmployee.performance.map(p => p.month));
  }, [currentEmployee]);

  React.useEffect(() => {
    if (availableMonths.length > 0) {
      // Set to the latest month by default if not set or if previous month is not in list
      if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
        setSelectedMonth(availableMonths[availableMonths.length - 1]);
      }
    }
  }, [availableMonths, selectedMonth]);

  // Active month performance details
  const activePerformance = useMemo(() => {
    if (!currentEmployee || !selectedMonth) return null;
    return currentEmployee.performance.find(p => p.month === selectedMonth) || null;
  }, [currentEmployee, selectedMonth]);

  // Filter employees for search list
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return activeAgentEmployees.slice(0, 5);
    const query = searchQuery.toLowerCase();
    return activeAgentEmployees.filter(
      emp => 
        (emp.fullName && emp.fullName.toLowerCase().includes(query)) || 
        (emp.id && emp.id.toString().toLowerCase().includes(query))
    );
  }, [activeAgentEmployees, searchQuery]);

  // Calculate some cumulative stats for the selected employee
  const statsOverview = useMemo(() => {
    if (!currentEmployee || currentEmployee.performance.length === 0) return null;
    const perfList = currentEmployee.performance;
    
    let totalScore = 0;
    let totalCSI = 0;
    let totalNPS = 0;
    let totalAHTSecs = 0;
    let ahtCount = 0;
    
    perfList.forEach(p => {
      totalScore += p.finalScore;
      totalCSI += p.csi;
      totalNPS += p.nps;
      const secs = ahtToSeconds(p.aht);
      if (secs > 0) {
        totalAHTSecs += secs;
        ahtCount++;
      }
    });

    const avgScore = totalScore / perfList.length;
    const avgCSI = totalCSI / perfList.length;
    const avgNPS = totalNPS / perfList.length;
    const avgAHT = ahtCount > 0 ? totalAHTSecs / ahtCount : 0;

    return {
      avgScore,
      avgCSI,
      avgNPS,
      avgAHTStr: secondsToAht(avgAHT),
      historyCount: perfList.length
    };
  }, [currentEmployee]);

  // Met target checker
  const checkTarget = (metric: string, value: any): { met: boolean; text: string; color: string } => {
    switch (metric.toLowerCase()) {
      case "finalscore":
        return { 
          met: value >= targets.finalScore, 
          text: `${targets.finalScore}%`, 
          color: value >= targets.finalScore ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      case "csi":
        return { 
          met: value >= targets.csi, 
          text: `${targets.csi}%`, 
          color: value >= targets.csi ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      case "nps":
        return { 
          met: value >= targets.nps, 
          text: `${targets.nps}%`, 
          color: value >= targets.nps ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      case "fcr":
        return { 
          met: value >= targets.fcr, 
          text: `${targets.fcr}%`, 
          color: value >= targets.fcr ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      case "ttb":
        return { 
          met: value >= targets.ttb, 
          text: `${targets.ttb}%`, 
          color: value >= targets.ttb ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      case "ctc":
        return { 
          met: value >= targets.ctc, 
          text: `${targets.ctc}%`, 
          color: value >= targets.ctc ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      case "ctb":
        return { 
          met: value >= targets.ctb, 
          text: `${targets.ctb}%`, 
          color: value >= targets.ctb ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      case "aht":
        const actualSecs = ahtToSeconds(value);
        const targetSecs = targets.ahtSeconds;
        // For AHT, lower is better. 00:00 means not logged/excused
        const metAht = actualSecs === 0 || actualSecs <= targetSecs;
        return { 
          met: metAht, 
          text: secondsToAht(targetSecs), 
          color: metAht ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      case "absent":
        // Lower or equal is better
        return { 
          met: value <= targets.absent, 
          text: `${targets.absent}`, 
          color: value <= targets.absent ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50" 
        };
      default:
        return { met: true, text: "-", color: "text-slate-500 bg-slate-50" };
    }
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 ${isRtl ? "text-right" : "text-left"}`} id="kpi-main-grid" dir={isRtl ? "rtl" : "ltr"}>
      {/* Search Sidebar Column */}
      <div className="lg:col-span-4 space-y-6" id="kpi-search-column">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6" id="kpi-search-box">
          <h2 className={`text-lg font-display font-semibold text-slate-800 mb-4 flex items-center gap-2 font-black ${isRtl ? "flex-row" : "flex-row-reverse justify-end"}`}>
            <Search className="w-5 h-5 text-we-pink" />
            {t("البحث عن موظف")}
          </h2>
          
          <div className="relative mb-5">
            <input
              type="text"
              placeholder={t("اكتب اسم الموظف أو الكود (ID) ...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRtl ? "pr-10 pl-4 text-right" : "pl-10 pr-4 text-left"} py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-we-purple text-sm font-sans`}
              dir={isRtl ? "rtl" : "ltr"}
            />
            <Search className={`absolute top-3.5 w-5 h-5 text-slate-400 ${isRtl ? "right-3.5 left-auto" : "left-3.5 right-auto"}`} />
          </div>

          <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1" id="kpi-employee-list">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setSelectedId(emp.id);
                    setSearchQuery("");
                  }}
                  className={`w-full p-4 rounded-2xl border transition-all flex justify-between items-center ${isRtl ? "text-right" : "text-left"} ${
                    selectedId === emp.id
                      ? "bg-we-purple text-white border-we-purple shadow-md"
                      : "bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-transparent"
                  }`}
                  dir={isRtl ? "rtl" : "ltr"}
                  id={`emp-btn-${emp.id}`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-sm truncate">{emp.fullName}</p>
                    <div className={`flex items-center gap-2 mt-1 text-xs opacity-80 font-mono ${isRtl ? "flex-row" : "flex-row-reverse justify-end"}`}>
                      <span>ID: {emp.id}</span>
                      <span>•</span>
                      <span>{emp.newTL ? emp.newTL.split(" ")[0] : t("بدون ليدر")}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 ml-1 transition-transform ${selectedId === emp.id ? "rotate-90 text-we-pink" : "text-slate-400"} ${isRtl ? "" : "rotate-180"}`} />
                </button>
              ))
            ) : (
              <p className="text-center text-slate-400 text-sm py-8" dir={isRtl ? "rtl" : "ltr"}>
                {t("لا توجد نتائج مطابقة لبحثك.")}
              </p>
            )}
          </div>
        </div>

        {/* Selected Employee Quick Card */}
        {currentEmployee && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
            id="employee-quick-card"
          >
            <div className={`bg-slate-900 p-6 text-white relative overflow-hidden ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-slate-800 rounded-full opacity-40 blur-xl"></div>
              <div className="relative z-10">
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/30 font-medium">
                  {currentEmployee.lob}
                </span>
                <h3 className="font-display font-bold text-xl mt-3 leading-tight tracking-tight">
                  {currentEmployee.fullName}
                </h3>
                <p className="text-slate-400 font-mono text-sm mt-1">ID: {currentEmployee.id}</p>
              </div>
            </div>

            <div className={`p-6 space-y-4 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                <div className={`flex items-center gap-2 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 text-xs">{t("قائد الفريق (TL)")}</span>
                </div>
                <span className="font-semibold text-slate-700 text-sm">{currentEmployee.newTL}</span>
              </div>

              <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                <div className={`flex items-center gap-2 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 text-xs">{t("المشرف (SV)")}</span>
                </div>
                <span className="font-semibold text-slate-700 text-sm">{currentEmployee.newSV}</span>
              </div>

              <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                <div className={`flex items-center gap-2 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 text-xs">{t("رقم الهاتف")}</span>
                </div>
                <span className="font-mono text-slate-700 text-xs">{currentEmployee.mobileNumber || "-"}</span>
              </div>

              <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                <div className={`flex items-center gap-2 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 text-xs">{t("رقم الهوية")}</span>
                </div>
                <span className="font-mono text-slate-700 text-xs">{currentEmployee.nationalId || "-"}</span>
              </div>

              <div className="flex justify-between items-center pt-2.5">
                <div className={`flex items-center gap-2 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 text-xs">{t("مقر العمل")}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  currentEmployee.location === "WFH" 
                    ? "bg-sky-50 text-sky-600 border border-sky-100" 
                    : (currentEmployee.location === "NC" ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100")
                }`}>
                  {currentEmployee.location === "WFH" ? t("العمل من المنزل (WFH)") : (currentEmployee.location === "NC" ? t("مقر مدينة نصر (NC)") : t("مقر الدقي (Dokki)"))}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main KPI Dashboard Area */}
      <div className="lg:col-span-8 space-y-6" id="kpi-dashboard-area">
        {!currentEmployee ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm animate-pulse" id="no-employee" dir={isRtl ? "rtl" : "ltr"}>
            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-display font-medium text-slate-700 mb-2">{t("الرجاء اختيار أحد الموظفين")}</h3>
            <p className="text-slate-400 text-sm">{t("استعمل قائمة البحث في الجانب الأيمن لاستعراض تفاصيل أدائه")}</p>
          </div>
        ) : (
          <div id="pdf-export-content">
            {/* Print Header Section (Visible only during printing / PDF generation) */}
            <div className={`hidden print:block mb-6 border-b-2 border-slate-900 pb-5 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"} id="pdf-print-header">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 font-display">{t("تقرير الأداء والتقييم الفردي للموظف")}</h1>
                  <p className="text-xs text-slate-500 mt-1">{t("بوابة تقييم الكفاءات والأداء الرقمي لقطاع الدعم الفني والدردشة - المصرية للاتصالات")}</p>
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
                  <span className="text-slate-400 font-normal">{t("الاسم:")}</span>
                  <span className="text-slate-900 font-black">{currentEmployee.fullName}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">{t("كود الموظف:")}</span>
                  <span className="text-slate-900 font-mono font-bold">{currentEmployee.id}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">{t("قائد الفريق (TL)")}:</span>
                  <span className="text-slate-900">{currentEmployee.newTL}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">{t("المشرف (SV)")}:</span>
                  <span className="text-slate-950">{currentEmployee.newSV}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">{t("قطاع العمل:")}</span>
                  <span className="text-slate-900">{currentEmployee.lob}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-normal">{t("الشهر المراد عرضه:")}</span>
                  <span className="text-slate-900 font-mono font-bold">{selectedMonth || "-"}</span>
                </div>
              </div>
            </div>

            {/* Control Bar: Month picker & Tab picker */}
            <div className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4`} id="kpi-control-bar">
              {/* Tab Selector */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto" id="view-tabs">
                <button
                  onClick={() => setActiveTab("sheet")}
                  className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "sheet" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t("كارت الأداء التاريخي (Excel)")}
                </button>
                <button
                  onClick={() => setActiveTab("trend")}
                  className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "trend" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t("المنحنيات والتحليلات")}
                </button>
                <button
                  onClick={() => setActiveTab("card")}
                  className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "card" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t("لوحة الأداء الشهري")}
                </button>
              </div>

              {/* Month Selector dropdown & Print button */}
              <div className={`flex items-center gap-3 w-full md:w-auto justify-end flex-wrap`} dir={isRtl ? "rtl" : "ltr"} id="month-selector-group">
                <button
                  onClick={handlePrintPdf}
                  className="bg-gradient-to-r from-we-pink to-we-pink-light hover:brightness-110 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all no-print shrink-0"
                  id="print-pdf-report-btn"
                  title={t("تصدير الصفحة الحالية لملف PDF")}
                >
                  <Printer className="w-4 h-4" />
                  <span>{t("تصدير PDF")}</span>
                </button>

                <div className="h-4 w-px bg-slate-200 no-print" />

                <Calendar className="w-5 h-5 text-we-pink shrink-0" />
                <span className="text-slate-500 text-xs font-bold">{t("الشهر المراد عرضه:")}</span>
                <MonthYearSelector
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  className="w-48"
                />
              </div>
            </div>

            {/* View Container */}
            <div className="space-y-6" id="dashboard-tab-content">
              
              {/* TAB 1: LOAHA ALDAA ALSHAHRI (Monthly KPIs Cards) */}
              {activeTab === "card" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                  id="tab-monthly-performance"
                >
                  {activePerformance ? (
                    <>
                      {/* KPI Progress Top Panel */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Radial Gauge Card */}
                        <div className="md:col-span-5 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col items-center justify-center text-center">
                          <h4 className="text-slate-500 text-xs font-semibold mb-4" dir={isRtl ? "rtl" : "ltr"}>{t("التقييم العام النهائي - ")}{selectedMonth}</h4>
                          <div className="relative w-36 h-36 flex items-center justify-center">
                            {/* SVG Circle Track */}
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke="#f1f5f9"
                                strokeWidth="8"
                              />
                              <motion.circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke={activePerformance.finalScore >= targets.finalScore ? "#10b981" : "#f59e0b"}
                                strokeWidth="8"
                                strokeDasharray="251.2"
                                initial={{ strokeDashoffset: 251.2 }}
                                animate={{ strokeDashoffset: 251.2 - (251.2 * Math.min(activePerformance.finalScore, 100)) / 100 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                              />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                              <span className="text-3xl font-bold text-slate-800 font-mono">{activePerformance.finalScore}%</span>
                              <span className="text-[10px] text-slate-400 mt-0.5" dir={isRtl ? "rtl" : "ltr"}>{t("الهدف:")} {targets.finalScore}%</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex items-center gap-1.5" dir={isRtl ? "rtl" : "ltr"}>
                            {activePerformance.finalScore >= targets.finalScore ? (
                              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-semibold">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{t("متخطي الهدف (ناجح)")}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-semibold">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{t("أقل من النسبة المطلوبة")}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Targets Overview */}
                        <div className={`md:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <h4 className={`text-slate-800 font-display font-semibold text-sm mb-4 flex items-center gap-2 ${isRtl ? "justify-end flex-row" : "justify-start flex-row-reverse"}`}>
                            <Sparkles className="w-4 h-4 text-emerald-500" />
                            {t("ملخص أداء الشهر الحالي")}
                          </h4>
                          <p className="text-slate-500 text-xs leading-relaxed mb-4">
                            {isRtl ? (
                              <>
                                الموظف <strong>{currentEmployee.fullName}</strong> حقق تقييماً إجمالياً بقدره <strong>{activePerformance.finalScore}%</strong> خلال شهر <strong>{selectedMonth}</strong> مقارنة بالهدف المطلوب لمشروع الـ {currentEmployee.lob}. وفيما يلي قراءات أداء مؤشرات الجودة والدعم الفني:
                              </>
                            ) : (
                              <>
                                The employee <strong>{currentEmployee.fullName}</strong> achieved an overall evaluation score of <strong>{activePerformance.finalScore}%</strong> during the month of <strong>{selectedMonth}</strong> compared to the target required for the {currentEmployee.lob} project. Below are the quality and technical support performance metrics:
                              </>
                            )}
                          </p>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3 rounded-2xl flex flex-col justify-between">
                              <span className="text-slate-400 text-[10px] block">{t("سرعة الرد الإجمالية (AHT)")}</span>
                              <span className="text-slate-800 font-bold text-base font-mono mt-1">{activePerformance.aht}</span>
                              <span className="text-slate-400 text-[9px] mt-0.5">{t("الهدف:")} {secondsToAht(targets.ahtSeconds)}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl flex flex-col justify-between">
                              <span className="text-slate-400 text-[10px] block">{t("رضا العملاء (CSI)")}</span>
                              <span className="text-slate-800 font-bold text-base font-mono mt-1">{activePerformance.csi}%</span>
                              <span className="text-slate-400 text-[9px] mt-0.5">{t("الهدف:")} {targets.csi}%</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl flex flex-col justify-between">
                              <span className="text-slate-400 text-[10px] block">{t("مؤشر التوصية (NPS)")}</span>
                              <span className="text-slate-800 font-bold text-base font-mono mt-1">{activePerformance.nps}%</span>
                              <span className="text-slate-400 text-[9px] mt-0.5">{t("الهدف:")} {targets.nps}%</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl flex flex-col justify-between">
                              <span className="text-slate-400 text-[10px] block">{t("حل الشكوى أول مرة (FCR)")}</span>
                              <span className="text-slate-800 font-bold text-base font-mono mt-1">{activePerformance.fcr}%</span>
                              <span className="text-slate-400 text-[9px] mt-0.5">{t("الهدف:")} {targets.fcr}%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Main KPI Details Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-6" id="kpi-cards-grid">
                        
                        {/* CSI Card */}
                        <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <div className="flex justify-between items-start">
                            <span className={`px-2.5 py-1 text-[10px] rounded-full font-semibold ${checkTarget("csi", activePerformance.csi).color}`}>
                              {t("الهدف:")} {targets.csi}%
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">{t("CSI (رضا العملاء)")}</span>
                          </div>
                          <p className="text-2xl font-bold font-mono text-slate-800">{activePerformance.csi}%</p>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${activePerformance.csi >= targets.csi ? "bg-emerald-500" : "bg-rose-500"}`} 
                              style={{ width: `${Math.min(activePerformance.csi, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* NPS Card */}
                        <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <div className="flex justify-between items-start">
                            <span className={`px-2.5 py-1 text-[10px] rounded-full font-semibold ${checkTarget("nps", activePerformance.nps).color}`}>
                              {t("الهدف:")} {targets.nps}%
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">{t("NPS (مؤشر التوصية)")}</span>
                          </div>
                          <p className="text-2xl font-bold font-mono text-slate-800">{activePerformance.nps}%</p>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${activePerformance.nps >= targets.nps ? "bg-emerald-500" : "bg-rose-500"}`} 
                              style={{ width: `${Math.max(0, Math.min(activePerformance.nps, 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* FCR Card */}
                        <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <div className="flex justify-between items-start">
                            <span className={`px-2.5 py-1 text-[10px] rounded-full font-semibold ${checkTarget("fcr", activePerformance.fcr).color}`}>
                              {t("الهدف:")} {targets.fcr}%
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">{t("FCR (حل من أول مرة)")}</span>
                          </div>
                          <p className="text-2xl font-bold font-mono text-slate-800">{activePerformance.fcr}%</p>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${activePerformance.fcr >= targets.fcr ? "bg-emerald-500" : "bg-rose-500"}`} 
                              style={{ width: `${Math.min(activePerformance.fcr, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* TTB Card */}
                        <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <div className="flex justify-between items-start">
                            <span className={`px-2.5 py-1 text-[10px] rounded-full font-semibold ${checkTarget("ttb", activePerformance.ttb).color}`}>
                              {t("الهدف:")} {targets.ttb}%
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">{t("TTB (أعلى نتيجتين)")}</span>
                          </div>
                          <p className="text-2xl font-bold font-mono text-slate-800">{activePerformance.ttb}%</p>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${activePerformance.ttb >= targets.ttb ? "bg-emerald-500" : "bg-rose-500"}`} 
                              style={{ width: `${Math.min(activePerformance.ttb, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* AHT Card */}
                        <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <div className="flex justify-between items-start">
                            <span className={`px-2.5 py-1 text-[10px] rounded-full font-semibold ${checkTarget("aht", activePerformance.aht).color}`}>
                              {t("الهدف:")} {secondsToAht(targets.ahtSeconds)}
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">{t("AHT (وقت المعالجة)")}</span>
                          </div>
                          <p className="text-2xl font-bold font-mono text-slate-800">{activePerformance.aht}</p>
                          <span className="text-[10px] text-slate-400 block mt-1">{t("كلما قل الوقت تحسن الأداء")}</span>
                        </div>

                        {/* CTC (Critical to Customer) Card */}
                        <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <div className="flex justify-between items-start">
                            <span className={`px-2.5 py-1 text-[10px] rounded-full font-semibold ${checkTarget("ctc", activePerformance.ctc).color}`}>
                              {t("الهدف:")} {targets.ctc}%
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">{t("CTC (أهمية للعميل)")}</span>
                          </div>
                          <p className="text-2xl font-bold font-mono text-slate-800">{activePerformance.ctc}%</p>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${activePerformance.ctc >= targets.ctc ? "bg-emerald-500" : "bg-rose-500"}`} 
                              style={{ width: `${Math.min(activePerformance.ctc, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* CTB (Critical to Business) Card */}
                        <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <div className="flex justify-between items-start">
                            <span className={`px-2.5 py-1 text-[10px] rounded-full font-semibold ${checkTarget("ctb", activePerformance.ctb).color}`}>
                              {t("الهدف:")} {targets.ctb}%
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">{t("CTB (أهمية للعمل)")}</span>
                          </div>
                          <p className="text-2xl font-bold font-mono text-slate-800">{activePerformance.ctb}%</p>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${activePerformance.ctb >= targets.ctb ? "bg-emerald-500" : "bg-rose-500"}`} 
                              style={{ width: `${Math.min(activePerformance.ctb, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Attendance Leaves Quick Overview */}
                        <div className={`bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4 md:col-span-2 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"}>
                          <span className="text-slate-400 text-xs font-semibold block">{t("مؤشرات الحضور والغياب (Leaves)")}</span>
                          
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-slate-50 p-2.5 rounded-xl">
                              <span className="text-[10px] text-slate-400 block">{t("غياب")}</span>
                              <span className={`font-mono font-bold text-sm block mt-1 ${activePerformance.absent > 0 ? "text-rose-600" : "text-slate-700"}`}>
                                {activePerformance.absent}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-xl">
                              <span className="text-[10px] text-slate-400 block">{t("مرضي")}</span>
                              <span className={`font-mono font-bold text-sm block mt-1 ${activePerformance.sick > 0 ? "text-slate-600" : "text-slate-700"}`}>
                                {activePerformance.sick}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-xl">
                              <span className="text-[10px] text-slate-400 block">{t("طارئ")}</span>
                              <span className="font-mono font-bold text-sm text-slate-700 block mt-1">
                                {activePerformance.emergency}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-xl">
                              <span className="text-[10px] text-slate-400 block">{t("غير مخطط")}</span>
                              <span className={`font-mono font-bold text-sm block mt-1 ${activePerformance.unplanned > 0 ? "text-amber-600" : "text-slate-700"}`}>
                                {activePerformance.unplanned}
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm" id="no-month-perf">
                      <p className="text-slate-400 text-sm">{t("لم تسجل بيانات لهذا الشهر بعد")}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB 2: ALMENHANYAT (Analytical Trends with pure SVG charts) */}
              {activeTab === "trend" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                  id="tab-trend-performance"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Final Score Trend Curve */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6" dir={isRtl ? "rtl" : "ltr"}>
                      <h3 className={`text-slate-800 font-display font-semibold text-sm mb-4 flex items-center gap-2 font-bold ${isRtl ? "flex-row" : "flex-row-reverse justify-end"}`}>
                        <TrendingUp className="w-5 h-5 text-we-purple" />
                        {t("منحنى تطور التقييم النهائي (%) عبر الأشهر")}
                      </h3>

                      <div className="h-64 w-full relative mt-4">
                        {currentEmployee.performance.length < 2 ? (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                            {t("تحتاج إلى إدخال بيانات شهرين على الأقل لرسم المنحنى")}
                          </div>
                        ) : (
                          // Render full custom beautiful SVG line chart
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 220">
                            {/* Grid Lines */}
                            <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeDasharray="4 4" />
                            <line x1="40" y1="70" x2="480" y2="70" stroke="#f1f5f9" strokeDasharray="4 4" />
                            <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeDasharray="4 4" />
                            <line x1="40" y1="170" x2="480" y2="170" stroke="#f1f5f9" strokeDasharray="4 4" />
                            <line x1="40" y1="170" x2="480" y2="170" stroke="#cbd5e1" strokeWidth="1" />

                            {/* Target reference line (52%) */}
                            {(() => {
                              const targetY = 170 - (targets.finalScore * 150) / 100;
                              return (
                                <>
                                  <line x1="40" y1={targetY} x2="480" y2={targetY} stroke="#10b981" strokeWidth="1.5" strokeDasharray="5 3" />
                                  <text x="490" y={targetY + 4} fill="#10b981" fontSize="9" className="font-mono text-left" dir="ltr">
                                    Target ({targets.finalScore}%)
                                  </text>
                                </>
                              );
                            })()}

                            {/* Score Points and Path */}
                            {(() => {
                              const points = currentEmployee.performance.map((p, idx) => {
                                const totalSteps = currentEmployee.performance.length - 1;
                                const x = 40 + (idx / totalSteps) * 440;
                                // Map 0% - 100% to Y=170 to Y=20 (height range = 150)
                                const y = 170 - (p.finalScore * 150) / 100;
                                return { x, y, val: p.finalScore, month: p.month };
                              });

                              let pathD = `M ${points[0].x} ${points[0].y}`;
                              for (let i = 1; i < points.length; i++) {
                                pathD += ` L ${points[i].x} ${points[i].y}`;
                              }

                              return (
                                <>
                                  {/* Area under line */}
                                  <path
                                    d={`${pathD} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`}
                                    fill="url(#score-gradient)"
                                    opacity="0.1"
                                  />
                                  {/* Main Path Line */}
                                  <path d={pathD} fill="none" stroke="#4c005c" strokeWidth="2.5" />

                                  {/* Dots on nodes */}
                                  {points.map((pt, i) => (
                                    <g key={i}>
                                      <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r="4"
                                        fill="#fff"
                                        stroke="#4c005c"
                                        strokeWidth="2"
                                        className="cursor-pointer hover:r-6 hover:fill-we-pink transition-all"
                                      />
                                      {/* Text on nodes */}
                                      <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="#334155" fontSize="9" className="font-mono font-semibold">
                                        {pt.val}%
                                      </text>
                                      {/* X-axis Month Label */}
                                      <text x={pt.x} y="195" textAnchor="middle" fill="#64748b" fontSize="8" className="font-mono">
                                        {pt.month}
                                      </text>
                                    </g>
                                  ))}

                                  <defs>
                                    <linearGradient id="score-gradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#4c005c" />
                                      <stop offset="100%" stopColor="#4c005c" stopOpacity="0" />
                                    </linearGradient>
                                  </defs>
                                </>
                              );
                            })()}
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* CSI & NPS Trend Dual Chart */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6" dir={isRtl ? "rtl" : "ltr"}>
                      <h3 className={`text-slate-800 font-display font-semibold text-sm mb-4 flex items-center gap-2 font-bold ${isRtl ? "flex-row" : "flex-row-reverse justify-end"}`}>
                        <BarChart3 className="w-5 h-5 text-we-purple" />
                        {t("مقارنة مؤشرات رضا العملاء (CSI) و (NPS) شهرياً")}
                      </h3>

                      <div className="h-64 w-full relative mt-4">
                        {currentEmployee.performance.length < 2 ? (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                            {t("تحتاج لبيانات شهرين على الأقل لإظهار المقارنة")}
                          </div>
                        ) : (
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 220">
                            <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeDasharray="4 4" />
                            <line x1="40" y1="70" x2="480" y2="70" stroke="#f1f5f9" strokeDasharray="4 4" />
                            <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeDasharray="4 4" />
                            <line x1="40" y1="170" x2="480" y2="170" stroke="#f1f5f9" strokeDasharray="4 4" />
                            <line x1="40" y1="170" x2="480" y2="170" stroke="#cbd5e1" strokeWidth="1" />

                            {(() => {
                              const points = currentEmployee.performance.map((p, idx) => {
                                const totalSteps = currentEmployee.performance.length - 1;
                                const x = 40 + (idx / totalSteps) * 440;
                                // CSI and NPS are percentage, map NPS (can be negative, e.g. -10 to 100)
                                const csiY = 170 - (p.csi * 150) / 100;
                                // For NPS, clamp negative values to 0 on the coordinate system for simplicity
                                const clampedNps = Math.max(0, p.nps);
                                const npsY = 170 - (clampedNps * 150) / 100;
                                return { x, csiY, npsY, csi: p.csi, nps: p.nps, month: p.month };
                              });

                              return (
                                <>
                                  {/* CSI Path */}
                                  {(() => {
                                    let pathD = `M ${points[0].x} ${points[0].csiY}`;
                                    for (let i = 1; i < points.length; i++) pathD += ` L ${points[i].x} ${points[i].csiY}`;
                                    return <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="2 1" />;
                                  })()}

                                  {/* NPS Path */}
                                  {(() => {
                                    let pathD = `M ${points[0].x} ${points[0].npsY}`;
                                    for (let i = 1; i < points.length; i++) pathD += ` L ${points[i].x} ${points[i].npsY}`;
                                    return <path d={pathD} fill="none" stroke="#db2777" strokeWidth="2.5" />;
                                  })()}

                                  {/* Nodes */}
                                  {points.map((pt, i) => (
                                    <g key={i}>
                                      {/* CSI dot */}
                                      <circle cx={pt.x} cy={pt.csiY} r="3" fill="#2563eb" />
                                      {/* NPS dot */}
                                      <circle cx={pt.x} cy={pt.npsY} r="3" fill="#db2777" />
                                      {/* Text CSI */}
                                      <text x={pt.x} y={pt.csiY - 6} textAnchor="middle" fill="#2563eb" fontSize="7" className="font-mono">
                                        {pt.csi}%
                                      </text>
                                      {/* Text NPS */}
                                      <text x={pt.x} y={pt.npsY + 12} textAnchor="middle" fill="#db2777" fontSize="7" className="font-mono">
                                        {pt.nps}%
                                      </text>
                                      {/* X bottom Label */}
                                      <text x={pt.x} y="195" textAnchor="middle" fill="#64748b" fontSize="8" className="font-mono">
                                        {pt.month}
                                      </text>
                                    </g>
                                  ))}
                                </>
                              );
                            })()}
                          </svg>
                        )}
                      </div>

                      {/* Legend */}
                      <div className="flex justify-center gap-6 mt-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-0.5 bg-blue-600 inline-block border-t border-dashed"></span>
                          <span className="font-semibold text-slate-700">{t("رضا العملاء CSI")}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-1 bg-pink-600 inline-block"></span>
                          <span className="font-semibold text-slate-700">{t("مؤشر التوصية NPS")}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Quality and Leaves Trend Summary */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6" dir={isRtl ? "rtl" : "ltr"}>
                    <h3 className={`text-slate-800 font-display font-semibold text-sm mb-4 ${isRtl ? "text-right" : "text-left"}`}>
                      {t("متوسط الأداء التاريخي لهذا الموظف")}
                    </h3>
                    {statsOverview && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <span className="text-slate-400 text-xs block">{t("معدل التقييم التراكمي")}</span>
                          <span className="text-xl font-bold font-mono text-we-purple block mt-1">
                            {statsOverview.avgScore.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 block">{t("مقارنة بالهدف")} ({targets.finalScore}%)</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <span className="text-slate-400 text-xs block">{t("متوسط وقت المعالجة (AHT)")}</span>
                          <span className="text-xl font-bold font-mono text-slate-700 block mt-1">
                            {statsOverview.avgAHTStr}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 block">{t("الهدف المطلوب:")} {secondsToAht(targets.ahtSeconds)}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <span className="text-slate-400 text-xs block">{t("متوسط رضا العملاء (CSI)")}</span>
                          <span className="text-xl font-bold font-mono text-blue-600 block mt-1">
                            {statsOverview.avgCSI.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 block">{t("مقارنة بالهدف")} ({targets.csi}%)</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <span className="text-slate-400 text-xs block">{t("عدد الأشهر المسجلة")}</span>
                          <span className="text-xl font-bold font-mono text-slate-700 block mt-1">
                            {statsOverview.historyCount} {t("شهر")}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 block">{t("تاريخ رصد الأداء المتواصل")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 3: MASTER EXCEL SCORECARD TABLE COPY */}
              {activeTab === "sheet" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden"
                  id="tab-excel-sheet"
                >
                  <div className={`flex justify-between items-center mb-4 ${isRtl ? "flex-row-reverse" : "flex-row"}`} dir={isRtl ? "rtl" : "ltr"}>
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <h3 className="text-slate-800 font-display font-semibold text-sm">{t("كارت الأداء التفصيلي الشامل")}</h3>
                      <p className="text-slate-400 text-xs mt-0.5">{t("مطابق تماماً لنموذج كشف شيت الاكسيل لمشروعات الشات والدعم الفني")}</p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-600 text-xs px-3 py-1.5 rounded-full border border-emerald-500/20 font-semibold" dir={isRtl ? "rtl" : "ltr"}>
                      {t("التقييم التراكمي:")} {statsOverview?.avgScore.toFixed(0)}%
                    </span>
                  </div>

                  {/* Responsive Excel Table wrapper */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl" id="excel-table-scroll">
                    <table className="w-full text-center border-collapse text-xs font-mono" dir={isRtl ? "rtl" : "ltr"}>
                      <thead>
                        {/* Primary Dark Headers */}
                        <tr className="bg-slate-900 text-white font-sans text-[11px]">
                          <th className={`py-3 px-3 border-r border-[#334155] font-medium sticky ${isRtl ? "right-0" : "left-0"} bg-slate-900 z-10`}>{t("المؤشرات (KPIs)")}</th>
                          {currentEmployee.performance.map((p) => (
                            <th key={p.month} className="py-3 px-2 border-r border-[#334155] font-semibold min-w-[70px] bg-slate-850">
                              {p.month}
                            </th>
                          ))}
                          <th className="py-3 px-3 bg-emerald-700 text-white font-semibold min-w-[70px]">{t("الهدف")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* AHT Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-slate-800 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("AHT (سرعة المعالجة)")}</td>
                          {currentEmployee.performance.map((p) => {
                            const isMet = checkTarget("aht", p.aht).met;
                            return (
                              <td key={p.month} className={`py-3 px-2 border-r border-slate-200 font-bold ${isMet ? "text-slate-700" : "text-rose-600 bg-rose-50/20"}`}>
                                {p.aht}
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">{secondsToAht(targets.ahtSeconds)}</td>
                        </tr>

                        {/* CSI Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-slate-800 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("CSI (رضا العملاء)")}</td>
                          {currentEmployee.performance.map((p) => {
                            const isMet = checkTarget("csi", p.csi).met;
                            return (
                              <td key={p.month} className={`py-3 px-2 border-r border-slate-200 ${isMet ? "text-slate-700" : "text-rose-600 bg-rose-50/30 font-bold"}`}>
                                {p.csi}%
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">{targets.csi}%</td>
                        </tr>

                        {/* NPS Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-slate-800 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("NPS (مؤشر التوصية)")}</td>
                          {currentEmployee.performance.map((p) => {
                            const isMet = checkTarget("nps", p.nps).met;
                            return (
                              <td key={p.month} className={`py-3 px-2 border-r border-slate-200 ${isMet ? "text-slate-700" : "text-rose-600 bg-rose-50/30 font-bold"}`}>
                                {p.nps}%
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">{targets.nps}%</td>
                        </tr>

                        {/* FCR Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-slate-800 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("FCR (الحل الأول)")}</td>
                          {currentEmployee.performance.map((p) => {
                            const isMet = checkTarget("fcr", p.fcr).met;
                            return (
                              <td key={p.month} className={`py-3 px-2 border-r border-slate-200 ${isMet ? "text-slate-700" : "text-rose-600 bg-rose-50/30 font-bold"}`}>
                                {p.fcr}%
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">{targets.fcr}%</td>
                        </tr>

                        {/* TTB Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-slate-800 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("TTB (أعلى نتيجتين)")}</td>
                          {currentEmployee.performance.map((p) => {
                            const isMet = checkTarget("ttb", p.ttb).met;
                            return (
                              <td key={p.month} className={`py-3 px-2 border-r border-slate-200 ${isMet ? "text-slate-700" : "text-rose-600 bg-rose-50/30 font-bold"}`}>
                                {p.ttb}%
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">{targets.ttb}%</td>
                        </tr>

                        {/* CTC Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-slate-800 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("CTC (أهمية للعميل)")}</td>
                          {currentEmployee.performance.map((p) => {
                            const isMet = checkTarget("ctc", p.ctc).met;
                            return (
                              <td key={p.month} className={`py-3 px-2 border-r border-slate-200 ${isMet ? "text-slate-700" : "text-rose-600 bg-rose-50/30 font-bold"}`}>
                                {p.ctc}%
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">{targets.ctc}%</td>
                        </tr>

                        {/* CTB Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-slate-800 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("CTB (أهمية للشركة)")}</td>
                          {currentEmployee.performance.map((p) => {
                            const isMet = checkTarget("ctb", p.ctb).met;
                            return (
                              <td key={p.month} className={`py-3 px-2 border-r border-slate-200 ${isMet ? "text-slate-700" : "text-rose-600 bg-rose-50/30 font-bold"}`}>
                                {p.ctb}%
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">{targets.ctb}%</td>
                        </tr>

                        {/* Absent Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-indigo-900 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("Absent (الغياب أيام)")}</td>
                          {currentEmployee.performance.map((p) => (
                            <td key={p.month} className={`py-3 px-2 border-r border-slate-200 font-medium ${p.absent > 0 ? "text-rose-600 font-bold bg-rose-50/20" : "text-slate-500"}`}>
                              {p.absent}
                            </td>
                          ))}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">{targets.absent}</td>
                        </tr>

                        {/* Sick Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-indigo-900 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("Sick (المرضي)")}</td>
                          {currentEmployee.performance.map((p) => (
                            <td key={p.month} className={`py-3 px-2 border-r border-slate-200 font-medium ${p.sick > 0 ? "text-amber-600 bg-amber-50/10" : "text-slate-500"}`}>
                              {p.sick}
                            </td>
                          ))}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">5%</td>
                        </tr>

                        {/* Emergency Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-indigo-900 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("Emergency (الطارئ)")}</td>
                          {currentEmployee.performance.map((p) => (
                            <td key={p.month} className="py-3 px-2 border-r border-slate-200 text-slate-500 font-medium">
                              {p.emergency}
                            </td>
                          ))}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">5%</td>
                        </tr>

                        {/* Unplanned Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className={`py-3 px-3 ${isRtl ? "text-right" : "text-left"} font-sans font-semibold text-indigo-900 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("Unplanned (غير المخطط)")}</td>
                          {currentEmployee.performance.map((p) => (
                            <td key={p.month} className={`py-3 px-2 border-r border-slate-200 font-medium ${p.unplanned > 0 ? "text-amber-600 bg-amber-50/10" : "text-slate-500"}`}>
                              {p.unplanned}
                            </td>
                          ))}
                          <td className="py-3 px-3 bg-emerald-50 text-emerald-800 font-bold border-l border-emerald-100">3%</td>
                        </tr>

                        {/* Final Score Row */}
                        <tr className="bg-indigo-50/60 font-sans border-t border-slate-300">
                          <td className={`py-4 px-3 ${isRtl ? "text-right" : "text-left"} font-display font-black text-slate-900 border-r border-slate-200 sticky ${isRtl ? "right-0" : "left-0"} bg-indigo-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>{t("Final Score (التقييم العام)")}</td>
                          {currentEmployee.performance.map((p) => {
                            const isMet = checkTarget("finalscore", p.finalScore).met;
                            return (
                              <td key={p.month} className={`py-4 px-2 border-r border-slate-200 text-sm font-black font-mono ${isMet ? "text-emerald-700 bg-emerald-50/20" : "text-rose-700 bg-rose-50/30"}`}>
                                {p.finalScore}%
                              </td>
                            );
                          })}
                          <td className="py-4 px-3 bg-emerald-700 text-white font-black text-sm">{targets.finalScore}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footnotes / Instructions matching raw format */}
                  <div className={`mt-4 flex ${isRtl ? "flex-row-reverse" : "flex-row"} justify-between items-center text-[10px] text-slate-400`} dir={isRtl ? "rtl" : "ltr"}>
                    <span>{t("* يتم احتساب Final Score بناء على مدخلات جودة وقت الرد، جودة الرصد، الـ CSI، الـ NPS والخصومات الإدارية.")}</span>
                    <span>{t("خط الرصد والهدف الإرشادي العام: 52% لعام 2025/2026")}</span>
                  </div>
                </motion.div>
              )}

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
              dir={isRtl ? "rtl" : "ltr"
            }>
              <button 
                onClick={() => setShowIframeModal(false)}
                className={`absolute top-4 ${isRtl ? "left-4" : "right-4"} p-1.5 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors`}
                type="button"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
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
                  <ul className={`list-decimal list-inside space-y-1.5 ${isRtl ? "pr-1" : "pl-1"} text-[11px]`}>
                    <li>{t("يرجى فتح التطبيق في علامة تبويب جديدة مستقلة (Open App) من الزر العلوي في شريط منصة AI Studio.")}</li>
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
                  {t("بمجرد فتح الرابط في نافذة جديدة، اضغط على زر \"تصدير PDF\" مجدداً وسيفتح لك المتصفح خيارات الحفظ الفوري كملف PDF فائق ومثالي للطباعة!")}
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
    </div>
  );
}
