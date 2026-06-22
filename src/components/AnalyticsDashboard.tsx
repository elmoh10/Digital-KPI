/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Employee, KPITargets } from "../types";
import { 
  TrendingUp, Award, Users, ShieldAlert, ArrowUpRight, BarChart3, 
  HelpCircle, Sparkles, Filter, Calendar, Zap, AlertCircle
} from "lucide-react";
import { motion } from "motion/react";
import { ahtToSeconds, secondsToAht, sortMonths } from "./EmployeeDashboard";

interface AnalyticsDashboardProps {
  employees: Employee[];
  targetsChat: KPITargets;
  targetsUniversal: KPITargets;
}

export default function AnalyticsDashboard({ employees, targetsChat, targetsUniversal }: AnalyticsDashboardProps) {
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

  React.useEffect(() => {
    if (allMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(allMonths[allMonths.length - 1]);
    }
  }, [allMonths, selectedMonth]);

  // Overall statistics for the selected month and selected TL
  const monthStats = useMemo(() => {
    if (!selectedMonth || employees.length === 0) return null;

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

        const empTargets = emp.lob && !emp.lob.toLowerCase().includes("adsl") ? targetsUniversal : targetsChat;
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
    <div className="space-y-6" id="analytics-workspace">
      {/* Filters bar */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex justify-between items-center flex-row-reverse" dir="rtl">
        <div>
          <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2 justify-end font-bold">
            <Filter className="w-5 h-5 text-we-pink" />
            تقارير وإحصائيات قائد الفريق والتشغيل
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">تقييم جماعي ومؤشرات جودة الأداء العام للشركة</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <select
              value={selectedTL}
              onChange={(e) => setSelectedTL(e.target.value)}
              className="bg-slate-50 border border-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-we-purple font-mono"
            >
              <option value="All">كل قادة الفرق</option>
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
          <h3 className="text-lg font-display font-medium text-slate-700 mb-2">لا توجد بيانات كافية</h3>
          <p className="text-slate-400 text-sm">الرجاء إدخال بيانات أو رفع شيت تقييم لشهر {selectedMonth} أولاً في لوحة التحكم لمشاهدة التحليل الجماعي.</p>
        </div>
      ) : (
        <>
          {/* Main Analytics Cards Group */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6" id="analytics-grid-cards">
            
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-2 text-right" dir="rtl">
              <span className="text-slate-400 text-xs font-semibold block">الموظفين النشطين</span>
              <p className="text-3xl font-bold font-mono text-slate-800">{monthStats.activeEmpCount}</p>
              <span className="text-[10px] text-slate-400 block">* الذين يمتلكون سجل تقييم لشهر {selectedMonth}</span>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-2 text-right" dir="rtl">
              <span className="text-slate-400 text-xs font-semibold block">متوسط الكفاءة العام</span>
              <p className="text-3xl font-bold font-mono text-we-purple">{monthStats.avgScore.toFixed(1)}%</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 justify-end">
                <span className="font-semibold text-emerald-600 font-mono">Chat: {targetsChat.finalScore}% | Univ: {targetsUniversal.finalScore}%</span>
                <span>المستهدف:</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-2 text-right" dir="rtl">
              <span className="text-slate-400 text-xs font-semibold block">نسبة نجاح الفريق (KPI)</span>
              <p className="text-3xl font-bold font-mono text-emerald-600">{monthStats.passingRatio.toFixed(0)}%</p>
              <span className="text-[10px] text-slate-400 block">* الموظفون المحققون للهدف المخصص لخط العمل (LOB)</span>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-2 text-right" dir="rtl">
              <span className="text-slate-400 text-xs font-semibold block">متوسط رضا العملاء (CSI)</span>
              <p className="text-3xl font-bold font-mono text-blue-600">{monthStats.avgCSI.toFixed(1)}%</p>
              <span className="text-[10px] text-slate-400 block">إجمالي ردود الفعل الإيجابية بالدردشات</span>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Top Performers Podium */}
            <div className="md:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-right space-y-4" dir="rtl">
              <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-500" />
                لوحة شرف الأداء الثلاثية - شهر {selectedMonth}
              </h3>
              <p className="text-slate-500 text-xs mb-3">أفضل 3 عناصر حققوا أعلى تقييمات إجمالية متكاملة في هذا الشهر:</p>

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
                          <span className="text-[10px] text-slate-400">قائد الفريق: {perf.tl}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-emerald-700 font-black font-mono text-sm leading-none">{perf.score}%</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">التقييم الكلي</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Team Leader Comparative Breakdown */}
            <div className="md:col-span-5 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-right space-y-4" dir="rtl">
              <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2 font-bold">
                <BarChart3 className="w-5 h-5 text-we-pink" />
                معدلات الكفاءة حسب قادة الفرق (TL)
              </h3>
              
              <div className="space-y-4 pt-2">
                {tlStats.map((tl, index) => (
                  <div key={tl.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{tl.name} <span className="font-normal text-slate-400 font-sans text-[10px]">({tl.count} موظف حالي)</span></span>
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
          <div className="bg-white rounded-3xl border border-slate-100 p-6 text-right space-y-3" dir="rtl">
            <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              تنبيهات جودة الأداء وحالات الدعم الفني المطلوبة (Coaching Alerts)
            </h3>
            <p className="text-slate-400 text-xs">مجموعة الموظفين الذين يقل معدلهم العام عن هدف العمل المخصص لخط العمل الخاص بهم وبحاجة لجلسات تطوير أداء:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {monthStats.needsCoaching.length > 0 ? (
                monthStats.needsCoaching.map(r => (
                  <div key={r.id} className="p-3 bg-rose-50/50 border border-rose-100/30 rounded-2xl flex justify-between items-center">
                    <span className="font-mono text-rose-700 font-bold text-xs">{r.score}% :التقييم</span>
                    <div className="text-right">
                      <p className="font-semibold text-xs text-slate-800">{r.name}</p>
                      <span className="text-[9px] text-slate-400">ID: {r.id} • {r.tl.split(" ")[0]}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-6 text-emerald-600 font-semibold text-xs">
                  👏 مذهل! لا يوجد موظف تحت خط المستهدف هذا الشهر. جميع الكوادر ناجحة ومستوفية للشروط!
                </div>
              )}
            </div>
          </div>

          {/* Full Team Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden" dir="rtl">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-slate-800 font-display font-semibold text-sm flex items-center gap-2">
                <Users className="w-5 h-5 text-we-purple" />
                قائمة الفريق بالكامل
              </h3>
              <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-we-purple border border-slate-200">
                {monthStats.fullTeamList.length} موظف
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="px-6 py-4 whitespace-nowrap">الموظف</th>
                    <th className="px-6 py-4 whitespace-nowrap">قائد الفريق</th>
                    <th className="px-6 py-4 whitespace-nowrap">خط العمل (LOB)</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">AHT</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">CSI</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">NPS</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">التقييم النهائي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {monthStats.fullTeamList.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{emp.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.id}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">{emp.tl || "غير محدد"}</td>
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
        </>
      )}
    </div>
  );
}
