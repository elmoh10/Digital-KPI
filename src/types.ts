/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MonthlyPerformance {
  month: string; // e.g. "Jan-25", "Feb-25"
  aht: string;   // e.g. "09:09" (Format MM:SS)
  csi: number;   // e.g. 35 for 35%
  nps: number;   // e.g. 42 for 42%
  fcr: number;   // e.g. 77 for 77%
  ttb: number;   // e.g. 90 for 90%
  ctc: number;   // e.g. 10 for 10%
  ctb: number;   // e.g. 5 for 5%
  absent: number;    // Count, e.g. 0
  sick: number;      // Count, e.g. 0
  emergency: number; // Count, e.g. 0
  unplanned: number; // Count, e.g. 0
  finalScore: number; // e.g. 58 for 58%
}

export interface WeeklyMetrics {
  answered?: number;
  handlingTime?: string;
  aht?: string;
  totalSurvey?: number;
  tnps?: number;
  fcr?: number;
  ttb?: number;
  bb?: number;
}

export interface MonthlyWeeklyPerformance {
  month: string;
  weeks: {
    week1?: WeeklyMetrics;
    week2?: WeeklyMetrics;
    week3?: WeeklyMetrics;
    week4?: WeeklyMetrics;
  };
}

export interface LeaderMonthlyPerformance {
  month: string;
  ctc: number;
  ctb: number;
  nps?: number;
  aht?: string;
  finalScore: number;
}

export interface Employee {
  id: string;          // ID: 44672
  fullName: string;    // Full Name: Aya Maher Abdo Abdullah
  newTL: string;       // New TL: Hala Samy KamalEldin ElZomor
  newSV: string;       // New SV: Ehab Heness
  mobileNumber: string;
  nationalId: string;
  location: string;    // WFH / Site
  lob: string;         // Chat / ADSL
  performance: MonthlyPerformance[]; // Sorted chronologically
  weeklyPerformance?: MonthlyWeeklyPerformance[]; 
  leaderPerformance?: LeaderMonthlyPerformance[];
  isArchived?: boolean; // For soft deletes and hiding from main dashboards
}

export interface KPITargets {
  ahtSeconds: number; // Target in seconds, e.g. 7 * 60 + 20 = 440 seconds ("07:20")
  csi: number;        // Target %, e.g. 40
  nps: number;        // Target %, e.g. 39
  fcr: number;        // Target %, e.g. 65
  ttb: number;        // Target %, e.g. 85
  ctc: number;        // Target %, e.g. 15
  ctb: number;        // Target %, e.g. 10
  absent: number;     // Target Count, e.g. 0 (or percentage, let's keep it count)
  sick: number;       // Target Count, e.g. 0
  emergency: number;  // Target Count, e.g. 0
  unplanned: number;  // Target Count, e.g. 0
  finalScore: number; // Target %, e.g. 52
}

export type HistoricalTargets = Record<string, { chat: KPITargets, universal: KPITargets }>;

export interface SystemUser {
  id: string;
  username: string;
  password?: string;
  role: "admin" | "manager" | "super" | "leader";
  fullName: string;
  permissions?: string[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "alert";
  timestamp: number;
  readBy: string[]; // List of user IDs who have read it
  targetRole: "all" | "agent" | "leader" | "admin"; 
  targetUserId?: string; // If targeting a specific user (by ID)
}
