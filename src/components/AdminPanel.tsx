/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { Employee, KPITargets, MonthlyPerformance } from "../types";
import { 
  Lock, KeyRound, Check, Edit3, Plus, Trash2, Database, Upload, Download, 
  HelpCircle, Settings, UserPlus, RefreshCw, LogOut, CheckCircle2,
  AlertCircle, FileSpreadsheet, EyeOff, Eye, Megaphone, Users, Search, Archive, Calendar, History
} from "lucide-react";
import { motion } from "motion/react";
import { INITIAL_EMPLOYEES, DEFAULT_KPI_TARGETS } from "../data";
import { sortMonths } from "./EmployeeDashboard";

interface AdminPanelProps {
  employees: Employee[];
  targetsChat: KPITargets;
  targetsUniversal: KPITargets;
  historicalTargets?: Record<string, { chat: KPITargets; universal: KPITargets }>;
  bannerNotice?: string;
  maintenancePages?: string[];
  onUpdateBannerNotice?: (notice: string) => void;
  onUpdateMaintenancePages?: (pages: string[]) => void;
  onUpdateEmployees: (updated: Employee[]) => void;
  onUpdateTargets: (
    updatedChat: KPITargets, 
    updatedUniversal: KPITargets, 
    updatedNotice?: string, 
    updatedMaintenancePages?: string[],
    updatedHistoricalTargets?: Record<string, { chat: KPITargets; universal: KPITargets }>
  ) => void;
}

export interface KpiMappingConfig {
  idIdx: number;
  nameIdx: number;
  ahtIdx: number;
  csiIdx: number;
  npsIdx: number;
  fcrIdx: number;
  ttbIdx: number;
  ctcIdx: number;
  ctbIdx: number;
  absIdx: number;
  sckIdx: number;
  emgIdx: number;
  unpIdx: number;
  scoreIdx: number;
}

export interface EmpMappingConfig {
  idIdx: number;
  nameIdx: number;
  tlIdx: number;
  svIdx: number;
  mobIdx: number;
  natIdx: number;
  locIdx: number;
  lobIdx: number;
}

export interface NpsMappingConfig {
  idIdx: number;
  npsIdx: number;
  fcrIdx: number;
  ttbIdx: number;
}

export function parsePercentageVal(cellVal: string, defaultVal = 0): number {
  if (!cellVal) return defaultVal;
  const hasPercentSign = cellVal.includes("%");
  const cleanedStr = cellVal.replace("%", "").trim();
  const num = parseFloat(cleanedStr);
  if (isNaN(num)) return defaultVal;

  if (hasPercentSign) {
    return num;
  }

  if (num > 0 && num <= 2.5 && cellVal.includes(".")) {
    return Math.round(num * 1000) / 10;
  }
  if (num === 1 && !cellVal.includes(".")) {
    return 100;
  }
  return num;
}

export function getExcelColumnLabel(index: number): string {
  let label = "";
  let temp = index;
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label;
    temp = Math.floor(temp / 26) - 1;
  }
  return label;
}

export default function AdminPanel({
  employees,
  targetsChat,
  targetsUniversal,
  historicalTargets = {},
  bannerNotice = "",
  maintenancePages = [],
  onUpdateBannerNotice = () => {},
  onUpdateMaintenancePages = () => {},
  onUpdateEmployees,
  onUpdateTargets,
}: AdminPanelProps) {
  // Login State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("admin_authenticated") === "true";
  });
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Cloud Live Notice Ticker state
  const [localNotice, setLocalNotice] = useState(bannerNotice);
  
  useEffect(() => {
    // Only update local notice from cloud if we are not actively editing it
    if (localNotice !== bannerNotice && document.activeElement?.id !== 'notice-textarea') {
      setLocalNotice(bannerNotice);
    }
  }, [bannerNotice]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localNotice !== bannerNotice) {
        onUpdateBannerNotice(localNotice);
      }
    }, 600);
    return () => clearTimeout(handler);
  }, [localNotice]);

  // Control tabs in Admin Dashboard
  const [adminTab, setAdminTab] = useState<"upload" | "employees" | "targets" | "data">("upload");

  // Control which LOB targets we are currently editing
  const [editingLOB, setEditingLOB] = useState<"chat" | "universal">("chat");

  // Form States
  const [targetEditingMonth, setTargetEditingMonth] = useState<string>("default");
  const [targetFormChat, setTargetFormChat] = useState<KPITargets>({ ...targetsChat });
  const [targetFormUniversal, setTargetFormUniversal] = useState<KPITargets>({ ...targetsUniversal });
  const [isSuccessTargets, setIsSuccessTargets] = useState(false);

  const loadTargetsForMonth = (month: string) => {
    if (month === "default") {
      setTargetFormChat({ ...targetsChat });
      setTargetFormUniversal({ ...targetsUniversal });
    } else if (historicalTargets[month]) {
      setTargetFormChat({ ...historicalTargets[month].chat });
      setTargetFormUniversal({ ...historicalTargets[month].universal });
    } else {
      // If none, default to current but we are making a new entry
      setTargetFormChat({ ...targetsChat });
      setTargetFormUniversal({ ...targetsUniversal });
    }
  };

  const handleMonthSelectionChange = (newMonth: string) => {
    setTargetEditingMonth(newMonth);
    loadTargetsForMonth(newMonth);
  };

  useEffect(() => {
    if (targetEditingMonth === "default") {
      setTargetFormChat({ ...targetsChat });
      setTargetFormUniversal({ ...targetsUniversal });
    } else if (historicalTargets[targetEditingMonth]) {
      setTargetFormChat({ ...historicalTargets[targetEditingMonth].chat });
      setTargetFormUniversal({ ...historicalTargets[targetEditingMonth].universal });
    }
  }, [targetsChat, targetsUniversal, historicalTargets, targetEditingMonth]);

  // New Employee Form
  const [newEmp, setNewEmp] = useState({
    id: "",
    fullName: "",
    newTL: "",
    newSV: "",
    mobileNumber: "",
    nationalId: "",
    location: "WFH",
    lob: "Chat / ADSL",
  });
  const [empError, setEmpError] = useState("");
  const [empSuccess, setEmpSuccess] = useState("");
  const [empSearchQuery, setEmpSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const filteredEmployees = useMemo(() => {
    const q = empSearchQuery.trim().toLowerCase();
    
    // First filter by archiving status
    const byArchiveStatus = employees.filter(emp => showArchived ? emp.isArchived : !emp.isArchived);
    
    if (!q) return byArchiveStatus;
    
    return byArchiveStatus.filter(emp => 
      emp.id.toLowerCase().includes(q) || 
      emp.fullName.toLowerCase().includes(q) || 
      emp.newTL.toLowerCase().includes(q) ||
      (emp.lob && emp.lob.toLowerCase().includes(q))
    );
  }, [employees, empSearchQuery, showArchived]);

  // Paste Spreadsheet Data State
  const [uploadMode, setUploadMode] = useState<"employees" | "kpi" | "nps">("kpi");
  const [pasteEmpText, setPasteEmpText] = useState("");
  const [pasteKpiText, setPasteKpiText] = useState("");
  const [pasteNpsText, setPasteNpsText] = useState("");
  const [pasteKpiMonth, setPasteKpiMonth] = useState("Jun-25");
  const [pasteNpsMonth, setPasteNpsMonth] = useState("Jun-25");
  const [pasteError, setPasteError] = useState("");
  const [pasteSuccess, setPasteSuccess] = useState("");

  // Interactive KPI Mapping State
  const [pendingKpiRows, setPendingKpiRows] = useState<string[][] | null>(null);
  const [pendingKpiMonth, setPendingKpiMonth] = useState<string>("");
  const [kpiMapping, setKpiMapping] = useState<KpiMappingConfig>({
    idIdx: 0,
    nameIdx: -1,
    ahtIdx: 2,
    csiIdx: 3,
    npsIdx: 4,
    fcrIdx: 5,
    ttbIdx: 6,
    ctcIdx: 7,
    ctbIdx: 8,
    absIdx: 9,
    sckIdx: 10,
    emgIdx: 11,
    unpIdx: 12,
    scoreIdx: 13,
  });
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [headerRowsCount, setHeaderRowsCount] = useState<number>(0);

  // Interactive Employee Mapping State
  const [pendingEmpRows, setPendingEmpRows] = useState<string[][] | null>(null);
  const [empMapping, setEmpMapping] = useState<EmpMappingConfig>({
    idIdx: 0,
    nameIdx: 1,
    tlIdx: 2,
    svIdx: 3,
    mobIdx: 4,
    natIdx: 5,
    locIdx: 6,
    lobIdx: 7,
  });
  const [detectedEmpHeaders, setDetectedEmpHeaders] = useState<string[]>([]);
  const [empHeaderRowsCount, setEmpHeaderRowsCount] = useState<number>(0);

  // Interactive NPS Mapping State
  const [pendingNpsRows, setPendingNpsRows] = useState<string[][] | null>(null);
  const [pendingNpsMonth, setPendingNpsMonth] = useState<string>("");
  const [npsMapping, setNpsMapping] = useState<NpsMappingConfig>({
    idIdx: 0,
    npsIdx: 5, // F
    fcrIdx: 6, // G
    ttbIdx: 7, // H
  });
  const [detectedNpsHeaders, setDetectedNpsHeaders] = useState<string[]>([]);
  const [npsHeaderRowsCount, setNpsHeaderRowsCount] = useState<number>(0);

  // Selected Employee for manual KPI entry
  const [kpiEmployeeId, setKpiEmployeeId] = useState("");
  const [manualKpi, setManualKpi] = useState<MonthlyPerformance>({
    month: "Jun-25",
    aht: "07:20",
    csi: 40,
    nps: 39,
    fcr: 65,
    ttb: 85,
    ctc: 15,
    ctb: 10,
    absent: 0,
    sick: 0,
    emergency: 0,
    unplanned: 0,
    finalScore: 52,
  });
  const [manualSuccess, setManualSuccess] = useState("");

  // Custom Modal States for safe, responsive, iframe-friendly dialogs
  const [dialogConfirm, setDialogConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText: string;
    cancelText: string;
    theme: "rose" | "indigo" | "slate";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    confirmText: "تأكيد",
    cancelText: "إلغاء",
    theme: "slate",
  });

  const [dialogAlert, setDialogAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const [resetDialogState, setResetDialogState] = useState<{
    isOpen: boolean;
    mode: "all" | "employees_only" | "kpi_month" | "nps_month";
    selectedMonth: string;
  }>({
    isOpen: false,
    mode: "all",
    selectedMonth: "Jan-25"
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Prompt credentials check:
    // Username: Hesham.M148011
    // Password: Etch2410#$#
    if (username === "Hesham.M148011" && password === "Etch2410#$#") {
      setIsAuthenticated(true);
      localStorage.setItem("admin_authenticated", "true");
      setLoginError("");
    } else {
      setLoginError("اسم المستخدم أو كلمة المرور غير صحيحة!");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("admin_authenticated");
    setUsername("");
    setPassword("");
  };

  const handleUpdateTargetsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (targetEditingMonth === "default") {
        await onUpdateTargets(targetFormChat, targetFormUniversal, localNotice, maintenancePages, historicalTargets);
      } else {
        // Create new historical snapshot
        const updatedHistorical = {
          ...historicalTargets,
          [targetEditingMonth]: {
            chat: { ...targetFormChat },
            universal: { ...targetFormUniversal }
          }
        };
        await onUpdateTargets(targetsChat, targetsUniversal, localNotice, maintenancePages, updatedHistorical);
      }
      setIsSuccessTargets(true);
      setTimeout(() => setIsSuccessTargets(false), 3000);
    } catch (e: any) {
      setDialogAlert({
        isOpen: true,
        title: "خطأ في الحفظ السحابي",
        message: "تم حفظ التعديلات محلياً، ولكن فشل الرفع السحابي (ربما لتجاوز الحد المسموح Quota).",
        type: "error"
      });
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newEmp.id.trim();
    if (!cleanId || !newEmp.fullName.trim() || !newEmp.newTL.trim()) {
      setEmpError("الرجاء ملء حقول الكود، الاسم الكامل، وقائد الفريق!");
      return;
    }

    const existingIdx = employees.findIndex(emp => emp.id === cleanId);

    try {
      if (existingIdx > -1) {
        // Update existing employee, keeping performance indicators!
        const updatedEmployees = [...employees];
        updatedEmployees[existingIdx] = {
          ...updatedEmployees[existingIdx],
          fullName: newEmp.fullName.trim(),
          newTL: newEmp.newTL.trim(),
          newSV: newEmp.newSV.trim() || "Ehab Heness",
          mobileNumber: newEmp.mobileNumber.trim(),
          nationalId: newEmp.nationalId.trim(),
          location: newEmp.location,
          lob: newEmp.lob
        };
        await onUpdateEmployees(updatedEmployees);
        setEmpSuccess(`تم تحديث بيانات الموظف بنجاح لكود الموظف ${cleanId} (الربط تم بنجاح ويحمي تقييماته القديمة)!`);
      } else {
        // Create new employee
        const created: Employee = {
          id: cleanId,
          fullName: newEmp.fullName.trim(),
          newTL: newEmp.newTL.trim(),
          newSV: newEmp.newSV.trim() || "Ehab Heness",
          mobileNumber: newEmp.mobileNumber.trim(),
          nationalId: newEmp.nationalId.trim(),
          location: newEmp.location,
          lob: newEmp.lob,
          performance: []
        };
        await onUpdateEmployees([...employees, created]);
        setEmpSuccess("تمت إضافة الموظف الجديد بنجاح!");
      }

      setNewEmp({
        id: "",
        fullName: "",
        newTL: "",
        newSV: "",
        mobileNumber: "",
        nationalId: "",
        location: "WFH",
        lob: "Chat / ADSL",
      });
      setEmpError("");
      setTimeout(() => setEmpSuccess(""), 5000);
    } catch (e: any) {
      setEmpError("فشل الحفظ السحابي (Quota Exceeded)، تم حفظه محلياً فقط.");
    }
  };

  const handleArchiveEmployee = async (id: string) => {
    const employeeToUpdate = employees.find(e => e.id === id);
    if (!employeeToUpdate) return;
    
    const isNowArchived = !employeeToUpdate.isArchived;

    const updated = employees.map(emp => {
      if (emp.id === id) {
        return { ...emp, isArchived: isNowArchived };
      }
      return emp;
    });

    try {
      await onUpdateEmployees(updated);
      
      setDialogAlert({
        isOpen: true,
        title: isNowArchived ? "تمت الأرشفة بنجاح" : "تم إعادة التنشيط بنجاح",
        message: isNowArchived 
          ? `تم أرشفة الموظف "${employeeToUpdate.fullName}" بنجاح. لن يظهر بعد الآن في لوحة الإحصائيات أو تقارير الفريق المشروح.`
          : `تم إعادة تنشيط الموظف "${employeeToUpdate.fullName}" بنجاح. سيظهر الآن في جميع التقارير والإحصائيات الخاصة بالفريق.`,
        type: "success"
      });
    } catch (e) {
      setDialogAlert({
        isOpen: true,
        title: "خطأ",
        message: "تم حفظ التعديلات محلياً فقط. تم تجاوز الحد الأقصى للسحابة.",
        type: "error"
      });
    }
  };

  const handleDeleteEmployee = (id: string) => {
    const employeeToDelete = employees.find(e => e.id === id);
    const name = employeeToDelete ? employeeToDelete.fullName : id;
    
    setDialogConfirm({
      isOpen: true,
      title: "تأكيد حذف الموظف",
      message: `هل أنت متأكد من رغبتك في حذف الموظف "${name}" (كود: ${id}) نهائياً من سجلات المنظومة؟ سيؤدي ذلك لمسح كافة تقييمات الأداء والـ NPS التاريخية الخاصة به ولا يمكن التراجع عن هذا الإجراء!`,
      confirmText: "نعم، احذف الموظف",
      cancelText: "إلغاء الأمر",
      theme: "rose",
      onConfirm: async () => {
        const updated = employees.filter(emp => emp.id !== id);
        try {
          await onUpdateEmployees(updated);
          setDialogConfirm(prev => ({ ...prev, isOpen: false }));
          setDialogAlert({
            isOpen: true,
            title: "تم الحذف بنجاح",
            message: `تمت إزالة الموظف "${name}" وسجلاته بالكامل بنجاح.`,
            type: "success"
          });
        } catch (e) {
          setDialogConfirm(prev => ({ ...prev, isOpen: false }));
          setDialogAlert({
            isOpen: true,
            title: "تنبيه الحد الأقصى",
            message: "تم حفظ التعديلات محلياً فقط. تم تجاوز الحد الأقصى للسحابة المجانية.",
            type: "error"
          });
        }
      }
    });
  };

  const handleResetToDefault = () => {
    setResetDialogState(prev => ({ ...prev, isOpen: true }));
  };

  const executeAdvancedReset = () => {
    switch (resetDialogState.mode) {
      case "all":
        onUpdateEmployees(INITIAL_EMPLOYEES);
        onUpdateTargets(DEFAULT_KPI_TARGETS, DEFAULT_KPI_TARGETS);
        setTargetFormChat(DEFAULT_KPI_TARGETS);
        setTargetFormUniversal(DEFAULT_KPI_TARGETS);
        setDialogAlert({
          isOpen: true,
          title: "تمت العملية بنجاح",
          message: "تمت استعادة التهيئة الأصلية لمشروعات الدعم الفني وتصفير البيانات المخصصة بنجاح!",
          type: "success"
        });
        break;
      case "employees_only":
        onUpdateEmployees([]);
        setDialogAlert({
          isOpen: true,
          title: "تمت العملية بنجاح",
          message: "تم مسح كافة الموظفين من سجلات المنظومة.",
          type: "success"
        });
        break;
      case "kpi_month": {
        const updatedEmps = employees.map(emp => ({
          ...emp,
          performance: emp.performance.map(p => 
            p.month === resetDialogState.selectedMonth
              ? { ...p, aht: "00:00", csi: 0, ctc: 0, ctb: 0, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 0 }
              : p
          )
        }));
        onUpdateEmployees(updatedEmps);
        setDialogAlert({
          isOpen: true,
          title: "تمت العملية بنجاح",
          message: `تم مسح بيانات KPI לשشهر ${resetDialogState.selectedMonth} لجميع الموظفين.`,
          type: "success"
        });
        break;
      }
      case "nps_month": {
        const updatedEmps2 = employees.map(emp => ({
          ...emp,
          performance: emp.performance.map(p => 
            p.month === resetDialogState.selectedMonth
              ? { ...p, nps: 0, fcr: 0, ttb: 0 }
              : p
          )
        }));
        onUpdateEmployees(updatedEmps2);
        setDialogAlert({
          isOpen: true,
          title: "تمت العملية بنجاح",
          message: `تم مسح بيانات الاستطلاعات و NPS لشهر ${resetDialogState.selectedMonth} لجميع الموظفين.`,
          type: "success"
        });
        break;
      }
    }
    setResetDialogState(prev => ({ ...prev, isOpen: false }));
  };

  // Excel TSV Raw Parser for three modes: Employees, KPIs, NPS
  const handleUploadEmployees = () => {
    if (!pasteEmpText.trim()) {
      setPasteError("الرجاء لصق خلايا من شيت بيانات الموظفين أولاً.");
      return;
    }

    try {
      const lines = pasteEmpText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        setPasteError("لا توجد بيانات صالحة لمعالجتها.");
        return;
      }

      // Auto split based on tab first, then comma
      const detectSeparator = (sampleLine: string): string => {
        if (sampleLine.includes("\t")) return "\t";
        if (sampleLine.includes(",")) return ",";
        return "\t";
      };
      
      const sep = detectSeparator(lines[0] || "");
      const rawRows = lines.map(line => {
        let cells: string[];
        if (sep === ",") {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          cells = result;
        } else {
          cells = line.split("\t");
        }
        return cells.map(cell => cell.trim().replace(/^["']|["']$/g, "").trim());
      });

      processRawEmployeesMatrix(rawRows);
    } catch (e) {
      setPasteError("حدث خطأ أثناء فك تشفير شيت الموظفين. يرجى التأكد من نسخ الأعمدة من إكسيل بشكل صحيح.");
    }
  };

  const processRawEmployeesMatrix = (rawRows: string[][]) => {
    // Heuristic function to detect if a row is a header row
    const isHeaderRow = (rowFields: string[]): boolean => {
      if (rowFields.length === 0) return false;
      const headerKeywords = [
        "id", "code", "كود", "num", "رقم", "name", "الاسم", "اسم", 
        "tl", "leader", "قائد", "team", "تيم", "sv", "supervisor", "مشرف",
        "mobile", "موبايل", "هاتف", "تليفون", "national", "قومي", "بطاقة",
        "location", "موقع", "مقر", "مكان", "lob", "خط", "نوع", "خدمة"
      ];
      let matchCount = 0;
      let nonNumericCount = 0;
      let filledCount = 0;
      rowFields.forEach(cell => {
        const c = cell.toLowerCase().trim();
        if (!c) return;
        filledCount++;
        if (isNaN(Number(c)) || c === "") {
          nonNumericCount++;
        }
        if (headerKeywords.some(keyword => c.includes(keyword))) {
          matchCount++;
        }
      });
      if (filledCount === 0) return false;
      return (matchCount >= 2) || (nonNumericCount / filledCount > 0.6 && filledCount >= 2);
    };

    let headerRowsCountIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 3); i++) {
      if (isHeaderRow(rawRows[i])) {
        headerRowsCountIdx = i + 1;
      } else {
        break;
      }
    }

    const numCols = Math.max(...rawRows.map(r => r.length));
    const combinedHeaders: string[] = Array(numCols).fill("");
    if (headerRowsCountIdx > 0) {
      for (let c = 0; c < numCols; c++) {
        const tokens: string[] = [];
        for (let r = 0; r < headerRowsCountIdx; r++) {
          const cell = rawRows[r][c]?.trim();
          if (cell) tokens.push(cell);
        }
        combinedHeaders[c] = tokens.join(" ").trim();
      }
    }

    // Auto-detect mappings
    let idIdx = 0;
    let nameIdx = 1;
    let tlIdx = 2;
    let svIdx = 3;
    let mobIdx = 4;
    let natIdx = 5;
    let locIdx = 6;
    let lobIdx = 7;

    if (headerRowsCountIdx > 0) {
      // 1. Finding ID Index
      let bestIdScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "id" || norm === "كود") score = 100;
        else if (norm === "كود الموظف" || norm === "الرقم الوظيفي" || norm === "رقم الموظف" || norm === "رقم الكادر" || norm === "كود الموظف") score = 95;
        else if (norm.includes("كود") || norm.includes("الرقم الوظيفي") || norm.includes("id")) score = 80;
        if (score > bestIdScore) {
          bestIdScore = score;
          idIdx = i;
        }
      });

      // 2. Finding Name Index
      let bestNameScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "name" || norm === "الاسم") score = 100;
        else if (norm.includes("اسم الموظف") || norm === "full name" || norm === "الاسم بالكامل" || norm.includes("الاسم الكامل")) score = 95;
        else if (norm.includes("الاسم") || norm.includes("اسم")) score = 60;
        if (norm.includes("tl") || norm.includes("leader") || norm.includes("قائد") || norm.includes("team") || norm.includes("supervisor") || norm.includes("مشرف")) {
          score -= 40; // avoid setting tl/supervisor as name
        }
        if (score > bestNameScore) {
          bestNameScore = score;
          nameIdx = i;
        }
      });

      // 3. Finding TL Index
      let bestTlScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "tl" || norm === "قائد الفريق") score = 100;
        else if (norm.includes("team leader") || norm.includes("تيم ليدر") || norm.includes("قائد")) score = 90;
        else if (norm.includes("leader") || norm.includes("tl")) score = 70;
        if (norm.includes("sv") || norm.includes("supervisor") || norm.includes("مشرف")) {
          score -= 30; // avoid setting sv as tl
        }
        if (score > bestTlScore) {
          bestTlScore = score;
          tlIdx = i;
        }
      });

      // 4. Finding SV Index
      let bestSvScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "sv" || norm === "المشرف") score = 100;
        else if (norm.includes("supervisor") || norm.includes("مشرف") || norm.includes("sv")) score = 90;
        if (score > bestSvScore) {
          bestSvScore = score;
          svIdx = i;
        }
      });

      // 5. Finding Mobile Index
      let bestMobScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "mobile" || norm === "موبايل" || norm.includes("رقم الموبايل") || norm.includes("رقم الهاتف")) score = 100;
        else if (norm.includes("هاتف") || norm.includes("تليفون") || norm.includes("phone")) score = 80;
        if (score > bestMobScore) {
          bestMobScore = score;
          mobIdx = i;
        }
      });

      // 6. Finding National ID Index
      let bestNatScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "national" || norm.includes("قومي") || norm.includes("الرقم القومي") || norm.includes("بطاقة")) score = 100;
        else if (norm.includes("national id") || norm.includes("id")) score = 50;
        if (score > bestNatScore) {
          bestNatScore = score;
          natIdx = i;
        }
      });

      // 7. Finding Location Index
      let bestLocScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "location" || norm === "موقع" || norm === "مقر" || norm === "مكان" || norm === "العمل") score = 100;
        else if (norm.includes("location") || norm.includes("موقع") || norm.includes("مقر")) score = 90;
        if (score > bestLocScore) {
          bestLocScore = score;
          locIdx = i;
        }
      });

      // 8. Finding LOB Index
      let bestLobScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "lob" || norm === "الخط" || norm === "نوع" || norm === "خط العمل") score = 100;
        else if (norm.includes("lob") || norm.includes("خط") || norm.includes("خدمة") || norm.includes("تفاصيل")) score = 90;
        if (score > bestLobScore) {
          bestLobScore = score;
          lobIdx = i;
        }
      });
    }

    setPendingEmpRows(rawRows);
    setEmpMapping({
      idIdx: idIdx < numCols ? idIdx : 0,
      nameIdx: nameIdx < numCols ? nameIdx : 1,
      tlIdx: tlIdx < numCols ? tlIdx : 2,
      svIdx: svIdx < numCols ? svIdx : 3,
      mobIdx: mobIdx < numCols ? mobIdx : 4,
      natIdx: natIdx < numCols ? natIdx : 5,
      locIdx: locIdx < numCols ? locIdx : 6,
      lobIdx: lobIdx < numCols ? lobIdx : 7,
    });
    setDetectedEmpHeaders(combinedHeaders.map((hdr, idx) => {
      const colLabel = getExcelColumnLabel(idx);
      return hdr ? `[العمود ${colLabel}] - ${hdr}` : `العمود ${colLabel} (فارغ)`;
    }));
    setEmpHeaderRowsCount(headerRowsCountIdx);
  };

  const confirmPendingEmployees = () => {
    if (!pendingEmpRows) return;

    try {
      const rows = empHeaderRowsCount > 0 ? pendingEmpRows.slice(empHeaderRowsCount) : pendingEmpRows;
      const updatedEmployees: Employee[] = [];
      let updatedCount = 0;
      let createdCount = 0;

      rows.forEach(row => {
        let id = row[empMapping.idIdx]?.trim() || "";
        if (id.endsWith(".0")) {
          id = id.substring(0, id.length - 2);
        }
        if (!id) return;

        const fullName = empMapping.nameIdx !== -1 && row[empMapping.nameIdx] 
          ? row[empMapping.nameIdx].trim() 
          : `كادر جديد ${id}`;

        const newTL = empMapping.tlIdx !== -1 && row[empMapping.tlIdx]
          ? row[empMapping.tlIdx].trim()
          : "جاري التعيين";

        const newSV = empMapping.svIdx !== -1 && row[empMapping.svIdx]
          ? row[empMapping.svIdx].trim()
          : "Ehab Heness";

        const mobileNumber = empMapping.mobIdx !== -1 && row[empMapping.mobIdx]
          ? row[empMapping.mobIdx].trim()
          : "";

        const nationalId = empMapping.natIdx !== -1 && row[empMapping.natIdx]
          ? row[empMapping.natIdx].trim()
          : "";
        
        let location = "WFH";
        if (empMapping.locIdx !== -1 && row[empMapping.locIdx]) {
          const rawLoc = row[empMapping.locIdx].toLowerCase();
          if (rawLoc.includes("premise") || rawLoc.includes("site") || rawLoc.includes("مقر") || rawLoc.includes("مكتب")) {
            location = "Premise";
          }
        }

        let lob = "Chat / ADSL";
        if (empMapping.lobIdx !== -1 && row[empMapping.lobIdx]) {
          const rawLob = row[empMapping.lobIdx].toLowerCase();
          if (rawLob.includes("mobile") || rawLob.includes("موبايل")) {
            lob = "Chat / Mobile";
          } else if (rawLob.includes("ftth") || rawLob.includes("voice") || rawLob.includes("صوت")) {
            lob = "VOICE / FTTH";
          } else {
            lob = row[empMapping.lobIdx];
          }
        }

        const existingEmp = employees.find(emp => emp.id === id);
        if (existingEmp) {
          updatedEmployees.push({
            ...existingEmp,
            fullName,
            newTL,
            newSV,
            mobileNumber,
            nationalId,
            location,
            lob
          });
          updatedCount++;
        } else {
          updatedEmployees.push({
            id,
            fullName,
            newTL,
            newSV,
            mobileNumber,
            nationalId,
            location,
            lob,
            performance: []
          });
          createdCount++;
        }
      });

      onUpdateEmployees(updatedEmployees);
      setPasteSuccess(`بنجاح! تم تحديث بيانات ${updatedCount} موظفاً، وتسجيل ${createdCount} موظفاً جديداً بسجل المنظومة.`);
      setPasteEmpText("");
      setPasteError("");
      setPendingEmpRows(null);
      setTimeout(() => setPasteSuccess(""), 10000);
    } catch (e) {
      setPasteError("حدث خطأ أثناء رصد بيانات شيت الموظفين. يرجى التحقق من صياغة الأعمدة وملاءمتها.");
    }
  };

  const processRawKpiMatrix = (rawRows: string[][], selectedMonth: string) => {
    // Heuristic function to detect if a row is a header row
    const isHeaderRow = (rowFields: string[]): boolean => {
      if (rowFields.length === 0) return false;
      const headerKeywords = [
        "id", "code", "كود", "num", "رقم", "name", "الاسم", "اسم", 
        "aht", "csi", "nps", "tnps", "fcr", "ttb", "ctc", "ctb", 
        "score", "final", "total", "month", "week", "quality", 
        "absent", "gasp", "sick", "emergency", "unplanned", "reject", 
        "status", "bss", "login", "perm", "task", "supervisor", "leader", "tl", "sv"
      ];
      let matchCount = 0;
      let nonNumericCount = 0;
      let filledCount = 0;
      rowFields.forEach(cell => {
        const c = cell.toLowerCase().trim();
        if (!c) return;
        filledCount++;
        // Non-numeric or a keyword match
        if (isNaN(Number(c)) || c === "") {
          nonNumericCount++;
        }
        if (headerKeywords.some(keyword => c.includes(keyword))) {
          matchCount++;
        }
      });
      if (filledCount === 0) return false;
      return (matchCount >= 2) || (nonNumericCount / filledCount > 0.6 && filledCount >= 3);
    };

    // Detect header row count (up to 3 rows of headers)
    let headerRowsCountIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 3); i++) {
      if (isHeaderRow(rawRows[i])) {
        headerRowsCountIdx = i + 1;
      } else {
        break;
      }
    }

    // Merge header rows vertically and expand merged-cell horizontally to avoid losing context
    const numCols = Math.max(...rawRows.map(r => r.length));
    const propagatedHeaderRows: string[][] = [];
    
    for (let r = 0; r < headerRowsCountIdx; r++) {
      const originalRow = rawRows[r];
      const propRow = [...originalRow];
      let lastVal = "";
      for (let c = 0; c < propRow.length; c++) {
        const cell = propRow[c]?.trim();
        if (cell) {
          lastVal = cell;
        } else if (lastVal) {
          // Propagate generic categorized keywords horizontally
          const lowerLast = lastVal.toLowerCase();
          if (
            lowerLast.includes("aht") || 
            lowerLast.includes("csi") || 
            lowerLast.includes("nps") || 
            lowerLast.includes("quality") || 
            lowerLast.includes("absent") || 
            lowerLast.includes("week") || 
            lowerLast.includes("monthly") ||
            lowerLast.includes("total") ||
            lowerLast.includes("التقييم")
          ) {
            propRow[c] = lastVal;
          }
        }
      }
      propagatedHeaderRows.push(propRow);
    }

    // Generate Combined Headers
    const combinedHeaders: string[] = Array(numCols).fill("");
    for (let c = 0; c < numCols; c++) {
      const tokens: string[] = [];
      for (let r = 0; r < headerRowsCountIdx; r++) {
        const cell = propagatedHeaderRows[r][c]?.trim();
        if (cell) {
          tokens.push(cell);
        }
      }
      combinedHeaders[c] = tokens.join(" ").trim();
    }

    // Auto-detect column mappings
    let idIdx = 0;
    let nameIdx = -1;
    let ahtIdx = 2;
    let csiIdx = 3;
    let npsIdx = 4;
    let fcrIdx = 5;
    let ttbIdx = 6;
    let ctcIdx = 7;
    let ctbIdx = 8;
    let absIdx = 9;
    let sckIdx = 10;
    let emgIdx = 11;
    let unpIdx = 12;
    let scoreIdx = 13;

    if (headerRowsCountIdx > 0) {
      // Find ID column
      let bestIdScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "id" || norm === "كود") {
          score = 100;
        } else if (norm === "كود الموظف" || norm === "الرقم الوظيفي" || norm === "رقم الموظف" || norm === "رقم الكادر" || norm === "kpi id" || norm === "كود_الموظف") {
          score = 95;
        } else if (norm.startsWith("id ") || norm.endsWith(" id") || norm.includes("كود") || norm.includes("الرقم الوظيفي") || norm === "perm" || norm === "login") {
          score = 80;
        } else if (norm.includes("id")) {
          score = 40;
        }
        if (score > bestIdScore) {
          bestIdScore = score;
          idIdx = i;
        }
      });

      // Find Name column
      let bestNameScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "name" || norm === "الاسم") {
          score = 100;
        } else if (norm.includes("اسم الموظف") || norm === "full name" || norm === "الاسم بالكامل" || norm === "الاسم ثنائى") {
          score = 95;
        } else if (norm.includes("name") || norm.includes("الاسم") || norm.includes("اسم")) {
          score = 60;
        }
        if (norm.includes("tl") || norm.includes("leader") || norm.includes("قائد") || norm.includes("team") || norm.includes("supervisor") || norm.includes("مشرف")) {
          score -= 50;
        }
        if (score > bestNameScore) {
          bestNameScore = score;
          nameIdx = i;
        }
      });

      // Find AHT
      let bestAhtScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "aht" || norm.includes("monthly aht") || norm.includes("total aht")) {
          score = 100;
        } else if (norm.includes("aht") || norm.includes("متوسط زمن") || norm.includes("زمن") || norm.includes("متوسط وقت")) {
          score = 90;
        }
        if (score > bestAhtScore) {
          bestAhtScore = score;
          ahtIdx = i;
        }
      });
      if (bestAhtScore < 30 && numCols >= 28) {
        ahtIdx = 27; // AB (approx AB)
      }

      // Find CSI
      let bestCsiScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "csi" || norm.includes("monthly csi") || norm.includes("total csi")) {
          score = 100;
        } else if (norm.includes("csi") || norm.includes("رضا") || norm.includes("satisfaction")) {
          score = 90;
        }
        if (score > bestCsiScore) {
          bestCsiScore = score;
          csiIdx = i;
        }
      });
      if (bestCsiScore < 30 && numCols >= 75) {
        csiIdx = 74; // BW (approx BW)
      }

      // Find NPS
      let bestNpsScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "nps" || norm === "tnps" || norm.endsWith("nps%")) {
          score = 100;
        } else if (norm.includes("nps") || norm.includes("مؤشر رضا") || norm.includes("توصية") || norm.includes("promoter")) {
          score = 80;
        }
        if (score > bestNpsScore) {
          bestNpsScore = score;
          npsIdx = i;
        }
      });

      // Find FCR
      let bestFcrScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "fcr" || norm === "fcr%") {
          score = 100;
        } else if (norm.includes("fcr") || norm.includes("حل")) {
          score = 80;
        }
        if (score > bestFcrScore) {
          bestFcrScore = score;
          fcrIdx = i;
        }
      });

      // Find TTB
      let bestTtbScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "ttb" || norm === "ttb%") {
          score = 100;
        } else if (norm.includes("ttb") || norm.includes("top box") || norm.includes("أعلى")) {
          score = 80;
        }
        if (score > bestTtbScore) {
          bestTtbScore = score;
          ttbIdx = i;
        }
      });

      // Find CTC (CD: index 81)
      let bestCtcScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "ctc" || norm === "ctc%") {
          score = 100;
        } else if (norm.includes("ctc") || norm.includes("تذمر") || norm.includes("عدم رضا")) {
          score = 90;
        }
        if (score > bestCtcScore) {
          bestCtcScore = score;
          ctcIdx = i;
        }
      });
      if (bestCtcScore < 30 && numCols >= 82) {
        ctcIdx = 81; // CD
      }

      // Find CTB (CE: index 82)
      let bestCtbScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "ctb" || norm === "ctb%") {
          score = 100;
        } else if (norm.includes("ctb") || norm.includes("سلوك") || norm.includes("سلوكيات")) {
          score = 90;
        }
        if (score > bestCtbScore) {
          bestCtbScore = score;
          ctbIdx = i;
        }
      });
      if (bestCtbScore < 30 && numCols >= 83) {
        ctbIdx = 82; // CE
      }

      // Find Absent (CJ: index 87)
      let bestAbsScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "absent" || norm === "غياب") {
          score = 100;
        } else if (norm.includes("absent") || norm.includes("الغياب") || norm.includes("غياب")) {
          score = 90;
        }
        if (norm.includes("sick") || norm.includes("emergency") || norm.includes("unplanned") || norm.includes("طارئ") || norm.includes("مرضي") || norm.includes("فجائي")) {
          score -= 50; 
        }
        if (score > bestAbsScore) {
          bestAbsScore = score;
          absIdx = i;
        }
      });
      if (bestAbsScore < 30 && numCols >= 88) {
        absIdx = 87; // CJ
      }

      // Find Sick (CH: index 85)
      let bestSckScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "sick" || norm.includes("مرضي")) {
          score = 100;
        } else if (norm.includes("sick") || norm.includes("المرضي")) {
          score = 90;
        }
        if (score > bestSckScore) {
          bestSckScore = score;
          sckIdx = i;
        }
      });
      if (bestSckScore < 30 && numCols >= 86) {
        sckIdx = 85; // CH
      }

      // Find Emergency (CI: index 86)
      let bestEmgScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "emergency" || norm === "عارضة" || norm === "طارئ") {
          score = 100;
        } else if (norm.includes("emergency") || norm.includes("عارضة") || norm.includes("إجازة عارضة") || norm.includes("طارئ")) {
          score = 90;
        }
        if (score > bestEmgScore) {
          bestEmgScore = score;
          emgIdx = i;
        }
      });
      if (bestEmgScore < 30 && numCols >= 87) {
        emgIdx = 86; // CI
      }

      // Find Unplanned (CK: index 88)
      let bestUnpScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "unplanned" || norm === "فجائي") {
          score = 100;
        } else if (norm.includes("unplanned") || norm.includes("فجائي") || norm.includes("مفاجئ") || norm.includes("unplanned leave")) {
          score = 90;
        }
        if (score > bestUnpScore) {
          bestUnpScore = score;
          unpIdx = i;
        }
      });
      if (bestUnpScore < 30 && numCols >= 89) {
        unpIdx = 88; // CK
      }

      // Find Final Score (DA: index 104)
      let bestScoreScore = -1;
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase().trim();
        let score = 0;
        if (norm === "final score" || norm === "التقييم النهائي") {
          score = 100;
        } else if (norm.includes("final") || norm.includes("النهائي") || norm.includes("score") || norm.includes("تقييم")) {
          score = 85;
        }
        if (norm.includes("aht") || norm.includes("csi") || norm.includes("nps") || norm.includes("quality") || norm.includes("ctc") || norm.includes("ctb")) {
          score -= 45;
        }
        if (score > bestScoreScore) {
          bestScoreScore = score;
          scoreIdx = i;
        }
      });
      if (bestScoreScore < 30 && numCols >= 105) {
        scoreIdx = 104; // DA
      }
    } else {
      // Default guess if we have lots of columns (AB, BW ... DA are populated)
      if (numCols >= 105) {
        idIdx = 0;
        nameIdx = 1;
        ahtIdx = 27; // AB
        csiIdx = 74; // BW
        npsIdx = 4;
        fcrIdx = 5;
        ttbIdx = 6;
        ctcIdx = 81; // CD
        ctbIdx = 82; // CE
        sckIdx = 85; // CH
        emgIdx = 86; // CI
        absIdx = 87; // CJ
        unpIdx = 88; // CK
        scoreIdx = 104; // DA
      }
    }

    setPendingKpiRows(rawRows);
    setPendingKpiMonth(selectedMonth);
    setKpiMapping({
      idIdx,
      nameIdx,
      ahtIdx,
      csiIdx,
      npsIdx: npsIdx < numCols ? npsIdx : 4,
      fcrIdx: fcrIdx < numCols ? fcrIdx : 5,
      ttbIdx: ttbIdx < numCols ? ttbIdx : 6,
      ctcIdx: ctcIdx < numCols ? ctcIdx : 7,
      ctbIdx: ctbIdx < numCols ? ctbIdx : 8,
      absIdx: absIdx < numCols ? absIdx : 9,
      sckIdx: sckIdx < numCols ? sckIdx : 10,
      emgIdx: emgIdx < numCols ? emgIdx : 11,
      unpIdx: unpIdx < numCols ? unpIdx : 12,
      scoreIdx: scoreIdx < numCols ? scoreIdx : 13
    });
    setDetectedHeaders(combinedHeaders.map((hdr, idx) => {
      const colLabel = getExcelColumnLabel(idx);
      return hdr ? `[العمود ${colLabel}] - ${hdr}` : `العمود ${colLabel} (فارغ)`;
    }));
    setHeaderRowsCount(headerRowsCountIdx);
  };

  const confirmPendingKpi = () => {
    if (!pendingKpiRows || !pendingKpiMonth) return;

    try {
      const rows = headerRowsCount > 0 ? pendingKpiRows.slice(headerRowsCount) : pendingKpiRows;
      const updatedEmployees = [...employees];
      let matchedCount = 0;
      let draftedCount = 0;

      rows.forEach(row => {
        let id = row[kpiMapping.idIdx]?.trim() || "";
        if (id.endsWith(".0")) {
          id = id.substring(0, id.length - 2);
        }
        if (!id || id === "") return;

        const fullName = kpiMapping.nameIdx !== -1 && row[kpiMapping.nameIdx] 
          ? row[kpiMapping.nameIdx].trim() 
          : `موظف كود ${id}`;
        
        // 1. AHT Parse
        let aht = "07:20";
        if (kpiMapping.ahtIdx !== -1 && row[kpiMapping.ahtIdx]) {
          const rawAht = row[kpiMapping.ahtIdx].trim();
          const num = Number(rawAht);
          if (!isNaN(num) && num > 0) {
            let totalSecs = 0;
            if (num < 1) {
              totalSecs = Math.round(num * 86400);
            } else {
              totalSecs = Math.round(num);
            }
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            aht = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          } else if (rawAht.includes(":")) {
            const parts = rawAht.split(":");
            if (parts.length === 3) {
              const hr = parseInt(parts[0], 10) || 0;
              const min = parseInt(parts[1], 10) || 0;
              const sec = parseInt(parts[2], 10) || 0;
              const totalMins = hr * 60 + min;
              aht = `${String(totalMins).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            } else if (parts.length === 2) {
              const min = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
              const sec = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
              aht = `${min}:${sec}`;
            }
          } else {
            aht = rawAht;
          }
        }

        const csi = kpiMapping.csiIdx !== -1 ? parsePercentageVal(row[kpiMapping.csiIdx] || "", 40) : 40;
        const nps = kpiMapping.npsIdx !== -1 ? parsePercentageVal(row[kpiMapping.npsIdx] || "", 39) : 39;
        const fcr = kpiMapping.fcrIdx !== -1 ? parsePercentageVal(row[kpiMapping.fcrIdx] || "", 65) : 65;
        const ttb = kpiMapping.ttbIdx !== -1 ? parsePercentageVal(row[kpiMapping.ttbIdx] || "", 85) : 85;
        const ctc = kpiMapping.ctcIdx !== -1 ? parsePercentageVal(row[kpiMapping.ctcIdx] || "", 15) : 15;
        const ctb = kpiMapping.ctbIdx !== -1 ? parsePercentageVal(row[kpiMapping.ctbIdx] || "", 10) : 10;

        const absent = kpiMapping.absIdx !== -1 ? parseInt(row[kpiMapping.absIdx] || "0", 10) : 0;
        const sick = kpiMapping.sckIdx !== -1 ? parseInt(row[kpiMapping.sckIdx] || "0", 10) : 0;
        const emergency = kpiMapping.emgIdx !== -1 ? parseInt(row[kpiMapping.emgIdx] || "0", 10) : 0;
        const unplanned = kpiMapping.unpIdx !== -1 ? parseInt(row[kpiMapping.unpIdx] || "0", 10) : 0;
        const finalScore = kpiMapping.scoreIdx !== -1 ? parsePercentageVal(row[kpiMapping.scoreIdx] || "", 52) : 52;

        let empIndex = updatedEmployees.findIndex(e => e.id === id);
        if (empIndex === -1) {
          const newDraft: Employee = {
            id,
            fullName,
            newTL: "جاري تعيين قائد فريق",
            newSV: "إدارة العمليات",
            mobileNumber: "",
            nationalId: "",
            location: "WFH",
            lob: "Chat / ADSL",
            performance: []
          };
          updatedEmployees.push(newDraft);
          empIndex = updatedEmployees.length - 1;
          draftedCount++;
        }

        const perfEntry: MonthlyPerformance = {
          month: pendingKpiMonth,
          aht,
          csi,
          nps,
          fcr,
          ttb,
          ctc,
          ctb,
          absent: isNaN(absent) ? 0 : absent,
          sick: isNaN(sick) ? 0 : sick,
          emergency: isNaN(emergency) ? 0 : emergency,
          unplanned: isNaN(unplanned) ? 0 : unplanned,
          finalScore: isNaN(finalScore) ? 52 : finalScore
        };

        const perfIdx = updatedEmployees[empIndex].performance.findIndex(p => p.month === pendingKpiMonth);
        if (perfIdx > -1) {
          updatedEmployees[empIndex].performance[perfIdx] = perfEntry;
        } else {
          updatedEmployees[empIndex].performance.push(perfEntry);
        }
        matchedCount++;
      });

      onUpdateEmployees(updatedEmployees);

      setPasteSuccess(`تم تحديث شيت الـ KPI بنجاح! تم رصد مؤشرات الأداء لـ ${matchedCount} موظفاً لشهر ${pendingKpiMonth}. (تم استحداث ${draftedCount} ملفات كادر مؤقتة للأكواد غير المسجلة مسبقاً)`);
      setPasteKpiText("");
      setPasteError("");
      setPendingKpiRows(null);
      setPendingKpiMonth("");
      
      setTimeout(() => setPasteSuccess(""), 15000);
    } catch (e) {
      setPasteError("حدث خطأ غير متوقع أثناء رصد البيانات. يرجى التحقق من صياغة الأعمدة وملاءمتها للموظفين.");
    }
  };

  const processRawNpsMatrix = (rawRows: string[][], selectedMonth: string) => {
    // Heuristic function to detect if a row is a header row
    const isHeaderRow = (rowFields: string[]): boolean => {
      if (rowFields.length === 0) return false;
      const headerKeywords = [
        "id", "code", "كود", "num", "رقم",
        "nps", "tnps", "fcr", "ttb", "توصية", "الاستطلاع"
      ];
      let matchCount = 0;
      let nonNumericCount = 0;
      let filledCount = 0;
      rowFields.forEach(cell => {
        const c = cell.toLowerCase().trim();
        if (!c) return;
        filledCount++;
        if (isNaN(Number(c)) || c === "") {
          nonNumericCount++;
        }
        if (headerKeywords.some(keyword => c.includes(keyword))) {
          matchCount++;
        }
      });
      if (filledCount === 0) return false;
      return (matchCount >= 2) || (nonNumericCount / filledCount > 0.6 && filledCount >= 2);
    };

    let npsHeaderRowsCountIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 3); i++) {
      if (isHeaderRow(rawRows[i])) {
        npsHeaderRowsCountIdx = i + 1;
      } else {
        break;
      }
    }

    const numCols = Math.max(...rawRows.map(r => r.length));
    const combinedHeaders: string[] = Array(numCols).fill("");
    if (npsHeaderRowsCountIdx > 0) {
      for (let c = 0; c < numCols; c++) {
        const tokens: string[] = [];
        for (let r = 0; r < npsHeaderRowsCountIdx; r++) {
          const cell = rawRows[r][c]?.trim();
          if (cell) tokens.push(cell);
        }
        combinedHeaders[c] = tokens.join(" ").trim();
      }
    }

    let idIdx = 0;
    let npsIdx = 5;
    let fcrIdx = 6;
    let ttbIdx = 7;

    if (npsHeaderRowsCountIdx > 0) {
      combinedHeaders.forEach((h, i) => {
        const norm = h.toLowerCase();
        if (norm === "id" || norm === "كود" || norm.includes("id") || norm.includes("كود")) idIdx = i;
        else if (norm === "nps" || norm.includes("nps") || norm.includes("توصية")) npsIdx = i;
        else if (norm === "fcr" || norm.includes("fcr")) fcrIdx = i;
        else if (norm === "ttb" || norm.includes("ttb")) ttbIdx = i;
      });
    }

    setPendingNpsRows(rawRows);
    setPendingNpsMonth(selectedMonth);
    setNpsMapping({
      idIdx: idIdx < numCols ? idIdx : 0,
      npsIdx: npsIdx < numCols ? npsIdx : 5,
      fcrIdx: fcrIdx < numCols ? fcrIdx : 6,
      ttbIdx: ttbIdx < numCols ? ttbIdx : 7,
    });
    setDetectedNpsHeaders(combinedHeaders.map((hdr, idx) => {
      const colLabel = getExcelColumnLabel(idx);
      return hdr ? `[العمود ${colLabel}] - ${hdr}` : `العمود ${colLabel} (فارغ)`;
    }));
    setNpsHeaderRowsCount(npsHeaderRowsCountIdx);
  };

  const confirmPendingNps = () => {
    if (!pendingNpsRows || !pendingNpsMonth) return;

    try {
      const rows = npsHeaderRowsCount > 0 ? pendingNpsRows.slice(npsHeaderRowsCount) : pendingNpsRows;
      const updatedEmployees = [...employees];
      let matchedCount = 0;
      let draftedCount = 0;

      rows.forEach(row => {
        let id = row[npsMapping.idIdx]?.trim() || "";
        if (id.endsWith(".0")) {
          id = id.substring(0, id.length - 2);
        }
        if (!id) return;

        const nps = parsePercentageVal(row[npsMapping.npsIdx] || "", 39);
        const fcr = parsePercentageVal(row[npsMapping.fcrIdx] || "", 65);
        const ttb = parsePercentageVal(row[npsMapping.ttbIdx] || "", 85);

        let empIndex = updatedEmployees.findIndex(e => e.id === id);
        if (empIndex === -1) {
          const newDraft: Employee = {
            id,
            fullName: `موظف كود ${id}`,
            newTL: "جاري تعيين قائد فريق",
            newSV: "إدارة العمليات",
            mobileNumber: "",
            nationalId: "",
            location: "WFH",
            lob: "Chat / ADSL",
            performance: []
          };
          updatedEmployees.push(newDraft);
          empIndex = updatedEmployees.length - 1;
          draftedCount++;
        }

        const perfIdx = updatedEmployees[empIndex].performance.findIndex(p => p.month === pendingNpsMonth);
        if (perfIdx > -1) {
          updatedEmployees[empIndex].performance[perfIdx].nps = nps;
          updatedEmployees[empIndex].performance[perfIdx].fcr = fcr;
          updatedEmployees[empIndex].performance[perfIdx].ttb = ttb;
          matchedCount++;
        } else {
          updatedEmployees[empIndex].performance.push({
            month: pendingNpsMonth,
            aht: "07:20",
            csi: 40,
            nps: nps,
            fcr: fcr,
            ttb: ttb,
            ctc: 15,
            ctb: 10,
            absent: 0,
            sick: 0,
            emergency: 0,
            unplanned: 0,
            finalScore: 52
          });
          matchedCount++;
        }
      });

      onUpdateEmployees(updatedEmployees);
      setPasteSuccess(`تم تحديث شيت إضافات NPS بنجاح لعدد ${matchedCount} موظفاً (وتم إنشاء ${draftedCount} ملف كادر مؤقت).`);
      setPasteNpsText("");
      setPasteError("");
      setPendingNpsRows(null);
      setPendingNpsMonth("");
      
      setTimeout(() => setPasteSuccess(""), 15000);
    } catch (e) {
      setPasteError("حدث خطأ غير متوقع أثناء رصد البيانات. يرجى التحقق من الخصائص.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      fileReader.onload = (evt) => {
        try {
          const ab = evt.target?.result as ArrayBuffer;
          const workbook = XLSX.read(ab, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to raw array of arrays of strings
          const rawSheetRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          
          // Map values to string matrix
          const rawRows: string[][] = rawSheetRows.map(row => 
            Array.isArray(row) 
              ? row.map(cell => cell === null || cell === undefined ? "" : String(cell).trim())
              : []
          ).filter(row => row.length > 0);

          if (rawRows.length === 0) {
            setPasteError("لم نجد بيانات صالحة في ملف الاكسيل المرفوع.");
            return;
          }

          if (uploadMode === "employees") {
            processRawEmployeesMatrix(rawRows);
          } else if (uploadMode === "nps") {
            processRawNpsMatrix(rawRows, pasteNpsMonth);
          } else {
            processRawKpiMatrix(rawRows, pasteKpiMonth);
          }
        } catch (error) {
          setPasteError("حدث خطأ أثناء قراءة ملف الاكسيل. تأكد من أن الملف سليم.");
        }
      };
      fileReader.readAsArrayBuffer(file);
    } else {
      // Treat as CSV, TSV or TXT
      fileReader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          if (!text.trim()) {
            setPasteError("الملف المرفوع فارغ.");
            return;
          }

          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          
          // Auto split based on tab first, then comma
          const detectSeparator = (sampleLine: string): string => {
            if (sampleLine.includes("\t")) return "\t";
            if (sampleLine.includes(",")) return ",";
            return "\t";
          };
          
          const sep = detectSeparator(lines[0] || "");
          const rawRows = lines.map(line => {
            let cells: string[];
            if (sep === ",") {
              // Quote-aware splitting
              const result: string[] = [];
              let current = '';
              let inQuotes = false;
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  result.push(current);
                  current = '';
                } else {
                  current += char;
                }
              }
              result.push(current);
              cells = result;
            } else {
              cells = line.split("\t");
            }
            return cells.map(cell => cell.trim().replace(/^["']|["']$/g, "").trim());
          });

          if (uploadMode === "employees") {
            processRawEmployeesMatrix(rawRows);
          } else if (uploadMode === "nps") {
            processRawNpsMatrix(rawRows, pasteNpsMonth);
          } else {
            processRawKpiMatrix(rawRows, pasteKpiMonth);
          }
        } catch (error) {
          setPasteError("حدث خطأ أثناء قراءة ملف CSV. تأكد من ترميز الملف المرفوع.");
        }
      };
      fileReader.readAsText(file, "UTF-8");
    }
    
    // reset target value so the same file name can be uploaded again
    e.target.value = "";
  };

  const handleUploadKPI = async () => {
    if (!pasteKpiText.trim()) {
      setPasteError(`الرجاء لصق خلايا من شيت الـ KPI لشهر ${pasteKpiMonth} أولاً.`);
      return;
    }

    try {
      const lines = pasteKpiText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        setPasteError("لا توجد بيانات صالحة لمعالجتها.");
        return;
      }

      // Auto split based on tab first, then comma
      const detectSeparator = (sampleLine: string): string => {
        if (sampleLine.includes("\t")) return "\t";
        if (sampleLine.includes(",")) return ",";
        return "\t";
      };
      
      const sep = detectSeparator(lines[0] || "");
      const rawRows = lines.map(line => {
        let cells: string[];
        if (sep === ",") {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          cells = result;
        } else {
          cells = line.split("\t");
        }
        return cells.map(cell => cell.trim().replace(/^["']|["']$/g, "").trim());
      });

      processRawKpiMatrix(rawRows, pasteKpiMonth);
      return;
      
      // Heuristic function to detect if a row is a header row
      const isHeaderRow = (rowFields: string[]): boolean => {
        if (rowFields.length === 0) return false;
        const headerKeywords = [
          "id", "code", "كود", "num", "رقم", "name", "الاسم", "اسم", 
          "aht", "csi", "nps", "tnps", "fcr", "ttb", "ctc", "ctb", 
          "score", "final", "total", "month", "week", "quality", 
          "absent", "gasp", "sick", "emergency", "unplanned", "reject", 
          "status", "bss", "login", "perm", "task", "supervisor", "leader", "tl", "sv"
        ];
        let matchCount = 0;
        let nonNumericCount = 0;
        let filledCount = 0;
        rowFields.forEach(cell => {
          const c = cell.toLowerCase().trim();
          if (!c) return;
          filledCount++;
          // Non-numeric or a keyword match
          if (isNaN(Number(c)) || c === "") {
            nonNumericCount++;
          }
          if (headerKeywords.some(keyword => c.includes(keyword))) {
            matchCount++;
          }
        });
        if (filledCount === 0) return false;
        return (matchCount >= 2) || (nonNumericCount / filledCount > 0.6 && filledCount >= 3);
      };

      // Detect header row count (up to 3 rows of headers)
      let headerRowsCount = 0;
      for (let i = 0; i < Math.min(rawRows.length, 3); i++) {
        if (isHeaderRow(rawRows[i])) {
          headerRowsCount = i + 1;
        } else {
          break;
        }
      }

      // Merge header rows vertically and expand merged-cell horizontally to avoid losing context
      const numCols = Math.max(...rawRows.map(r => r.length));
      const propagatedHeaderRows: string[][] = [];
      
      for (let r = 0; r < headerRowsCount; r++) {
        const originalRow = rawRows[r];
        const propRow = [...originalRow];
        let lastVal = "";
        for (let c = 0; c < propRow.length; c++) {
          const cell = propRow[c]?.trim();
          if (cell) {
            lastVal = cell;
          } else if (lastVal) {
            // Propagate generic categorized keywords horizontally
            const lowerLast = lastVal.toLowerCase();
            if (
              lowerLast.includes("aht") || 
              lowerLast.includes("csi") || 
              lowerLast.includes("nps") || 
              lowerLast.includes("quality") || 
              lowerLast.includes("absent") || 
              lowerLast.includes("week") || 
              lowerLast.includes("monthly") ||
              lowerLast.includes("total") ||
              lowerLast.includes("التقييم")
            ) {
              propRow[c] = lastVal;
            }
          }
        }
        propagatedHeaderRows.push(propRow);
      }

      // Generate Combined Headers
      const combinedHeaders: string[] = Array(numCols).fill("");
      for (let c = 0; c < numCols; c++) {
        const tokens: string[] = [];
        for (let r = 0; r < headerRowsCount; r++) {
          const cell = propagatedHeaderRows[r][c]?.trim();
          if (cell) {
            tokens.push(cell);
          }
        }
        combinedHeaders[c] = tokens.join(" ").trim();
      }

      // Initialize column index mapping
      let idIdx = 0, nameIdx = 1, ahtIdx = 2, csiIdx = 3, npsIdx = 4, fcrIdx = 5, ttbIdx = 6, ctcIdx = 7, ctbIdx = 8, absIdx = 9, sckIdx = 10, emgIdx = 11, unpIdx = 12, scoreIdx = 13;

      if (headerRowsCount > 0) {
        // 1. Employee ID matching
        let bestIdScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          let score = 0;
          if (norm === "id" || norm === "كود") {
            score = 100;
          } else if (norm.startsWith("id ") || norm.endsWith(" id") || norm === "الرقم الوظيفي" || norm === "كود الموظف" || norm === "perm") {
            score = 90;
          } else if (norm.includes("id") || norm.includes("كود")) {
            score = 55;
          } else if (norm.includes("perm") || norm.includes("login")) {
            score = 30;
          }
          if (score > bestIdScore) {
            bestIdScore = score;
            idIdx = i;
          }
        });

        // 2. Employee Name matching
        let bestNameScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          let score = 0;
          if (norm === "name" || norm === "الاسم") {
            score = 100;
          } else if (norm.includes("اسم الموظف") || norm === "full name" || norm === "الاسم بالكامل") {
            score = 90;
          } else if (norm.includes("name") || norm.includes("الاسم") || norm.includes("اسم")) {
            score = 60;
          }
          if (norm.includes("tl") || norm.includes("leader") || norm.includes("قائد") || norm.includes("team") || norm.includes("supervisor") || norm.includes("مشرف") || norm.includes("sv") || norm.includes("manager")) {
            score -= 45;
          }
          if (score > bestNameScore) {
            bestNameScore = score;
            nameIdx = i;
          }
        });

        // 3. Monthly AHT matching
        let bestAhtScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("aht") && !norm.includes("متوسط") && !norm.includes("زمن") && !norm.includes("سرعة")) return;
          let score = 0;
          if (norm.includes("monthly aht") || norm.includes("weekly sc aht") || norm.includes("total aht")) {
            score = 100;
          } else if (norm.includes("aht") && (norm.includes("monthly") || norm.includes("المعدل") || norm.includes("متوسط") || norm.includes("الشهري") || norm.includes("total"))) {
            score = 90;
          } else if (norm.includes("aht") && !norm.includes("week") && !norm.includes("w1") && !norm.includes("w2") && !norm.includes("w3") && !norm.includes("w4")) {
            score = 75;
          } else if (norm.includes("aht")) {
            score = 25; // lower priority for weekly
          }
          if (score > bestAhtScore) {
            bestAhtScore = score;
            ahtIdx = i;
          }
        });

        // 4. CSI matching
        let bestCsiScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("csi") && !norm.includes("رضا") && !norm.includes("satisfaction")) return;
          let score = 0;
          if (norm.includes("monthly csi") || norm.includes("total csi") || (norm.includes("csi") && norm.includes("total"))) {
            score = 100;
          } else if (norm.includes("csi") && !norm.includes("week") && !norm.includes("w1") && !norm.includes("w2") && !norm.includes("w3") && !norm.includes("w4")) {
            score = 80;
          } else if (norm.includes("csi") || norm.includes("رضا")) {
            score = 50;
          }
          if (score > bestCsiScore) {
            bestCsiScore = score;
            csiIdx = i;
          }
        });

        // 5. NPS matching
        let bestNpsScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("nps") && !norm.includes("مؤشر") && !norm.includes("توصية") && !norm.includes("promoter")) return;
          let score = 0;
          if (norm.includes("monthly nps") || norm.includes("total nps") || norm.includes("tnps%")) {
            score = 100;
          } else if (norm.includes("nps") && !norm.includes("week") && !norm.includes("w1") && !norm.includes("w2") && !norm.includes("w3") && !norm.includes("w4")) {
            score = 80;
          } else if (norm.includes("nps") || norm.includes("tnps")) {
            score = 60;
          }
          if (score > bestNpsScore) {
            bestNpsScore = score;
            npsIdx = i;
          }
        });

        // 6. FCR matching
        let bestFcrScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("fcr") && !norm.includes("حل")) return;
          let score = 0;
          if (norm.includes("fcr%") || norm === "fcr") {
            score = 100;
          } else if (norm.includes("fcr")) {
            score = 80;
          } else if (norm.includes("حل")) {
            score = 50;
          }
          if (score > bestFcrScore) {
            bestFcrScore = score;
            fcrIdx = i;
          }
        });

        // 7. TTB matching
        let bestTtbScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("ttb") && !norm.includes("top box") && !norm.includes("أعلى")) return;
          let score = 0;
          if (norm.includes("ttb%") || norm === "ttb" || norm.includes("top box")) {
            score = 100;
          } else if (norm.includes("ttb")) {
            score = 80;
          } else if (norm.includes("أعلى")) {
            score = 50;
          }
          if (score > bestTtbScore) {
            bestTtbScore = score;
            ttbIdx = i;
          }
        });

        // 8. CTC matching
        let bestCtcScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("ctc") && !norm.includes("تذمر")) return;
          let score = 0;
          if (norm.includes("ctc%") || norm.includes("ctc score") || norm.includes("ctc errors")) {
            score = 100;
          } else if (norm.includes("ctc")) {
            score = 80;
          }
          if (score > bestCtcScore) {
            bestCtcScore = score;
            ctcIdx = i;
          }
        });

        // 9. CTB matching
        let bestCtbScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("ctb") && !norm.includes("سلوك")) return;
          let score = 0;
          if (norm.includes("ctb%") || norm.includes("ctb score") || norm.includes("ctb errors")) {
            score = 100;
          } else if (norm.includes("ctb")) {
            score = 80;
          }
          if (score > bestCtbScore) {
            bestCtbScore = score;
            ctbIdx = i;
          }
        });

        // 10. Absent matching
        let bestAbsScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("absent") && !norm.includes("غياب") && !norm.includes("غائب")) return;
          let score = 0;
          if (norm === "absent" || norm === "الغياب" || norm === "غياب") {
            score = 100;
          } else if (norm.includes("absent") && !norm.includes("sick") && !norm.includes("emergency") && !norm.includes("unplanned")) {
            score = 80;
          }
          if (score > bestAbsScore) {
            bestAbsScore = score;
            absIdx = i;
          }
        });

        // 11. Sick matching
        let bestSckScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("sick") && !norm.includes("مرضي") && !norm.includes("مرضى")) return;
          let score = 0;
          if (norm === "sick" || norm.includes("sick leave") || norm.includes("مرضي")) {
            score = 100;
          } else if (norm.includes("sick")) {
            score = 80;
          }
          if (score > bestSckScore) {
            bestSckScore = score;
            sckIdx = i;
          }
        });

        // 12. Emergency matching
        let bestEmgScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("emergency") && !norm.includes("طارئ") && !norm.includes("عارضة")) return;
          let score = 0;
          if (norm === "emergency" || norm.includes("emergency leave") || norm.includes("طارئ") || norm.includes("عارضة")) {
            score = 100;
          } else if (norm.includes("emergency")) {
            score = 80;
          }
          if (score > bestEmgScore) {
            bestEmgScore = score;
            emgIdx = i;
          }
        });

        // 13. Unplanned matching
        let bestUnpScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("unplanned") && !norm.includes("فجائي") && !norm.includes("مفاجئ") && !norm.includes("nned early")) return;
          let score = 0;
          if (norm === "unplanned" || norm.includes("unplanned leave") || norm.includes("فجائي") || norm.includes("nned early")) {
            score = 100;
          } else if (norm.includes("unplanned")) {
            score = 80;
          }
          if (score > bestUnpScore) {
            bestUnpScore = score;
            unpIdx = i;
          }
        });

        // 14. Final Score matching
        let bestScoreScore = -1;
        combinedHeaders.forEach((h, i) => {
          const norm = h.toLowerCase().trim();
          if (!norm.includes("score") && !norm.includes("نهائي") && !norm.includes("النهائي") && !norm.includes("تقييم")) return;
          let score = 0;
          if (norm === "final score" || norm === "التقييم النهائي" || norm === "التقييم العام" || norm === "النتيجة النهائية") {
            score = 100;
          } else if (norm.includes("final score") || norm.includes("final_score") || norm.includes("النهائي")) {
            score = 90;
          } else if (norm === "score" || norm === "الدرجة" || norm === "التقييم") {
            score = 50;
          }
          if (norm.includes("aht") || norm.includes("csi") || norm.includes("nps") || norm.includes("quality") || norm.includes("ctc") || norm.includes("ctb")) {
            score -= 45;
          }
          if (score > bestScoreScore) {
            bestScoreScore = score;
            scoreIdx = i;
          }
        });
      }

      const rows = headerRowsCount > 0 ? rawRows.slice(headerRowsCount) : rawRows;
      const updatedEmployees = [...employees];
      let matchedCount = 0;
      let draftedCount = 0;

      rows.forEach(row => {
        const id = row[idIdx]?.trim();
        if (!id) return;

        const fullName = row[nameIdx]?.trim() || `موظف كود ${id}`;
        
        let aht = row[ahtIdx]?.trim() || "07:20";
        // Support hh:mm:ss format or decimal seconds or standard mm:ss
        const num = Number(aht);
        if (aht && !isNaN(num) && num > 0) {
          let totalSecs = 0;
          if (num < 1) {
            totalSecs = Math.round(num * 86400);
          } else {
            totalSecs = Math.round(num);
          }
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          aht = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else if (aht && aht.includes(":")) {
          const parts = aht.split(":");
          if (parts.length === 3) {
            const hr = parseInt(parts[0], 10) || 0;
            const min = parseInt(parts[1], 10) || 0;
            const sec = parseInt(parts[2], 10) || 0;
            const totalMins = hr * 60 + min;
            aht = `${String(totalMins).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
          } else if (parts.length === 2) {
            const min = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
            const sec = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
            aht = `${min}:${sec}`;
          }
        }

        const csi = parsePercentageVal(row[csiIdx] || "", 40);
        const nps = parsePercentageVal(row[npsIdx] || "", 39);
        const fcr = parsePercentageVal(row[fcrIdx] || "", 65);
        const ttb = parsePercentageVal(row[ttbIdx] || "", 85);
        const ctc = parsePercentageVal(row[ctcIdx] || "", 15);
        const ctb = parsePercentageVal(row[ctbIdx] || "", 10);

        const absent = parseInt(row[absIdx] || "0", 10);
        const sick = parseInt(row[sckIdx] || "0", 10);
        const emergency = parseInt(row[emgIdx] || "0", 10);
        const unplanned = parseInt(row[unpIdx] || "0", 10);
        const finalScore = parsePercentageVal(row[scoreIdx] || "", 52);

        let empIndex = updatedEmployees.findIndex(e => e.id === id);
        if (empIndex === -1) {
          const newDraft: Employee = {
            id,
            fullName,
            newTL: "جاري تعيين قائد فريق",
            newSV: "إدارة العمليات",
            mobileNumber: "",
            nationalId: "",
            location: "WFH",
            lob: "Chat / ADSL",
            performance: []
          };
          updatedEmployees.push(newDraft);
          empIndex = updatedEmployees.length - 1;
          draftedCount++;
        }

        const perfEntry: MonthlyPerformance = {
          month: pasteKpiMonth,
          aht,
          csi: isNaN(csi) ? 40 : csi,
          nps: isNaN(nps) ? 39 : nps,
          fcr: isNaN(fcr) ? 65 : fcr,
          ttb: isNaN(ttb) ? 85 : ttb,
          ctc: isNaN(ctc) ? 15 : ctc,
          ctb: isNaN(ctb) ? 10 : ctb,
          absent: isNaN(absent) ? 0 : absent,
          sick: isNaN(sick) ? 0 : sick,
          emergency: isNaN(emergency) ? 0 : emergency,
          unplanned: isNaN(unplanned) ? 0 : unplanned,
          finalScore: isNaN(finalScore) ? 52 : finalScore
        };

        const perfIdx = updatedEmployees[empIndex].performance.findIndex(p => p.month === pasteKpiMonth);
        if (perfIdx > -1) {
          updatedEmployees[empIndex].performance[perfIdx] = perfEntry;
        } else {
          updatedEmployees[empIndex].performance.push(perfEntry);
        }
        matchedCount++;
      });

      // Construct highly specific and useful metadata mapped column report
      let mappingReport = "";
      if (headerRowsCount > 0) {
        mappingReport = `\n\n📌 مطابقة الأعمدة الذكية (VLOOKUP):\n` +
          `• كود الموظف (ID): "${combinedHeaders[idIdx] || `العمود رقم ${idIdx + 1}`}"\n` +
          `• اسم الموظف (Name): "${combinedHeaders[nameIdx] || `العمود رقم ${nameIdx + 1}`}"\n` +
          `• معدل AHT: "${combinedHeaders[ahtIdx] || `العمود رقم ${ahtIdx + 1}`}"\n` +
          `• مؤشر رضا العملاء CSI: "${combinedHeaders[csiIdx] || `العمود رقم ${csiIdx + 1}`}"\n` +
          `• مؤشر التوصية NPS: "${combinedHeaders[npsIdx] || `العمود رقم ${npsIdx + 1}`}"\n` +
          `• حل المشكلة FCR: "${combinedHeaders[fcrIdx] || `العمود رقم ${fcrIdx + 1}`}"\n` +
          `• التقييم النهائي: "${combinedHeaders[scoreIdx] || `العمود رقم ${scoreIdx + 1}`}"`;
      }

      await onUpdateEmployees(updatedEmployees);
      setPasteSuccess(`بنجاح! تم تحديث مؤشرات الأداء لـ ${matchedCount} موظفاً لشهر ${pasteKpiMonth}. (تم إنشاء ${draftedCount} ملفات كادر مؤقتة للأكواد غير المسجلة مسبقاً) ${mappingReport}`);
      setPasteKpiText("");
      setPasteError("");
      setTimeout(() => setPasteSuccess(""), 15000); // More time to read the mapping feedback
    } catch (e: any) {
      if (e.name === 'FirebaseError' || e.message?.includes('Quota')) {
        setPasteError("تم حفظ البيانات محلياً. الحد الأقصى للاستخدام السحابي نفد.");
      } else {
        setPasteError("حدث خطأ أثناء معالجة شيت الـ KPI. يرجى التحقق من النسخ الصحيح للأعمدة.");
      }
    }
  };



  // Submit Manual Single entry
  const handleManualKpiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kpiEmployeeId) {
      setDialogAlert({
        isOpen: true,
        title: "خطأ في الإدخال",
        message: "الرجاء اختيار موظف أولاً من قائمة الكوادر قبل المتابعة وحفظ مؤشرات تقييم الأداء!",
        type: "error"
      });
      return;
    }

    const updatedEmployees = employees.map((emp) => {
      if (emp.id === kpiEmployeeId) {
        const perfIndex = emp.performance.findIndex(p => p.month === manualKpi.month);
        const updatedPerformance = [...emp.performance];
        
        if (perfIndex > -1) {
          updatedPerformance[perfIndex] = { ...manualKpi };
        } else {
          updatedPerformance.push({ ...manualKpi });
        }
        
        return {
          ...emp,
          performance: updatedPerformance
        };
      }
      return emp;
    });

    try {
      await onUpdateEmployees(updatedEmployees);
      setManualSuccess(`تم رصد تقييم شهر ${manualKpi.month} بنجاح!`);
      setTimeout(() => setManualSuccess(""), 4000);
    } catch (err) {
      setDialogAlert({
        isOpen: true,
        title: "تنبيه الحد الأقصى",
        message: "تم حفظ التعديلات محلياً فقط. تجاوزت حصة الاستخدام المجانية للسحابة، ستعمل التعديلات لديك فقط.",
        type: "error"
      });
    }
  };

  // If NOT logged in, show elegant custom Login screen
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12" id="admin-login-wrapper">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-lg p-8 text-right"
          dir="rtl"
        >
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-md">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-display font-black text-slate-800 text-center mb-1">
            تسجيل دخول الإدارة
          </h2>
          <p className="text-slate-400 text-xs text-center mb-6">
            لوحة إدخال وتعديل البيانات - خاصة بالمسؤولين فقط
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-slate-500 text-xs font-semibold block mb-1.5 mr-1">
                اسم المستخدم (Username)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Hesham.M148011"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-sans text-sm text-right"
                  dir="ltr"
                />
                <KeyRound className="absolute left-3 top-3.5 w-4.5 h-4.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-slate-500 text-xs font-semibold block mb-1.5 mr-1">
                كلمة المرور (Password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-sm text-right"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4.5 h-4.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
            >
              <Lock className="w-4 h-4" />
              <span>دخول آمن للوحة التجكم</span>
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-4 text-center">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              الدخول لغير المصرح لهم يخضع لشروط الاستخدام وسياسات جودة الاتصال وتأمين البيانات.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Admin Dashboard Content if Authenticated
  return (
    <div className="space-y-6" id="admin-workspace">
      {/* Admin Meta Card */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-right" dir="rtl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-xs text-slate-500 font-semibold">بوابة الإدارة النشطة</span>
          </div>
          <h2 className="text-xl font-display font-black text-slate-800 mt-1">
            مرحباً، Hesham Mohamed
          </h2>
          <p className="text-slate-400 text-xs">
            يمكنك من هنا رفع شيتات التقييم الشهرية وتحديث نسب الأهداف أو إدارة الموظفين.
          </p>
        </div>

        <div className="flex gap-2">
          {/* Reset to factory defaults */}
          <button
            onClick={handleResetToDefault}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-rose-100/30"
          >
            <RefreshCw className="w-4 h-4" />
            <span>استعادة تهيئة المصنع</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex bg-slate-250 p-1.5 rounded-2xl w-full max-w-2xl mx-auto bg-slate-100 overflow-x-auto" id="admin-inner-tabs">
        <button
          onClick={() => setAdminTab("data")}
          className={`flex-1 min-w-max px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            adminTab === "data" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          البيانات والنظام
        </button>
        <button
          onClick={() => setAdminTab("targets")}
          className={`flex-1 min-w-max px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            adminTab === "targets" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          تحديث نسب الأهداف
        </button>
        <button
          onClick={() => setAdminTab("employees")}
          className={`flex-1 min-w-max px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            adminTab === "employees" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          إدارة الموظفين
        </button>
        <button
          onClick={() => setAdminTab("upload")}
          className={`flex-1 min-w-max px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            adminTab === "upload" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          رفع شيت التقييم (KPI)
        </button>
      </div>

      {/* Subtab Contents */}
      <div id="admin-subtab-view">
        {/* TAB A: UPLOAD SHEET OR PASTING */}
        {adminTab === "upload" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 3-way intel excel upload section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-right space-y-4" dir="rtl">
              <h3 className="text-md font-display font-semibold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                لوحة الرفع الذكي والدمج المباشر من Excel
              </h3>
              
              <p className="text-slate-500 text-xs leading-relaxed">
                حدد نوع الشيت المراد رفعه من الخيارات أدناه، ثم الصق الخلايا المنسوخة (Ctrl + V). سيتولى النظام مطابقة الأكواد تلقائياً وتحديث البيانات بدقة 100%!
              </p>

              {/* Sub-toggle buttons */}
              <div className="flex gap-2 p-1 bg-slate-100/80 border border-slate-100/60 rounded-xl" id="upload-mode-selector">
                <button
                  type="button"
                  onClick={() => { setUploadMode("nps"); setPasteError(""); setPasteSuccess(""); }}
                  className={`flex-1 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                    uploadMode === "nps" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  🌟 شيت الـ NPS الشهري
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadMode("kpi"); setPasteError(""); setPasteSuccess(""); }}
                  className={`flex-1 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                    uploadMode === "kpi" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  📈 شيت الـ KPI الشهري
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadMode("employees"); setPasteError(""); setPasteSuccess(""); }}
                  className={`flex-1 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                    uploadMode === "employees" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  👥 شيت الموظفين
                </button>
              </div>

              {/* Conditional settings for each mode */}
              {uploadMode === "employees" && (
                <div className="space-y-4 text-right">
                  {pendingEmpRows ? (
                    <div className="space-y-4 text-right bg-slate-50 p-5 rounded-2xl border border-indigo-100 shadow-sm animate-fade-in" dir="rtl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
                          تعديل مطابقة أعمدة Excel لشيت الموظفين
                        </h4>
                        <button 
                          onClick={() => setPendingEmpRows(null)}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-all"
                        >
                          إلغاء واستيراد آخر ✗
                        </button>
                      </div>
                      
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        لقد قمنا بقراءة الهيكل الأساسي لملف الموظفين تلقائياً. يرجى مراجعة توجيه خلايا Excel للاستيراد السليم:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto p-3 border border-slate-100 bg-white rounded-xl text-xs">
                        {/* ID */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">كود الموظف (ID) *</span>
                          <select
                            value={empMapping.idIdx}
                            onChange={(e) => setEmpMapping({ ...empMapping, idIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            {detectedEmpHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Name */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">الاسم بالكامل *</span>
                          <select
                            value={empMapping.nameIdx}
                            onChange={(e) => setEmpMapping({ ...empMapping, nameIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            {detectedEmpHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* TL */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-indigo-700 block">قائد الفريق (TL) *</span>
                          <select
                            value={empMapping.tlIdx}
                            onChange={(e) => setEmpMapping({ ...empMapping, tlIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-indigo-200 text-xs font-medium"
                          >
                            {detectedEmpHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* SV */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-indigo-700 block">المشرف (Supervisor)</span>
                          <select
                            value={empMapping.svIdx}
                            onChange={(e) => setEmpMapping({ ...empMapping, svIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-indigo-200 text-xs font-medium"
                          >
                            <option value={-1}>اسم افتراضي (Ehab Heness)</option>
                            {detectedEmpHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Mobile */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">رقم الموبايل</span>
                          <select
                            value={empMapping.mobIdx}
                            onChange={(e) => setEmpMapping({ ...empMapping, mobIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedEmpHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* National ID */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">الرقم القومي</span>
                          <select
                            value={empMapping.natIdx}
                            onChange={(e) => setEmpMapping({ ...empMapping, natIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedEmpHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Location */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">مقر التعيين (WFH/Premise)</span>
                          <select
                            value={empMapping.locIdx}
                            onChange={(e) => setEmpMapping({ ...empMapping, locIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>الافتراضي (WFH)</option>
                            {detectedEmpHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* LOB */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">خط العمل (LOB)</span>
                          <select
                            value={empMapping.lobIdx}
                            onChange={(e) => setEmpMapping({ ...empMapping, lobIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>الافتراضي (Chat / ADSL)</option>
                            {detectedEmpHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Live Preview Sample */}
                      <div className="space-y-1 border border-slate-200 bg-white p-3 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 block mb-1">🔍 عينة المحاكاة الفورية لاستيراد الموظفين (أول أسطر مقروءة):</span>
                        <div className="overflow-x-auto text-[10px]">
                          <table className="w-full border-collapse text-right select-none">
                            <thead>
                              <tr className="border-b border-slate-100 font-bold text-slate-700 bg-slate-50/50">
                                <th className="p-1">كود الموظف</th>
                                <th className="p-1">الاسم بالكامل</th>
                                <th className="p-1">قائد الفريق TL</th>
                                <th className="p-1">المشرف Supervisor</th>
                                <th className="p-1">موبايل</th>
                                <th className="p-1">LOB</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingEmpRows.slice(empHeaderRowsCount, empHeaderRowsCount + 2).map((r, rowIdx) => {
                                let idVal = r[empMapping.idIdx] || "-";
                                if (idVal.endsWith(".0")) idVal = idVal.substring(0, idVal.length - 2);
                                return (
                                  <tr key={rowIdx} className="border-b border-slate-50 text-slate-600 font-mono">
                                    <td className="p-1 whitespace-nowrap text-indigo-600 font-bold">{idVal}</td>
                                    <td className="p-1 whitespace-nowrap text-slate-800 font-medium">{empMapping.nameIdx !== -1 ? (r[empMapping.nameIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap text-indigo-600">{empMapping.tlIdx !== -1 ? (r[empMapping.tlIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap text-indigo-600">{empMapping.svIdx !== -1 ? (r[empMapping.svIdx] || "Ehab Heness") : "Ehab Heness"}</td>
                                    <td className="p-1 whitespace-nowrap text-slate-500">{empMapping.mobIdx !== -1 ? (r[empMapping.mobIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap text-emerald-600">{empMapping.lobIdx !== -1 ? (r[empMapping.lobIdx] || "Chat / ADSL") : "Chat / ADSL"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <button
                        onClick={confirmPendingEmployees}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد استيراد وحفظ الموظفين بموجب التوجيه الجديد</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-amber-50/70 border border-amber-100/50 p-3 rounded-2xl mb-2">
                        <span className="text-xs text-amber-800 font-bold block mb-1">💡 طريقة مطابقة شيت الموظفين:</span>
                        <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                          يمكنك اختيار رفع ملف Excel مباشرة أو نسخ خلايا الجدول ولصقها. يتعرف الذكاء المدمج على الأعمدة: <strong className="text-amber-900">الكود، الاسم، قائد الفريق (TL)، المشرف (SV)، الموبايل، الرقم القومي، الموقع، وخط العمل (LOB)</strong>. سيتم دمج الكوادر وتعديل بيانات الموظفين بشكل آمن لمطابقة تقييماتهم!
                        </p>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="border border-slate-100 p-4 rounded-2xl bg-white/50 space-y-3">
                          <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block mb-1">الخيار الأول: رفع ملف شيت جاهز (Excel / CSV)</span>
                          <div className="border-2 border-dashed border-indigo-100 hover:border-indigo-300 bg-indigo-50/10 hover:bg-indigo-50/30 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all relative group">
                            <input 
                              type="file" 
                              onChange={handleFileUpload} 
                              accept=".xlsx,.xls,.csv,.tsv,.txt" 
                              className="absolute inset-0 opacity-0 cursor-pointer" 
                              id="emp-file-upload-input"
                            />
                            <div className="w-10 h-10 rounded-full bg-indigo-50/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                            </div>
                            <p className="text-xs font-bold text-slate-700">اسحب وأفلت ملف الموظفين هنا، أو اضغط للاختيار</p>
                            <p className="text-[10px] text-slate-400 font-mono">يدعم صيغ Excel (.xlsx, .xls) والمستندات النصية المجدولة (.csv, .tsv, .txt)</p>
                          </div>
                        </div>

                        <div className="relative flex py-1 items-center">
                          <div className="flex-grow border-t border-slate-100"></div>
                          <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">أو</span>
                          <div className="flex-grow border-t border-slate-100"></div>
                        </div>

                        <div className="border border-slate-100 p-4 rounded-2xl bg-white/50 space-y-3">
                          <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block mb-1">الخيار الثاني: نسخ ولصق الخلايا من الشيت مباشرة</span>
                          <div>
                            <textarea
                              value={pasteEmpText}
                              onChange={(e) => setPasteEmpText(e.target.value)}
                              placeholder="ألصق جدول بيانات الموظفين الأساسية هنا (ID, الاسم, TL, SV ...) (Ctrl + V)..."
                              rows={4}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              dir="ltr"
                            />
                          </div>

                          {pasteError && (
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs flex items-center gap-1.5 font-semibold">
                              <AlertCircle className="w-4.5 h-4.5" />
                              <span>{pasteError}</span>
                            </div>
                          )}

                          {pasteSuccess && (
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs flex items-center gap-1.5 font-semibold">
                              <CheckCircle2 className="w-4.5 h-4.5" />
                              <span>{pasteSuccess}</span>
                            </div>
                          )}

                          <button
                            onClick={handleUploadEmployees}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-4 h-4" />
                            <span>تأكيد ومعالجة شيت الموظفين المنسوخ</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {uploadMode === "kpi" && (
                <div className="space-y-4 text-right">
                  {pendingKpiRows ? (
                    <div className="space-y-4 text-right bg-slate-50 p-5 rounded-2xl border border-indigo-105 shadow-sm animate-fade-in" dir="rtl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
                          تعديل مطابقة أعمدة Excel لشهر {pendingKpiMonth}
                        </h4>
                        <button 
                          onClick={() => setPendingKpiRows(null)}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-all"
                        >
                          إلغاء واستيراد آخر ✗
                        </button>
                      </div>
                      
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        لقد قمنا بقراءة الهيكل الأساسي لملفك تلقائياً. يرجى التحقق من توجيه التقييمات للأعمدة الصحيحة بناءً على ملفك لتفادي حدوث أي أخطاء في الـ KPI:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto p-3 border border-slate-100 bg-white rounded-xl text-xs">
                        {/* ID */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">كود الموظف (ID) *</span>
                          <select
                            value={kpiMapping.idIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, idIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Name */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">اسم الموظف</span>
                          <select
                            value={kpiMapping.nameIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, nameIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>استبعاد (الاسم يتم جلبه من شيت الموظفين)</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* AHT */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-indigo-700 block">متوسط زمن المكالمة AHT (AB)</span>
                          <select
                            value={kpiMapping.ahtIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, ahtIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-indigo-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* CSI */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-indigo-700 block">مؤشر رضا العملاء CSI (BW)</span>
                          <select
                            value={kpiMapping.csiIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, csiIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-indigo-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* CTC */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">نسبة التذمر CTC (CD)</span>
                          <select
                            value={kpiMapping.ctcIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, ctcIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* CTB */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">نسبة السلوكيات CTB (CE)</span>
                          <select
                            value={kpiMapping.ctbIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, ctbIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* NPS */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">مؤشر NPS</span>
                          <select
                            value={kpiMapping.npsIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, npsIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* FCR */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">حل المشكلة FCR</span>
                          <select
                            value={kpiMapping.fcrIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, fcrIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* TTB */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">أعلى صندوق TTB</span>
                          <select
                            value={kpiMapping.ttbIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, ttbIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Absent */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-700 block">الغيابات Absent (CJ)</span>
                          <select
                            value={kpiMapping.absIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, absIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-amber-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Sick */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-700 block">المرضي Sick (CH)</span>
                          <select
                            value={kpiMapping.sckIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, sckIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-amber-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Emergency */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-700 block">العارضة Emergency (CI)</span>
                          <select
                            value={kpiMapping.emgIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, emgIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-amber-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Unplanned */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-700 block">فجائي Unplanned (CK)</span>
                          <select
                            value={kpiMapping.unpIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, unpIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-amber-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Final Score */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-emerald-700 block">التقييم وسكور النهائي (DA)</span>
                          <select
                            value={kpiMapping.scoreIdx}
                            onChange={(e) => setKpiMapping({ ...kpiMapping, scoreIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-emerald-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Live Preview Sample */}
                      <div className="space-y-1 border border-slate-200 bg-white p-3 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-550 block mb-1">🔍 عينة المحاكاة الفورية لتوجيه الخلايا (أول أسطر مقروءة):</span>
                        <div className="overflow-x-auto text-[10px]">
                          <table className="w-full border-collapse text-right select-none">
                            <thead>
                              <tr className="border-b border-slate-100 font-bold text-slate-700 bg-slate-50/50">
                                <th className="p-1">كود الموظف</th>
                                <th className="p-1">AHT</th>
                                <th className="p-1">CSI</th>
                                <th className="p-1">غياب</th>
                                <th className="p-1">مرضي</th>
                                <th className="p-1">عارضة</th>
                                <th className="p-1">فجائي</th>
                                <th className="p-1">النهائي</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingKpiRows.slice(headerRowsCount, headerRowsCount + 2).map((r, rowIdx) => {
                                let idVal = r[kpiMapping.idIdx] || "-";
                                if (idVal.endsWith(".0")) idVal = idVal.substring(0, idVal.length - 2);
                                return (
                                  <tr key={rowIdx} className="border-b border-slate-50 text-slate-600 font-mono">
                                    <td className="p-1 whitespace-nowrap text-indigo-600 font-bold">{idVal}</td>
                                    <td className="p-1 whitespace-nowrap">{kpiMapping.ahtIdx !== -1 ? (r[kpiMapping.ahtIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap">{kpiMapping.csiIdx !== -1 ? (r[kpiMapping.csiIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap text-amber-600">{kpiMapping.absIdx !== -1 ? (r[kpiMapping.absIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap text-amber-600">{kpiMapping.sckIdx !== -1 ? (r[kpiMapping.sckIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap text-amber-600">{kpiMapping.emgIdx !== -1 ? (r[kpiMapping.emgIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap text-amber-600">{kpiMapping.unpIdx !== -1 ? (r[kpiMapping.unpIdx] || "-") : "-"}</td>
                                    <td className="p-1 whitespace-nowrap text-emerald-600 font-bold">{kpiMapping.scoreIdx !== -1 ? (r[kpiMapping.scoreIdx] || "-") : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <button
                        onClick={confirmPendingKpi}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>تأكيد استيراد وحفظ البيانات بموجب التوجيه الجديد</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-indigo-50/70 border border-indigo-100/50 p-3 rounded-2xl flex flex-col gap-2">
                        <div>
                          <label className="text-indigo-950 text-xs font-bold block mb-1">حدد الشهر الذي ينتمي إليه شيت الـ KPI:</label>
                          <select
                            value={pasteKpiMonth}
                            onChange={(e) => setPasteKpiMonth(e.target.value)}
                            className="w-full bg-white border border-indigo-100 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-700"
                          >
                            <option value="Jan-25">Jan-25</option>
                            <option value="Feb-25">Feb-25</option>
                            <option value="Mar-25">Mar-25</option>
                            <option value="Apr-25">Apr-25</option>
                            <option value="May-25">May-25</option>
                            <option value="Jun-25">Jun-25</option>
                            <option value="Jul-25">Jul-25</option>
                            <option value="Aug-25">Aug-25</option>
                            <option value="Sep-25">Sep-25</option>
                            <option value="Oct-25">Oct-25</option>
                            <option value="Nov-25">Nov-25</option>
                            <option value="Dec-25">Dec-25</option>
                            <option value="Jan-26">Jan-26</option>
                            <option value="Feb-26">Feb-26</option>
                            <option value="Mar-26">Mar-26</option>
                            <option value="Apr-26">Apr-26</option>
                            <option value="May-26">May-26</option>
                          </select>
                        </div>

                        <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                          يتعرف النظام على الأعمدة المنسوخة تلقائياً: <strong className="text-indigo-900">ID, الاسم, AHT, CSI, NPS, FCR, TTB, CTC, CTB, Absent, Sick, Emergency, Unplanned, Final Score</strong>.
                        </p>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="border border-slate-100 p-4 rounded-2xl bg-white/50 space-y-3">
                          <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block mb-1">الخيار الأول: رفع ملف شيت جاهز (Excel / CSV)</span>
                          <div className="border-2 border-dashed border-indigo-100 hover:border-indigo-300 bg-indigo-50/10 hover:bg-indigo-50/30 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all relative group">
                            <input 
                              type="file" 
                              onChange={handleFileUpload} 
                              accept=".xlsx,.xls,.csv,.tsv,.txt" 
                              className="absolute inset-0 opacity-0 cursor-pointer" 
                              id="kpi-file-upload-input"
                            />
                            <div className="w-10 h-10 rounded-full bg-indigo-50/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                            </div>
                            <p className="text-xs font-bold text-slate-700">اسحب وأفلت ملف الـ KPI هنا، أو اضغط للاختيار</p>
                            <p className="text-[10px] text-slate-400 font-mono">يدعم صيغ Excel (.xlsx, .xls) والمستندات النصية المجدولة (.csv, .tsv, .txt)</p>
                          </div>
                        </div>

                        <div className="relative flex py-1 items-center">
                          <div className="flex-grow border-t border-slate-100"></div>
                          <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">أو</span>
                          <div className="flex-grow border-t border-slate-150"></div>
                        </div>

                        <div className="border border-slate-100 p-4 rounded-2xl bg-white/50 space-y-3">
                          <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block mb-1">الخيار الثاني: نسخ ولصق الخلايا من الشيت مباشرة</span>
                          <div>
                            <textarea
                              value={pasteKpiText}
                              onChange={(e) => setPasteKpiText(e.target.value)}
                              placeholder="ألصق جدول مؤشارات التقييم الشهري KPI هنا (Ctrl + V)..."
                              rows={4}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              dir="ltr"
                            />
                          </div>
                          <button
                            onClick={handleUploadKPI}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-4 h-4" />
                            <span>تأكيد والرفع لشهر {pasteKpiMonth}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {pasteError && (
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs flex items-center gap-1.5 font-semibold">
                      <AlertCircle className="w-4.5 h-4.5" />
                      <span>{pasteError}</span>
                    </div>
                  )}

                  {pasteSuccess && (
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                      <span>{pasteSuccess}</span>
                    </div>
                  )}
                </div>
              )}

              {uploadMode === "nps" && (
                <div className="space-y-4 text-right">
                  {pendingNpsRows ? (
                    <div className="space-y-4 text-right bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 shadow-sm animate-fade-in" dir="rtl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-emerald-500 animate-spin" style={{ animationDuration: '6s' }} />
                          تعديل مطابقة أعمدة Excel لشهر {pendingNpsMonth}
                        </h4>
                        <button 
                          onClick={() => setPendingNpsRows(null)}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-all"
                        >
                          إلغاء واستيراد آخر ✗
                        </button>
                      </div>
                      
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        قمنا بقراءة الشيت. يرجى مطابقة أعمدة الاستطلاعات لضمان إدخال التقييمات الصحيحة (NPS, FCR, TTB):
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto p-3 border border-slate-100 bg-white rounded-xl text-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 block">كود الموظف (ID) *</span>
                          <select
                            value={npsMapping.idIdx}
                            onChange={(e) => setNpsMapping({ ...npsMapping, idIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                          >
                            {detectedNpsHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-emerald-700 block">NPS</span>
                          <select
                            value={npsMapping.npsIdx}
                            onChange={(e) => setNpsMapping({ ...npsMapping, npsIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-emerald-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedNpsHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-emerald-700 block">FCR</span>
                          <select
                            value={npsMapping.fcrIdx}
                            onChange={(e) => setNpsMapping({ ...npsMapping, fcrIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-emerald-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedNpsHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-emerald-700 block">TTB</span>
                          <select
                            value={npsMapping.ttbIdx}
                            onChange={(e) => setNpsMapping({ ...npsMapping, ttbIdx: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 px-2 py-1.5 rounded-lg border border-emerald-200 text-xs font-medium"
                          >
                            <option value={-1}>تجاهل / غير موجود</option>
                            {detectedNpsHeaders.map((hdr, idx) => (
                              <option key={idx} value={idx}>{hdr}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={confirmPendingNps}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تأكيد اعتماد بيانات NPS لشهر {pendingNpsMonth}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-emerald-50/70 border border-emerald-100/50 p-3 rounded-2xl flex flex-col gap-2">
                        <div>
                          <label className="text-emerald-950 text-xs font-bold block mb-1">حدد الشهر الذي ينتمي إليه شيت الـ NPS:</label>
                          <select
                            value={pasteNpsMonth}
                            onChange={(e) => setPasteNpsMonth(e.target.value)}
                            className="w-full bg-white border border-emerald-100 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-700"
                          >
                            <option value="Jan-25">Jan-25</option>
                            <option value="Feb-25">Feb-25</option>
                            <option value="Mar-25">Mar-25</option>
                            <option value="Apr-25">Apr-25</option>
                            <option value="May-25">May-25</option>
                            <option value="Jun-25">Jun-25</option>
                            <option value="Jul-25">Jul-25</option>
                            <option value="Aug-25">Aug-25</option>
                            <option value="Sep-25">Sep-25</option>
                            <option value="Oct-25">Oct-25</option>
                            <option value="Nov-25">Nov-25</option>
                            <option value="Dec-25">Dec-25</option>
                            <option value="Jan-26">Jan-26</option>
                            <option value="Feb-26">Feb-26</option>
                            <option value="Mar-26">Mar-26</option>
                            <option value="Apr-26">Apr-26</option>
                            <option value="May-26">May-26</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-bold text-slate-700 text-xs flex items-center gap-1">
                            <Upload className="w-4 h-4 text-emerald-500" />
                            الخيار الأول: رفع شيت إكسيل (Excel)
                          </label>
                        </div>
                        <div className="border border-dashed border-emerald-300 hover:border-emerald-500 bg-white hover:bg-emerald-50 transition-colors p-4 rounded-xl flex items-center justify-center cursor-pointer relative overflow-hidden group">
                          <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv, .txt, .tsv" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                          />
                          <div className="text-center">
                            <Database className="w-6 h-6 text-emerald-400 group-hover:text-emerald-500 mx-auto mb-2" />
                            <span className="text-xs font-bold text-emerald-700 block">انقر هنا لرفع ملف (.xlsx, .csv)</span>
                          </div>
                        </div>

                        <div className="relative flex py-1 items-center">
                          <div className="flex-grow border-t border-slate-100"></div>
                          <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">أو</span>
                          <div className="flex-grow border-t border-slate-100"></div>
                        </div>

                        <div className="border border-slate-100 p-4 rounded-2xl bg-white/50 space-y-3">
                          <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block mb-1">الخيار الثاني: نسخ ولصق الخلايا من الشيت مباشرة</span>
                          <div>
                            <textarea
                              value={pasteNpsText}
                              onChange={(e) => setPasteNpsText(e.target.value)}
                              placeholder="ألصق الأعمدة (الكود ودرجة NPS و FCR و TTB) هنا (Ctrl + V)..."
                              rows={4}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              dir="ltr"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const lines = pasteNpsText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                              if (lines.length === 0) {
                                setPasteError("لا توجد بيانات صالحة لمعالجتها.");
                                return;
                              }
                              const detectSeparator = (sampleLine: string) => sampleLine.includes("\t") ? "\t" : sampleLine.includes(",") ? "," : "\t";
                              const sep = detectSeparator(lines[0] || "");
                              const rawRows = lines.map(line => line.split(sep).map(cell => cell.trim().replace(/^["']|["']$/g, "").trim()));
                              processRawNpsMatrix(rawRows, pasteNpsMonth);
                            }}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-4 h-4" />
                            <span>تأكيد ومعالجة الرفع لشهر {pasteNpsMonth}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {pasteError && (
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs flex items-center gap-1.5 font-semibold">
                      <AlertCircle className="w-4.5 h-4.5" />
                      <span>{pasteError}</span>
                    </div>
                  )}

                  {pasteSuccess && (
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                      <span>{pasteSuccess}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual Single KPI Entry form */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-right space-y-4" dir="rtl">
              <h3 className="text-md font-display font-semibold text-slate-800 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                رصد تقييم فردي يدوي
              </h3>
              
              <form onSubmit={handleManualKpiSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-1">اختر الموظف:</label>
                    <select
                      value={kpiEmployeeId}
                      onChange={(e) => setKpiEmployeeId(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs font-sans font-semibold text-slate-700"
                    >
                      <option value="">-- حدد موظف --</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.fullName} ({e.id})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[10px] block mb-1">الشهر المراد رصده:</label>
                    <select
                      value={manualKpi.month}
                      onChange={(e) => setManualKpi({ ...manualKpi, month: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs font-mono"
                    >
                      <option value="Jan-25">Jan-25</option>
                      <option value="Feb-25">Feb-25</option>
                      <option value="Mar-25">Mar-25</option>
                      <option value="Apr-25">Apr-25</option>
                      <option value="May-25">May-25</option>
                      <option value="Jun-25">Jun-25</option>
                      <option value="Jul-25">Jul-25</option>
                      <option value="Aug-25">Aug-25</option>
                      <option value="Sep-25">Sep-25</option>
                      <option value="Oct-25">Oct-25</option>
                      <option value="Nov-25">Nov-25</option>
                      <option value="Dec-25">Dec-25</option>
                      <option value="Jan-26">Jan-26</option>
                      <option value="Feb-26">Feb-26</option>
                      <option value="Mar-26">Mar-26</option>
                      <option value="Apr-26">Apr-26</option>
                      <option value="May-26">May-26</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-0.5">AHT (سرعة رد):</label>
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.aht}
                      onChange={(e) => setManualKpi({ ...manualKpi, aht: e.target.value })}
                      required
                      placeholder="07:20"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-0.5">CSI (رضا العملاء %):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.csi}
                      onChange={(e) => setManualKpi({ ...manualKpi, csi: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-0.5">NPS (مؤشر التوصية %):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.nps}
                      onChange={(e) => setManualKpi({ ...manualKpi, nps: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-0.5">FCR (حل أول %):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.fcr}
                      onChange={(e) => setManualKpi({ ...manualKpi, fcr: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-0.5">TTB (أعلى 2 صندوق %):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.ttb}
                      onChange={(e) => setManualKpi({ ...manualKpi, ttb: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-0.5">Final Score (النهائي %):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.finalScore}
                      onChange={(e) => setManualKpi({ ...manualKpi, finalScore: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-slate-400 text-[9px] block mb-0.5">Absent (غياب):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.absent}
                      onChange={(e) => setManualKpi({ ...manualKpi, absent: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[9px] block mb-0.5">Sick (مرضي):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.sick}
                      onChange={(e) => setManualKpi({ ...manualKpi, sick: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[9px] block mb-0.5">Emergency (طارئ):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.emergency}
                      onChange={(e) => setManualKpi({ ...manualKpi, emergency: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[9px] block mb-0.5">Unplanned (فجائي):</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg font-mono text-xs text-center"
                      value={manualKpi.unplanned}
                      onChange={(e) => setManualKpi({ ...manualKpi, unplanned: parseInt(e.target.value, 10) })}
                      required
                    />
                  </div>
                </div>

                {manualSuccess && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs flex items-center justify-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4" />
                    <span>{manualSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1"
                >
                  <Upload className="w-4 h-4" />
                  <span>تأكيد وحفظ السجل المكتوب</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB B: EMPLOYEE LIST MANAGEMENT */}
        {adminTab === "employees" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8" dir="rtl">
            {/* Create form */}
            <div className="md:col-span-5 bg-white rounded-3xl border border-slate-100 p-6 space-y-4 text-right">
              {(() => {
                const activeExistingEmp = newEmp.id.trim() ? employees.find(emp => emp.id === newEmp.id.trim()) : undefined;
                return (
                  <>
                    <h3 className="text-md font-display font-semibold text-slate-800 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-indigo-505" />
                      {activeExistingEmp ? "تحديث ملف موظف نشط" : "ملأ تذكرة تعيين موظف جديد"}
                    </h3>

                    <form onSubmit={handleAddEmployee} className="space-y-3">
                      <div>
                        <label className="text-slate-400 text-[10px] block mb-1">كود الموظف (ID) (مطلوب):</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: 44672"
                          value={newEmp.id}
                          onChange={(e) => setNewEmp({ ...newEmp, id: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 text-[10px] block mb-1 font-sans">الاسم الكامل بالعربية (مطلوب):</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: آية ماهر عبدة الله"
                          value={newEmp.fullName}
                          onChange={(e) => setNewEmp({ ...newEmp, fullName: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 text-[10px] block mb-1">قائد الفريق (TL) (مطلوب):</label>
                          <input
                            type="text"
                            required
                            placeholder="هالة سامي"
                            value={newEmp.newTL}
                            onChange={(e) => setNewEmp({ ...newEmp, newTL: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-[10px] block mb-1">المشرف المسؤول (Supervisor):</label>
                          <input
                            type="text"
                            placeholder="إيهاب هنيس"
                            value={newEmp.newSV}
                            onChange={(e) => setNewEmp({ ...newEmp, newSV: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 text-[10px] block mb-1">رقم الموبايل:</label>
                          <input
                            type="text"
                            placeholder="e.g. 1006144841"
                            value={newEmp.mobileNumber}
                            onChange={(e) => setNewEmp({ ...newEmp, mobileNumber: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-[10px] block mb-1">الرقم القومي:</label>
                          <input
                            type="text"
                            placeholder="e.g. 291061..."
                            value={newEmp.nationalId}
                            onChange={(e) => setNewEmp({ ...newEmp, nationalId: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 text-[10px] block mb-1">تفاصيل العمل LOB:</label>
                          <select
                            value={newEmp.lob}
                            onChange={(e) => setNewEmp({ ...newEmp, lob: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs"
                          >
                            <option value="Chat / ADSL">Chat / ADSL</option>
                            <option value="Chat / Mobile">Chat / Mobile</option>
                            <option value="VOICE / FTTH">VOICE / FTTH</option>
                            <option value="Universal">Universal</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-400 text-[10px] block mb-1">مقر التعيين:</label>
                          <select
                            value={newEmp.location}
                            onChange={(e) => setNewEmp({ ...newEmp, location: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs"
                          >
                            <option value="WFH">WFH (المنزل)</option>
                            <option value="Premise">Premise (المقر)</option>
                          </select>
                        </div>
                      </div>

                      {activeExistingEmp && (
                        <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-950 space-y-1 text-right leading-relaxed select-none animate-fade-in">
                          <p className="font-bold flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                            كود الموظف ({activeExistingEmp.id}) مسجل مسبقاً!
                          </p>
                          <p className="text-[10px] text-indigo-700">
                            هذا الموظف مسجل باسم: <strong className="text-indigo-900">{activeExistingEmp.fullName}</strong>.
                            حفظ الملف الآن سيقوم بـ <strong>تحديث</strong> بياناته بدقة مع الحفاظ الكامل على كافة تقييمات الأداء التاريخية له.
                          </p>
                          <button
                            type="button"
                            onClick={() => setNewEmp({
                              id: activeExistingEmp.id,
                              fullName: activeExistingEmp.fullName,
                              newTL: activeExistingEmp.newTL,
                              newSV: activeExistingEmp.newSV || "",
                              mobileNumber: activeExistingEmp.mobileNumber || "",
                              nationalId: activeExistingEmp.nationalId || "",
                              location: activeExistingEmp.location,
                              lob: activeExistingEmp.lob,
                            })}
                            className="text-[10px] font-bold text-indigo-600 underline hover:text-indigo-800 block mt-1 transition-colors"
                          >
                            🔄 اضغط لاسترجاع بقية تفاصيله المسجلة لتعديلها
                          </button>
                        </div>
                      )}

                      {empError && (
                        <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold">
                          {empError}
                        </div>
                      )}

                      {empSuccess && (
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-semibold">
                          {empSuccess}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {newEmp.id || newEmp.fullName ? (
                          <button
                            type="button"
                            onClick={() => setNewEmp({
                              id: "",
                              fullName: "",
                              newTL: "",
                              newSV: "",
                              mobileNumber: "",
                              nationalId: "",
                              location: "WFH",
                              lob: "Chat / ADSL",
                            })}
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                            title="تفريغ الحقول"
                          >
                            مسح
                          </button>
                        ) : null}
                        <button
                          type="submit"
                          className={`flex-1 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 ${
                            activeExistingEmp ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-900 hover:bg-slate-800"
                          }`}
                        >
                          {activeExistingEmp ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          <span>{activeExistingEmp ? "حفظ وتعديل بيانات الملف" : "تأكيد وإدراج الموظف"}</span>
                        </button>
                      </div>
                    </form>
                  </>
                );
              })()}
            </div>

            {/* List & Search on the right */}
            <div className="md:col-span-7 space-y-4">
              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm text-right flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-md font-display font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" />
                      قائمة الكوادر الحالية ({employees.length} موظف)
                    </h3>
                    <p className="text-slate-450 text-[11px] leading-relaxed block">ابحث عن الموظفين أو احذف ملف موظف أو اضغط للتحرير الفوري لبياناته.</p>
                  </div>
                </div>

                {/* Search bar & Archive Toggle */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="ابحث باسم الموظف أو الكود..."
                      value={empSearchQuery}
                      onChange={(e) => setEmpSearchQuery(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-right outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowArchived(!showArchived)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                      showArchived 
                        ? "bg-slate-800 text-white border-slate-800" 
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Archive className="w-4 h-4" />
                    {showArchived ? "إخفاء الموظفين المؤرشفين" : "عرض الموظفين المؤرشفين"}
                  </button>
                </div>

                {/* Vertical list of employees */}
                <div className="max-h-[500px] overflow-y-auto pr-1 space-y-2.5">
                  {filteredEmployees.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl">
                      <p className="text-slate-400 text-xs font-semibold">لم يتم العثور على أي موظف مطابق للبحث!</p>
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <div 
                        key={emp.id} 
                        className={`p-3 border rounded-2xl flex items-center justify-between gap-2 transition-all group ${
                          emp.isArchived ? "bg-slate-100/80 border-slate-200" : "bg-slate-50 border-slate-100 hover:bg-slate-100/50"
                        }`}
                      >
                        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                          <button
                            type="button"
                            onClick={() => setNewEmp({
                              id: emp.id,
                              fullName: emp.fullName,
                              newTL: emp.newTL,
                              newSV: emp.newSV || "",
                              mobileNumber: emp.mobileNumber || "",
                              nationalId: emp.nationalId || "",
                              location: emp.location,
                              lob: emp.lob || "Chat / ADSL",
                            })}
                            className="p-1.5 bg-white border border-slate-200 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all text-[11px] font-bold flex items-center gap-1 shrink-0"
                            title="تعديل بيانات الموظف"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveEmployee(emp.id)}
                            className={`p-1.5 bg-white border border-slate-200 rounded-xl transition-all text-[11px] font-bold flex items-center gap-1 shrink-0 ${
                              emp.isArchived ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-600 hover:bg-amber-50"
                            }`}
                            title={emp.isArchived ? "تنشيط الموظف" : "أرشفة الموظف مؤقتاً"}
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>{emp.isArchived ? "تنشيط" : "أرشفة"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="p-1.5 bg-white border border-slate-200 text-rose-600 rounded-xl hover:bg-rose-50 transition-all text-[11px] font-bold flex items-center gap-1 shrink-0"
                            title="حذف الموظف نهائياً"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-slate-800 font-bold text-xs font-sans">
                            {emp.fullName} <span className="font-mono text-[10px] text-slate-400 font-normal">({emp.id})</span>
                            {emp.isArchived && <span className="ml-2 px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[9px] font-bold">مؤرشف</span>}
                          </p>
                          <div className="flex items-center gap-2 justify-end text-[10px] text-slate-400 font-semibold" dir="rtl">
                            <span>TL: {emp.newTL}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-bold text-[9px]">
                              {emp.lob || "Chat / ADSL"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB C: KPI TARGETS CONFIGURATION */}
        {adminTab === "targets" && (
          <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-right" dir="rtl">
            <h3 className="text-md font-display font-semibold text-slate-800 mb-4 flex items-center gap-2 text-right justify-start">
              <Megaphone className="w-5 h-5 text-we-pink animate-pulse" />
              تعديل أهداف التشغيل وشريط التنبيهات السحابية
            </h3>
            <p className="text-slate-500 text-xs mb-5 leading-relaxed">
              ستنعكس هذه القيم تلقائياً على جداول كروت أداء الموظفين وإشارات النجاح ورصد الألوان، وسيتم بث نص التحديث مباشرة على شاشات جميع المشرفين.
            </p>

            <form onSubmit={handleUpdateTargetsSubmit} className="space-y-4">
              {/* Cloud Announcement configuration text box */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2 mb-4">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5 justify-start">
                  <Megaphone className="w-4 h-4 text-we-pink" />
                  شريط التنبيهات المباشر (مزامنة سحابية فورية)
                </span>
                <p className="text-[10px] text-slate-400">
                  اكتب رسالتك ليتداولها الشريط المتحرك في أعلى كارت الأداء لجميع المشرفين وليدر الفرق على الفور!
                </p>
                <textarea
                  id="notice-textarea"
                  value={localNotice}
                  onChange={(e) => setLocalNotice(e.target.value)}
                  placeholder="أدخل نص التنبيه الإداري العاجل هنا..."
                  className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs leading-relaxed text-right font-semibold resize-none h-20 outline-none focus:ring-1 focus:ring-we-pink focus:border-we-pink transition-all focus:bg-pink-50/30"
                />
              </div>

              {/* Maintenance Mode Selection */}
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex flex-col gap-3 mb-4">
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-xs font-black text-orange-700 flex items-center gap-1.5 justify-start">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    تفعيل وضع الصيانة (تحت التطوير) للصفحات
                  </span>
                  <p className="text-[10px] text-orange-600/80 leading-relaxed font-semibold">
                    اختر الصفحات التي ترغب في إخفائها وعرض صفحة "تحت التطوير" بدلاً منها لقادة الفرق.
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  {[
                    { id: "dashboard", label: "التقييم الفردي" },
                    { id: "analytics", label: "تقارير تشغيل الفرق" },
                    { id: "weekly", label: "الأداء الأسبوعي" }
                  ].map(page => {
                    const isMaintenance = maintenancePages.includes(page.id);
                    return (
                      <div key={page.id} className="flex justify-between items-center bg-white/50 p-2 rounded-xl border border-orange-100/50">
                        <span className="text-xs font-semibold text-orange-900">{page.label}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPages = isMaintenance 
                              ? maintenancePages.filter(p => p !== page.id)
                              : [...maintenancePages, page.id];
                            onUpdateMaintenancePages(newPages);
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${
                            isMaintenance ? 'bg-orange-500' : 'bg-slate-300'
                          }`}
                          dir="ltr"
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              isMaintenance ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Month Selection for Historical Targets */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2 mb-4">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5 justify-start">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  ضبط الأهداف الشهرية (Historical Targets)
                </span>
                <p className="text-[10px] text-slate-400">
                  هل تود تغيير الأهداف لشهر معين فقط؟ اختر الشهر وسوف تقوم بحفظ النسخة السابقة من المستهدفات، إذا اخترت "Current / Default" فهذا سيعدل الإعدادات العامة المعمول بها بشكل افتراضي.
                </p>
                
                <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden mt-1">
                  <div className="px-3 py-2 bg-slate-50 border-l border-slate-200 flex items-center justify-center">
                    <History className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={targetEditingMonth === "default" ? "" : targetEditingMonth}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (!val) handleMonthSelectionChange("default");
                      else handleMonthSelectionChange(val);
                    }}
                    placeholder="افتراضي لكافة الشهور السابقة (أو اكتب اسم الشهر مثال: Jan-25)"
                    className="flex-1 px-3 py-2 text-xs font-semibold outline-none focus:bg-emerald-50/20 transition-all font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* LOB Target Selection Tab Swapper */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5 justify-start">
                  <Settings className="w-4 h-4 text-we-purple" />
                  تحديد القيم المستهدفة لخطوط العمل المختلفة (LOB Targets)
                </span>
                <p className="text-[10px] text-slate-450 leading-relaxed block">
                  اختر المجموعة الإدارية التي ترغب في ضبط أرقامها المستهدفة أولاً ثم قم بحفظ التعديلات:
                </p>
                <div className="flex bg-slate-200/50 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingLOB("chat")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      editingLOB === "chat" 
                        ? "bg-slate-900 text-white shadow" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    أهداف Chat / ADSL
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingLOB("universal")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      editingLOB === "universal" 
                        ? "bg-slate-900 text-white shadow" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    أهداف Universal
                  </button>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-500 text-[10px] block mb-1">التقييم الكلي العام المستهدف (%):</label>
                      <input
                        type="number"
                        value={editingLOB === "chat" ? targetFormChat.finalScore : targetFormUniversal.finalScore}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (editingLOB === "chat") {
                            setTargetFormChat({ ...targetFormChat, finalScore: val });
                          } else {
                            setTargetFormUniversal({ ...targetFormUniversal, finalScore: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center font-bold outline-none focus:ring-1 focus:ring-we-pink"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px] block mb-1">مستهدف الـ CSI (%):</label>
                      <input
                        type="number"
                        value={editingLOB === "chat" ? targetFormChat.csi : targetFormUniversal.csi}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (editingLOB === "chat") {
                            setTargetFormChat({ ...targetFormChat, csi: val });
                          } else {
                            setTargetFormUniversal({ ...targetFormUniversal, csi: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center font-bold outline-none focus:ring-1 focus:ring-we-pink"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-500 text-[10px] block mb-1">مستهدف الـ NPS (%):</label>
                      <input
                        type="number"
                        value={editingLOB === "chat" ? targetFormChat.nps : targetFormUniversal.nps}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (editingLOB === "chat") {
                            setTargetFormChat({ ...targetFormChat, nps: val });
                          } else {
                            setTargetFormUniversal({ ...targetFormUniversal, nps: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center outline-none focus:ring-1 focus:ring-we-pink"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px] block mb-1">مستهدف الـ FCR (%):</label>
                      <input
                        type="number"
                        value={editingLOB === "chat" ? targetFormChat.fcr : targetFormUniversal.fcr}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (editingLOB === "chat") {
                            setTargetFormChat({ ...targetFormChat, fcr: val });
                          } else {
                            setTargetFormUniversal({ ...targetFormUniversal, fcr: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center outline-none focus:ring-1 focus:ring-we-pink"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px] block mb-1">مستهدف الـ TTB (%):</label>
                      <input
                        type="number"
                        value={editingLOB === "chat" ? targetFormChat.ttb : targetFormUniversal.ttb}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (editingLOB === "chat") {
                            setTargetFormChat({ ...targetFormChat, ttb: val });
                          } else {
                            setTargetFormUniversal({ ...targetFormUniversal, ttb: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center outline-none focus:ring-1 focus:ring-we-pink"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-500 text-[10px] block mb-1">مستهدف الـ AHT (بالثواني):</label>
                      <input
                        type="number"
                        value={editingLOB === "chat" ? targetFormChat.ahtSeconds : targetFormUniversal.ahtSeconds}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (editingLOB === "chat") {
                            setTargetFormChat({ ...targetFormChat, ahtSeconds: val });
                          } else {
                            setTargetFormUniversal({ ...targetFormUniversal, ahtSeconds: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center outline-none focus:ring-1 focus:ring-we-pink"
                        placeholder={editingLOB === "chat" ? "440" : "465"}
                      />
                      <span className="text-[9px] text-slate-400 text-center block mt-1">
                        {(() => {
                          const currentSecs = editingLOB === "chat" ? targetFormChat.ahtSeconds : targetFormUniversal.ahtSeconds;
                          const mins = Math.floor(currentSecs / 60);
                          const secs = Math.round(currentSecs % 60);
                          const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                          return `${currentSecs} ثانية تعادل ${formattedTime} دقيقة`;
                        })()}
                      </span>
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px] block mb-1">حد الـ CTC الأقصى (%):</label>
                      <input
                        type="number"
                        value={editingLOB === "chat" ? targetFormChat.ctc : targetFormUniversal.ctc}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (editingLOB === "chat") {
                            setTargetFormChat({ ...targetFormChat, ctc: val });
                          } else {
                            setTargetFormUniversal({ ...targetFormUniversal, ctc: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center outline-none focus:ring-1 focus:ring-we-pink"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px] block mb-1">حد الـ CTB الأقصى (%):</label>
                      <input
                        type="number"
                        value={editingLOB === "chat" ? targetFormChat.ctb : targetFormUniversal.ctb}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          if (editingLOB === "chat") {
                            setTargetFormChat({ ...targetFormChat, ctb: val });
                          } else {
                            setTargetFormUniversal({ ...targetFormUniversal, ctb: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center outline-none focus:ring-1 focus:ring-we-pink"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {isSuccessTargets && (
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs flex items-center justify-center gap-1.5 font-bold animate-pulse">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <span>تم حفظ وتحديث الأهداف بنجاح وإعادة تكوين كروت القياس!</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Settings className="w-4 h-4" />
                <span>حفظ التعديلات وتثبيتها</span>
              </button>
            </form>
          </div>
        )}
        
        {adminTab === "data" && (
          <div className="space-y-6">
            {/* System Status and DB Options */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-right space-y-4" dir="rtl">
              <h3 className="text-md font-display font-semibold text-slate-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-500" />
                خيارات قاعدة البيانات والنسخ الاحتياطي
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">النسخ الاحتياطي للبيانات</h4>
                    <p className="text-xs text-slate-500">حفظ نسخة كاملة من بيانات النظام بصيغة JSON على جهازك.</p>
                  </div>
                  <button
                    onClick={() => {
                      const data = { employees, targetsChat, targetsUniversal, historicalTargets };
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `kpi_backup_${new Date().toISOString().split("T")[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="mt-auto bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل نسخة احتياطية</span>
                  </button>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">استعادة البيانات</h4>
                    <p className="text-xs text-slate-500">رفع نسخة احتياطية (JSON) لاستعادة النظام. سيتم كتابة البيانات فوق الحالية.</p>
                  </div>
                  <label className="mt-auto cursor-pointer bg-white border-2 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold py-2 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span>رفع ملف Backup</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          try {
                            const content = ev.target?.result as string;
                            const data = JSON.parse(content);
                            if (data.employees && Array.isArray(data.employees)) {
                              setDialogConfirm({
                                isOpen: true,
                                title: "تأكيد استعادة البيانات",
                                message: "هل أنت متأكد من استعادة هذه النسخة الاحتياطية؟ سيتم مسح البيانات الحالية نهائياً واستبدالها بالبيانات الموجودة في الملف.",
                                confirmText: "استعادة البيانات",
                                cancelText: "إلغاء",
                                theme: "rose",
                                onConfirm: async () => {
                                  try {
                                    await onUpdateEmployees(data.employees);
                                    if (data.targetsChat && data.targetsUniversal) {
                                      await onUpdateTargets(data.targetsChat, data.targetsUniversal, bannerNotice, maintenancePages, data.historicalTargets || {});
                                    }
                                    setDialogAlert({ isOpen: true, title: "نجاح", message: "تم استعادة البيانات بنجاح", type: "success" });
                                  } catch (e) {
                                    setDialogAlert({ isOpen: true, title: "خطأ", message: "حدث خطأ أثناء الاستعادة", type: "error" });
                                  }
                                }
                              });
                            } else {
                              setDialogAlert({ isOpen: true, title: "خطأ", message: "ملف النسخة الاحتياطية غير صالح", type: "error" });
                            }
                          } catch (err) {
                            setDialogAlert({ isOpen: true, title: "خطأ", message: "حدث خطأ أثناء قراءة الملف", type: "error" });
                          }
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Manage Months */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-right space-y-4" dir="rtl">
              <h3 className="text-md font-display font-semibold text-rose-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                حذف وإدارة بيانات شهر محدد
              </h3>
              
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 flex flex-col gap-3">
                <p className="text-xs text-rose-700 font-medium">
                  احذر: سيؤدي هذا الإجراء إلى مسح بيانات الشهر المحدد من جميع الموظفين ومن سجل الأهداف التاريخية بشكل نهائي!
                </p>
                <div className="flex gap-2 items-center mt-2">
                  <select
                    id="monthToDeleteSelect"
                    className="flex-1 px-3 py-2.5 bg-white border border-rose-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-rose-500 font-mono text-center text-slate-700"
                    defaultValue=""
                  >
                    <option value="" disabled>-- اختر الشهر المراد حذفه --</option>
                    {sortMonths(Array.from(new Set(employees.flatMap(e => e.performance.map(p => p.month))))).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      const select = document.getElementById("monthToDeleteSelect") as HTMLSelectElement;
                      const m = select.value;
                      if (!m) {
                        setDialogAlert({ isOpen: true, title: "تنبيه", message: "يرجى اختيار الشهر أولاً", type: "error" });
                        return;
                      }
                      setDialogConfirm({
                        isOpen: true,
                        title: "تأكيد مسح بيانات الشهر",
                        message: `هل أنت متأكد نهائياً من مسح كافة بيانات وأهداف شهر ${m} من جميع الموظفين؟ هذا الإجراء لا يمكن التراجع عنه.`,
                        confirmText: "نعم، مسح البيانات",
                        cancelText: "إلغاء",
                        theme: "rose",
                        onConfirm: async () => {
                          try {
                            const newEmployees = employees.map(emp => ({
                              ...emp,
                              performance: emp.performance.filter(p => p.month !== m)
                            }));
                            const newHistorical = { ...historicalTargets };
                            if (newHistorical[m]) {
                              delete newHistorical[m];
                            }
                            await onUpdateEmployees(newEmployees);
                            await onUpdateTargets(targetsChat, targetsUniversal, bannerNotice, maintenancePages, newHistorical);
                            setDialogAlert({ isOpen: true, title: "نجاح", message: `تم مسح بيانات شهر ${m} بنجاح من جميع السجلات`, type: "success" });
                            select.value = "";
                          } catch (e) {
                            setDialogAlert({ isOpen: true, title: "خطأ", message: "حدث خطأ أثناء المسح", type: "error" });
                          }
                        }
                      });
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2.5 px-6 rounded-xl shadow-sm transition-all"
                  >
                    تنفيذ الحذف
                  </button>
                </div>
              </div>
            </div>
            
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {dialogConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 max-w-md w-full text-right space-y-4 transform transition-all">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                dialogConfirm.theme === "rose" ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
              }`}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-md sm:text-lg font-display font-black text-slate-800 leading-none">
                {dialogConfirm.title}
              </h3>
            </div>

            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-semibold">
              {dialogConfirm.message}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={async () => {
                  if (dialogConfirm.onConfirm) {
                    await dialogConfirm.onConfirm();
                  }
                  setDialogConfirm(prev => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                  dialogConfirm.theme === "rose" 
                    ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800" 
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {dialogConfirm.confirmText}
              </button>
              <button
                type="button"
                onClick={() => setDialogConfirm(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
              >
                {dialogConfirm.cancelText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert/Success Modal */}
      {dialogAlert.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 max-w-sm w-full text-right space-y-4 transform transition-all">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                dialogAlert.type === "success" 
                  ? "bg-emerald-50 text-emerald-600" 
                  : dialogAlert.type === "error"
                  ? "bg-rose-50 text-rose-600"
                  : "bg-indigo-50 text-indigo-600"
              }`}>
                {dialogAlert.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <h3 className="text-md sm:text-lg font-display font-black text-slate-800 leading-none">
                {dialogAlert.title}
              </h3>
            </div>

            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-semibold">
              {dialogAlert.message}
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDialogAlert(prev => ({ ...prev, isOpen: false }))}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-md"
              >
                موافق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Reset Modal */}
      {resetDialogState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 max-w-md w-full text-right space-y-4 transform transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-50 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-display font-black text-slate-800 leading-none">
                خيارات الحذف وإعادة التهيئة
              </h3>
            </div>

            <p className="text-slate-500 text-xs leading-relaxed font-semibold mb-4">
              اختر نوع البيانات التي ترغب في مسحها. سيتم مزامنة الحذف مع السحابة فوراً ولا يمكن التراجع عن هذا الإجراء:
            </p>

            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${resetDialogState.mode === "all" ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                <input 
                  type="radio" 
                  name="reset_mode" 
                  checked={resetDialogState.mode === "all"}
                  onChange={() => setResetDialogState(prev => ({ ...prev, mode: "all" }))}
                  className="w-4 h-4 text-rose-600"
                />
                <span className="text-xs font-bold text-slate-800">حذف كافة البيانات (استعادة المصنع)</span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${resetDialogState.mode === "employees_only" ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                <input 
                  type="radio" 
                  name="reset_mode" 
                  checked={resetDialogState.mode === "employees_only"}
                  onChange={() => setResetDialogState(prev => ({ ...prev, mode: "employees_only" }))}
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-xs font-bold text-slate-800">حذف جميع الموظفين وسجلاتهم</span>
              </label>

              <div className={`p-3 rounded-xl border transition-colors ${resetDialogState.mode === "kpi_month" ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <input 
                    type="radio" 
                    name="reset_mode" 
                    checked={resetDialogState.mode === "kpi_month"}
                    onChange={() => setResetDialogState(prev => ({ ...prev, mode: "kpi_month" }))}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-xs font-bold text-slate-800">حذف مؤشرات <b>KPI</b> لشهر محدد:</span>
                </label>
                {resetDialogState.mode === "kpi_month" && (
                  <select
                    value={resetDialogState.selectedMonth}
                    onChange={(e) => setResetDialogState(prev => ({ ...prev, selectedMonth: e.target.value }))}
                    className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-700 mt-1"
                  >
                        <option value="Jan-25">Jan-25</option>
                        <option value="Feb-25">Feb-25</option>
                        <option value="Mar-25">Mar-25</option>
                        <option value="Apr-25">Apr-25</option>
                        <option value="May-25">May-25</option>
                        <option value="Jun-25">Jun-25</option>
                        <option value="Jul-25">Jul-25</option>
                        <option value="Aug-25">Aug-25</option>
                        <option value="Sep-25">Sep-25</option>
                        <option value="Oct-25">Oct-25</option>
                        <option value="Nov-25">Nov-25</option>
                        <option value="Dec-25">Dec-25</option>
                        <option value="Jan-26">Jan-26</option>
                        <option value="Feb-26">Feb-26</option>
                        <option value="Mar-26">Mar-26</option>
                        <option value="Apr-26">Apr-26</option>
                        <option value="May-26">May-26</option>
                  </select>
                )}
              </div>

              <div className={`p-3 rounded-xl border transition-colors ${resetDialogState.mode === "nps_month" ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <input 
                    type="radio" 
                    name="reset_mode" 
                    checked={resetDialogState.mode === "nps_month"}
                    onChange={() => setResetDialogState(prev => ({ ...prev, mode: "nps_month" }))}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-xs font-bold text-slate-800">حذف استطلاعات <b>NPS</b> لشهر محدد:</span>
                </label>
                {resetDialogState.mode === "nps_month" && (
                  <select
                    value={resetDialogState.selectedMonth}
                    onChange={(e) => setResetDialogState(prev => ({ ...prev, selectedMonth: e.target.value }))}
                    className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-700 mt-1"
                  >
                        <option value="Jan-25">Jan-25</option>
                        <option value="Feb-25">Feb-25</option>
                        <option value="Mar-25">Mar-25</option>
                        <option value="Apr-25">Apr-25</option>
                        <option value="May-25">May-25</option>
                        <option value="Jun-25">Jun-25</option>
                        <option value="Jul-25">Jul-25</option>
                        <option value="Aug-25">Aug-25</option>
                        <option value="Sep-25">Sep-25</option>
                        <option value="Oct-25">Oct-25</option>
                        <option value="Nov-25">Nov-25</option>
                        <option value="Dec-25">Dec-25</option>
                        <option value="Jan-26">Jan-26</option>
                        <option value="Feb-26">Feb-26</option>
                        <option value="Mar-26">Mar-26</option>
                        <option value="Apr-26">Apr-26</option>
                        <option value="May-26">May-26</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex gap-2.5 pt-4">
              <button
                type="button"
                onClick={executeAdvancedReset}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-sm"
              >
                المضي قدماً بالحذف
              </button>
              <button
                type="button"
                onClick={() => setResetDialogState(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
