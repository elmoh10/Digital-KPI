import React, { useState, useMemo } from "react";
import { Employee } from "../types";
import { Search, Calendar as CalendarIcon, Filter, Users, UserCircle, ChevronRight, AlertTriangle, User, Phone, FileText, MapPin, Printer, ExternalLink, X, Star, Clock } from "lucide-react";
import { motion } from "motion/react";
import { MonthYearSelector } from "./MonthYearSelector";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { secondsToAht } from "./EmployeeDashboard";
import { useLanguage } from "../lib/LanguageContext";

interface LeaderPerformanceProps {
  employees: Employee[];
}

function formatLeaderAHT(val?: string | number): string {
  if (val === undefined || val === null || val === '') return '-';
  const strVal = String(val).trim();
  if (strVal.includes(':')) {
    const parts = strVal.split(':');
    if (parts.length === 3) {
      const hr = parseInt(parts[0], 10) || 0;
      const min = parseInt(parts[1], 10) || 0;
      const sec = parseInt(parts[2], 10) || 0;
      const totalMins = hr * 60 + min;
      return `${String(totalMins).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return strVal;
  }
  const num = parseFloat(strVal);
  if (!isNaN(num) && num > 0) {
    let totalSecs = 0;
    if (num < 1) {
      // Excel decimal representing fraction of 24h
      totalSecs = Math.round(num * 86400);
    } else {
      totalSecs = Math.round(num);
    }
    return secondsToAht(totalSecs);
  }
  return strVal;
}

export default function LeaderPerformance({ employees }: LeaderPerformanceProps) {
  const { t, isRtl } = useLanguage();
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    employees.forEach(emp => {
      if (emp.leaderPerformance) {
        emp.leaderPerformance.forEach(lp => months.add(lp.month));
      }
    });
    return Array.from(months);
  }, [employees]);

  // Filter only employees who have at least one leaderPerformance record
  const leaders = useMemo(() => {
    return employees.filter(emp => emp.leaderPerformance && emp.leaderPerformance.length > 0);
  }, [employees]);

  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showIframeModal, setShowIframeModal] = useState(false);

  // Initialize selectedId and selectedMonth when data becomes available
  React.useEffect(() => {
    if (!selectedId && leaders.length > 0) {
      setSelectedId(leaders[0].id);
    }
  }, [leaders, selectedId]);

  React.useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths, selectedMonth]);

  const handlePrintPdf = () => {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      setShowIframeModal(true);
    } else {
      window.print();
    }
  };

  const currentLeader = useMemo(() => {
    return leaders.find(e => e.id === selectedId) || null;
  }, [leaders, selectedId]);

  const activeLeaderRecord = useMemo(() => {
    if (!currentLeader || !selectedMonth) return null;
    return currentLeader.leaderPerformance?.find(w => w.month === selectedMonth) || null;
  }, [currentLeader, selectedMonth]);

  const filteredLeaders = useMemo(() => {
    if (!searchQuery.trim()) return leaders;
    const query = searchQuery.toLowerCase();
    return leaders.filter(emp => 
      emp.id.toLowerCase().includes(query) || 
      emp.fullName.toLowerCase().includes(query)
    );
  }, [leaders, searchQuery]);

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Search and Navigation Bar */}
      <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 no-print" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className={isRtl ? "text-right" : "text-left"}>
            <h1 className="text-xl font-display font-black text-slate-800">{t("تقييم التيم ليدر")}</h1>
            <p className="text-xs font-medium text-slate-500">{t("نظام استعراض تقييمات المشرفين الشهرية")}</p>
          </div>
        </div>

        <div className="w-full md:w-96 relative group">
          <Search className={`w-5 h-5 absolute ${isRtl ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors`} />
          <input
            type="text"
            placeholder={t("ابحث برقم أو اسم الليدر...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-slate-50 border-2 border-slate-100 ${isRtl ? "pl-4 pr-12" : "pr-4 pl-12"} py-3 rounded-2xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar - Leaders List */}
        <div className={`lg:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[700px] no-print ${isRtl ? "order-1 lg:order-2" : "order-2 lg:order-1"} overflow-hidden`} dir={isRtl ? "rtl" : "ltr"}>
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-indigo-500" />
              {t("قائمة التيم ليدر")}
            </h3>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-full">
              {filteredLeaders.length} {t("مشرف")}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredLeaders.length > 0 ? (
              filteredLeaders.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedId(emp.id)}
                  className={`w-full p-3 rounded-2xl transition-all flex items-center justify-between group ${
                    selectedId === emp.id 
                      ? "bg-indigo-50 border border-indigo-100 shadow-sm" 
                      : "hover:bg-slate-50 border border-transparent"
                  } ${isRtl ? "text-right" : "text-left"}`}
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      selectedId === emp.id ? "bg-indigo-500 text-white" : "bg-white text-indigo-500 border border-slate-100"
                    }`}>
                      <span className="text-xs font-bold">{emp.id.substring(0, 3)}</span>
                    </div>
                    <div className={`flex-1 min-w-0 ${isRtl ? "pr-2" : "pl-2"}`}>
                      <p className={`text-sm font-bold whitespace-normal ${selectedId === emp.id ? "text-indigo-950" : "text-slate-700 group-hover:text-indigo-600"}`}>
                        {emp.fullName}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">{t("الكود الوظيفي")}: {emp.id}</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 ml-1 shrink-0 transition-transform ${selectedId === emp.id ? "rotate-90 text-indigo-400" : "text-slate-400"} ${isRtl ? "" : "rotate-180"}`} />
                </button>
              ))
            ) : (
              <p className="text-center text-slate-400 text-sm py-8" dir={isRtl ? "rtl" : "ltr"}>
                {t("لا توجد نتائج مطابقة لبحثك.")}
              </p>
            )}
          </div>
        </div>

        {/* Main Dashboard Area */}
        <div className={`lg:col-span-8 space-y-6 ${isRtl ? "order-2 lg:order-1" : "order-1 lg:order-2"} print:col-span-12 print:w-full`} id="leader-dashboard-area">
          {!currentLeader ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm" id="no-leader">
              <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-display font-medium text-slate-700 mb-2">{t("الرجاء اختيار أحد المشرفين")}</h3>
              <p className="text-slate-400 text-sm">{t("استعمل قائمة البحث لاستعراض تفاصيل الأداء الشهري")}</p>
            </div>
          ) : (
            <>
              {/* Header Controls */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4 no-print mb-6">
                <div className="flex flex-wrap gap-2">
                   <h2 className="text-lg font-bold text-slate-800">{t("بيانات الأداء الشهري للمشرف")}</h2>
                </div>

                {availableMonths.length > 0 && (
                  <div className={`flex items-center gap-3 w-full sm:w-auto flex-wrap ${isRtl ? "justify-end" : "justify-start"}`} dir={isRtl ? "rtl" : "ltr"}>
                    <button
                      onClick={handlePrintPdf}
                      className="bg-gradient-to-r from-we-pink to-we-pink-light hover:brightness-110 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all no-print shrink-0"
                      id="print-pdf-report-btn-leader"
                      title={t("تصدير الصفحة الحالية لملف PDF")}
                    >
                      <Printer className="w-4 h-4" />
                      <span>{t("تصدير PDF")}</span>
                    </button>
                    <div className="h-4 w-px bg-slate-200 no-print" />
                    <CalendarIcon className="w-5 h-5 text-indigo-500 shrink-0" />
                    <span className="text-slate-500 text-xs font-bold">{t("الشهر المراد عرضه:")}</span>
                    <MonthYearSelector
                      value={selectedMonth}
                      onChange={setSelectedMonth}
                      className="w-48"
                    />
                  </div>
                )}
              </div>

              {!activeLeaderRecord ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-display font-medium text-slate-700 mb-2">{t("لا توجد بيانات متاحة لهذا الشهر")}</h3>
                  <p className="text-slate-400 text-sm">{t("لم يتم تسجيل تقييم للمشرف")} <strong>{currentLeader?.fullName || t("غير محدد")}</strong> {t("في شهر")} <strong>{selectedMonth}</strong></p>
                </div>
              ) : (
                <div id="pdf-export-content-leader">
                  {/* Print Header Section (Visible only during printing / PDF generation) */}
                  <div className={`hidden print:block mb-6 border-b-2 border-slate-900 pb-5 ${isRtl ? "text-right" : "text-left"}`} dir={isRtl ? "rtl" : "ltr"} id="pdf-print-header-leader">
                    <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-3xl font-display font-black text-slate-900 mb-2">{t("تقييم المشرف - ")}{selectedMonth}</h1>
                        <p className="text-slate-500 font-medium">{t("الشركة المصرية للاتصالات - خدمة العملاء")}</p>
                      </div>
                      <div className="text-left space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className={`text-xs font-bold text-slate-600 flex items-center gap-2 ${isRtl ? "justify-end" : "justify-start"}`}>
                          <User className="w-4 h-4 text-we-pink" />
                          <span>{currentLeader.fullName}</span>
                        </p>
                        <p className={`text-xs font-bold text-slate-600 flex items-center gap-2 ${isRtl ? "justify-end" : "justify-start"}`}>
                          <FileText className="w-4 h-4 text-indigo-500" />
                          <span>{currentLeader.id}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Leader Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("اسم المشرف")}</p>
                        <p className="text-sm font-bold text-slate-800 break-words" title={currentLeader.fullName}>{currentLeader.fullName}</p>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("الكود الوظيفي")}</p>
                        <p className="text-sm font-bold text-slate-800">{currentLeader.id}</p>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("موقع العمل")}</p>
                        <p className="text-sm font-bold text-slate-800">{t(currentLeader.location)}</p>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                      <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                        <CalendarIcon className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("الشهر المختار")}</p>
                        <p className="text-sm font-bold text-slate-800">{selectedMonth}</p>
                      </div>
                    </div>
                  </div>

                  {/* Leader KPIs */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
                    dir="ltr"
                  >
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1">CTC %</p>
                          <h4 className="text-3xl font-black text-slate-800">
                            {activeLeaderRecord.ctc}%
                          </h4>
                        </div>
                        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1">CTB %</p>
                          <h4 className="text-3xl font-black text-slate-800">
                            {activeLeaderRecord.ctb}%
                          </h4>
                        </div>
                        <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-purple-600" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1">NPS %</p>
                          <h4 className="text-3xl font-black text-slate-800">
                            {activeLeaderRecord.nps !== undefined ? `${activeLeaderRecord.nps}%` : '-'}
                          </h4>
                        </div>
                        <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center">
                          <Star className="w-5 h-5 text-emerald-600" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1">AHT</p>
                          <h4 className="text-2xl font-black text-slate-800 leading-tight">
                            {formatLeaderAHT(activeLeaderRecord.aht)}
                          </h4>
                        </div>
                        <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center">
                          <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 shadow-md relative overflow-hidden group sm:col-span-2 lg:col-span-1">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-xs font-bold text-indigo-100 mb-1">Final Score</p>
                          <h4 className="text-3xl font-black text-white">
                            {activeLeaderRecord.finalScore}%
                          </h4>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                          <UserCircle className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Chart for Leader History */}
                  {currentLeader.leaderPerformance && currentLeader.leaderPerformance.length > 1 && (
                    <div className="mt-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm no-print">
                      <h4 className={`text-sm font-bold text-slate-800 mb-6 ${isRtl ? "text-right" : "text-left"}`}>
                        {t("تطور الأداء الشهري (التاريخي)")}
                      </h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={currentLeader.leaderPerformance.slice().reverse()} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} dx={-10} domain={[0, 100]} />
                            <RechartsTooltip 
                              cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Bar dataKey="finalScore" name="Final Score" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="ctc" name="CTC %" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="ctb" name="CTB %" fill="#a855f7" radius={[6, 6, 0, 0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Safe PDF Export / Iframe Helper Modal */}
          {showIframeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm no-print">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 text-center border border-slate-100"
              >
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-display font-black text-slate-800 mb-2">{t("تصدير PDF")}</h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  {t("للحصول على أفضل جودة للطباعة والتصدير، يرجى فتح التطبيق في نافذة جديدة بدلاً من نافذة العرض الحالية.")}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      window.open(window.location.href, '_blank');
                      setShowIframeModal(false);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{t("فتح في نافذة جديدة")}</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowIframeModal(false)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all cursor-pointer"
                  >
                    {t("إغلاق النافذة")}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
