/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Employee, KPITargets } from "./types";
import { INITIAL_EMPLOYEES, DEFAULT_KPI_TARGETS, DEFAULT_KPI_TARGETS_CHAT, DEFAULT_KPI_TARGETS_UNIVERSAL } from "./data";
import EmployeeDashboard from "./components/EmployeeDashboard";
import AdminPanel from "./components/AdminPanel";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import WeeklyPerformance from "./components/WeeklyPerformance";
import Auth from "./components/Auth";
import MaintenancePage from "./components/MaintenancePage";
import { motion, AnimatePresence } from "motion/react";
import { 
  TrendingUp, BarChart3, Database, Clock, ShieldAlert, Sparkles, LucideIcon, Wifi, LayoutDashboard, Sun, Moon, Megaphone, LogOut, X, Calendar
} from "lucide-react";
import { 
  seedDatabaseIfEmpty, 
  subscribeToConfig, 
  subscribeToEmployees, 
  updateCloudConfig, 
  updateAllEmployeesInCloud,
  updatePresence,
  removePresence,
  getOnlineCount
} from "./lib/firebase";

function OnlineUsersCounter() {
  const [onlineCount, setOnlineCount] = useState<number>(1);

  useEffect(() => {
    // Initial setup
    updatePresence();
    getOnlineCount().then(setOnlineCount);

    // Heartbeat: update presence every 30 seconds
    const heartbeatInterval = setInterval(() => {
      updatePresence();
    }, 30000);

    // Fetch count every 15 seconds
    const countInterval = setInterval(() => {
      getOnlineCount().then(setOnlineCount);
    }, 15000);

    // Cleanup on window unload
    const handleBeforeUnload = () => {
      removePresence();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(countInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Try to remove immediately if unmounting (e.g. strict mode or navigating away in an SPA)
      removePresence();
    };
  }, []);

  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full shadow-sm" dir="rtl">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </div>
      <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
        متواجد الآن: 
        <AnimatePresence mode="popLayout">
          <motion.span
            key={onlineCount}
            initial={{ opacity: 0, scale: 0.5, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-we-purple font-mono text-xs w-4 text-center inline-block"
          >
            {onlineCount}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}

export default function App() {
  // Authentication state
  const [userRole, setUserRole] = useState<"admin" | "leader" | null>(null);

  // Persistence state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [targetsChat, setTargetsChat] = useState<KPITargets>(DEFAULT_KPI_TARGETS_CHAT);
  const [targetsUniversal, setTargetsUniversal] = useState<KPITargets>(DEFAULT_KPI_TARGETS_UNIVERSAL);
  const [historicalTargets, setHistoricalTargets] = useState<HistoricalTargets>({});
  const [bannerNotice, setBannerNotice] = useState<string>("");
  const [dismissedNotice, setDismissedNotice] = useState<string>("");
  const [maintenancePages, setMaintenancePages] = useState<string[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Active view tab state: "dashboard" | "analytics" | "admin" | "weekly"
  const [activeTab, setActiveTab] = useState<"dashboard" | "analytics" | "admin" | "weekly">("dashboard");

  // Support for dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("we_kpi_theme");
      if (savedTheme) {
        return savedTheme === "dark";
      }
    }
    return false;
  });

  // Sync dark mode class on document element
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("we_kpi_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Load state from Firebase with support for live structural synchronization
  useEffect(() => {
    let active = true;
    let unsubConfig: (() => void) | null = null;
    let unsubEmployees: (() => void) | null = null;

    const initFirebase = async () => {
      try {
        await seedDatabaseIfEmpty();
        
        if (!active) return;

        unsubConfig = subscribeToConfig((data) => {
          if (!active) return;
          setTargetsChat(data.targetsChat);
          setTargetsUniversal(data.targetsUniversal);
          setHistoricalTargets(data.historicalTargets || {});
          setMaintenancePages(data.maintenancePages);
          setBannerNotice(prev => {
            if (prev !== data.bannerNotice) {
              setDismissedNotice("");
            }
            return data.bannerNotice;
          });
        });

        unsubEmployees = subscribeToEmployees((list) => {
          if (!active) return;
          if (list && list.length > 0) {
            // Sort by numerical id to keep list rendering completely stable
            const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id));
            setEmployees(sorted);
          } else {
            setEmployees([]);
          }
          setIsDataLoaded(true);
        });
      } catch (err) {
        console.error("Failed to load Firebase cloud database, falling back safely", err);
        try {
          const storedEmployees = localStorage.getItem("kpi_employees_v1");
          const storedTargetsChat = localStorage.getItem("kpi_targets_chat_v1");
          const storedTargetsUniversal = localStorage.getItem("kpi_targets_universal_v1");
          if (storedEmployees) setEmployees(JSON.parse(storedEmployees));
          else setEmployees(INITIAL_EMPLOYEES);

          if (storedTargetsChat) setTargetsChat(JSON.parse(storedTargetsChat));
          else setTargetsChat(DEFAULT_KPI_TARGETS_CHAT);

          if (storedTargetsUniversal) setTargetsUniversal(JSON.parse(storedTargetsUniversal));
          else setTargetsUniversal(DEFAULT_KPI_TARGETS_UNIVERSAL);
        } catch (localErr) {
          setEmployees(INITIAL_EMPLOYEES);
          setTargetsChat(DEFAULT_KPI_TARGETS_CHAT);
          setTargetsUniversal(DEFAULT_KPI_TARGETS_UNIVERSAL);
        }
        setIsDataLoaded(true);
      }
    };

    initFirebase();

    return () => {
      active = false;
      if (unsubConfig) unsubConfig();
      if (unsubEmployees) unsubEmployees();
    };
  }, []);


  // Update employees handler
  const handleUpdateEmployees = async (updatedList: Employee[]) => {
    setEmployees(updatedList);
    localStorage.setItem("kpi_employees_v1", JSON.stringify(updatedList));
    try {
      await updateAllEmployeesInCloud(updatedList);
    } catch (e) {
      console.error("Failed to save updated list to Cloud:", e);
    }
  };

  // Update targets handler
  const handleUpdateTargets = async (
    updatedTargetsChat: KPITargets, 
    updatedTargetsUniversal: KPITargets,
    newNotice?: string,
    newMaintenanceMode?: boolean,
    updatedHistoricalTargets?: HistoricalTargets
  ) => {
    setTargetsChat(updatedTargetsChat);
    setTargetsUniversal(updatedTargetsUniversal);
    const resolvedHistorical = updatedHistoricalTargets || historicalTargets;
    if (updatedHistoricalTargets) {
      setHistoricalTargets(updatedHistoricalTargets);
    }
    localStorage.setItem("kpi_targets_chat_v1", JSON.stringify(updatedTargetsChat));
    localStorage.setItem("kpi_targets_universal_v1", JSON.stringify(updatedTargetsUniversal));
    
    let activeNotice = bannerNotice;
    if (newNotice !== undefined) {
      setBannerNotice(newNotice);
      activeNotice = newNotice;
    }

    let activeMaintenanceMode = maintenanceMode;
    if (newMaintenanceMode !== undefined) {
      setMaintenanceMode(newMaintenanceMode);
      activeMaintenanceMode = newMaintenanceMode;
    }
    
    try {
      await updateCloudConfig(updatedTargetsChat, updatedTargetsUniversal, activeNotice, activeMaintenanceMode, resolvedHistorical);
    } catch (e) {
      console.error("Failed to save updated limits to Cloud:", e);
    }
  };

  // Update banner notice handler
  const handleUpdateBannerNotice = async (newNotice: string) => {
    setBannerNotice(newNotice);
    try {
      await updateCloudConfig(targetsChat, targetsUniversal, newNotice, maintenancePages, historicalTargets);
    } catch (e) {
      console.error("Failed to save active notice to Cloud:", e);
    }
  };

  // Update maintenance pages handler
  const handleUpdateMaintenancePages = async (newMaintenancePages: string[]) => {
    setMaintenancePages(newMaintenancePages);
    try {
      await updateCloudConfig(targetsChat, targetsUniversal, bannerNotice, newMaintenancePages, historicalTargets);
    } catch (e) {
      console.error("Failed to save active maintenance pages to Cloud:", e);
    }
  };

  // Time tracker for visual clock
  const [time, setTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userRole === "leader" && activeTab === "admin") {
      setActiveTab("dashboard");
    }
  }, [userRole, activeTab]);

  if (!userRole) {
    return <Auth onLogin={(role) => {
      setUserRole(role);
      setActiveTab("dashboard");
    }} />;
  }

  if (userRole === "leader" && maintenancePages.includes(activeTab)) {
    return <MaintenancePage />;
  }

  if (!isDataLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-we-pink/30 border-t-we-purple rounded-full animate-spin"></div>
        <p className="text-slate-500 font-semibold text-sm" dir="rtl">جاري الاتصال بقاعدة بيانات وي (WE)...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans transition-all duration-300">
      {/* Decorative Top Accent Line - Telecom Egypt WE Color scheme */}
      <div className="h-1.5 w-full bg-gradient-to-r from-we-pink via-we-purple-light to-we-purple" />

      {/* Main Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            
            {/* Right Group: Title, Logo & Connection status */}
            <div className="flex items-center gap-4 flex-row-reverse text-right" dir="rtl">
              {/* Refreshed WE 2026 Iconic Logo */}
              <div className="w-14 h-14 shrink-0 select-none drop-shadow-md">
                <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
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

              <div>
                <div className="flex items-center gap-1.5 flex-row-reverse">
                  <h1 className="text-xl font-display font-black text-we-purple tracking-tight leading-none flex items-center gap-1 flex-row-reverse">
                    <span>WE KPI Portal</span>
                    <span className="text-xs bg-we-pink/10 text-we-pink px-1.5 py-0.5 rounded-md font-mono font-bold">2026</span>
                  </h1>
                  <Sparkles className="w-4 h-4 text-we-pink" />
                </div>
                <p className="text-slate-500 text-[10px] sm:text-xs mt-1 font-bold">
                  بوابة تقييم الكفاءات والأداء الرقمي لقطاع الدعم الفني والدردشة - المصرية للاتصالات
                </p>
              </div>
            </div>

            {/* Left Group: Theme Toggle, Digital Cairo Clock & Online indicator */}
            <div className="flex items-center gap-3 sm:gap-4 flex-row">
              {/* Logout Button */}
              <button
                onClick={() => setUserRole(null)}
                className="p-2 sm:p-2.5 rounded-2xl bg-we-pink/10 hover:bg-we-pink/20 text-we-pink transition-all flex items-center justify-center cursor-pointer shadow-sm relative shrink-0"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4.5 h-4.5 sm:w-5 h-5" />
              </button>
              
              {/* Theme Toggle Button */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 text-slate-500 hover:text-we-purple transition-all flex items-center justify-center cursor-pointer shadow-sm relative shrink-0"
                aria-label={isDarkMode ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
                title={isDarkMode ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
              >
                {isDarkMode ? (
                  <motion.div
                    initial={{ rotate: -90, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    key="sun"
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  >
                    <Sun className="w-4.5 h-4.5 sm:w-5 h-5 text-amber-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ rotate: 90, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    key="moon"
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  >
                    <Moon className="w-4.5 h-4.5 sm:w-5 h-5 text-slate-500" />
                  </motion.div>
                )}
              </button>

              <div className="hidden md:flex items-center gap-4 flex-row">
                <div className="bg-slate-50 border border-slate-100/50 px-4 py-2 rounded-2xl flex items-center gap-2" dir="rtl">
                  <Clock className="w-4 h-4 text-we-pink" />
                  <span className="text-xs text-slate-400 font-medium">توقيت القاهرة:</span>
                  <span className="text-xs font-mono font-bold text-we-purple">{time}</span>
                </div>

                <div className="flex flex-col gap-1 items-end">
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 text-xs font-semibold">
                    <Wifi className="w-3.5 h-3.5 text-we-purple" />
                    <span>سيرفر WE متصل ونشط</span>
                  </div>
                  <OnlineUsersCounter />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Global Page Toggles Navigation */}
        <div className="border-t border-slate-50 bg-slate-50/50 p-2">
          <div className="max-w-md mx-auto flex bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-100" id="navigation-tabs">
            {userRole === "admin" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "admin" 
                    ? "bg-we-purple text-white shadow-md font-bold" 
                    : "text-slate-500 hover:text-we-purple hover:bg-slate-50"
                }`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0 text-we-pink" />
                <span>لوحة الإدارة</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("weekly")}
              className={`flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "weekly" 
                  ? "bg-we-purple text-white shadow-md font-bold" 
                  : "text-slate-500 hover:text-we-purple hover:bg-slate-50"
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0 text-we-pink" />
              <span>الأداء الأسبوعي</span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "analytics" 
                  ? "bg-we-purple text-white shadow-md font-bold" 
                  : "text-slate-500 hover:text-we-purple hover:bg-slate-50"
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0 text-we-pink" />
              <span>تقارير تشغيل الفرق</span>
            </button>

            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "dashboard" 
                  ? "bg-we-purple text-white shadow-md font-bold" 
                  : "text-slate-500 hover:text-we-purple hover:bg-slate-50"
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0 text-we-pink" />
              <span>التقييم الفردي</span>
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Scrolling Announcement Marquee Ticker (شريط التنبيهات المتحرك السحابي) */}
      <AnimatePresence>
        {bannerNotice && bannerNotice !== dismissedNotice && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full flex justify-center py-2 bg-slate-50 border-b border-slate-100 no-print z-30 relative" dir="rtl"
          >
            <div className="max-w-lg w-full bg-gradient-to-r from-[#512588] to-[#d11270] rounded-full text-white p-1 overflow-hidden shadow-md flex items-center relative gap-2 text-xs font-semibold mx-4 border border-white/20">
              
              <div className="bg-white/20 rounded-full px-3 py-1.5 flex items-center shrink-0 z-20 gap-1.5 backdrop-blur-sm border border-white/10 shadow-sm">
                <Megaphone className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
                <span className="text-white tracking-wider font-black text-[10px]">تنبيه إداري</span>
              </div>

              <div className="flex-1 overflow-hidden relative flex items-center h-5 w-full mask-edges">
                <div className="animate-marquee-scroll whitespace-nowrap text-[12px] text-white font-bold tracking-wide drop-shadow-sm px-2">
                  {bannerNotice}
                </div>
              </div>
              
              <button 
                onClick={() => setDismissedNotice(bannerNotice)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 backdrop-blur-sm transition-all focus:outline-none flex items-center justify-center shrink-0 z-20 ml-1 shadow-sm"
                title="إخفاء التنبيه"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="primary-app-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(2px)" }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            id="tab-view-container"
          >
            {activeTab === "dashboard" && (
              <EmployeeDashboard 
                employees={employees} 
                targetsChat={targetsChat} 
                targetsUniversal={targetsUniversal} 
                historicalTargets={historicalTargets}
              />
            )}
            {activeTab === "analytics" && (
              <AnalyticsDashboard 
                employees={employees} 
                targetsChat={targetsChat} 
                targetsUniversal={targetsUniversal} 
                historicalTargets={historicalTargets}
              />
            )}
            {activeTab === "weekly" && (
              <WeeklyPerformance 
                employees={employees} 
                targetsChat={targetsChat} 
                targetsUniversal={targetsUniversal}
              />
            )}
            {activeTab === "admin" && (
              <AdminPanel 
                employees={employees} 
                targetsChat={targetsChat} 
                targetsUniversal={targetsUniversal} 
                historicalTargets={historicalTargets}
                bannerNotice={bannerNotice}
                maintenancePages={maintenancePages}
                onUpdateBannerNotice={handleUpdateBannerNotice}
                onUpdateMaintenancePages={handleUpdateMaintenancePages}
                onUpdateEmployees={handleUpdateEmployees}
                onUpdateTargets={handleUpdateTargets}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer bar */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400 font-medium font-sans" id="primary-footer">
        <div className="max-w-7xl mx-auto px-4 flex justify-center items-center text-center" dir="rtl">
          <span>© ٢٠٢٦ بوابة Digital Chat KPI للتطوير الإداري وجودة تشغيل الدردشة الرقمية - Developed By: Hesham El-Gamil</span>
        </div>
      </footer>
    </div>
  );
}
