/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, KPITargets } from "./types";

export const DEFAULT_KPI_TARGETS: KPITargets = {
  ahtSeconds: 440, // 07:20
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
};

export const DEFAULT_KPI_TARGETS_CHAT: KPITargets = {
  ahtSeconds: 440, // 07:20
  csi: 40,
  nps: 38, // Chat/ADSL has NPS target of 38%
  fcr: 65,
  ttb: 85,
  ctc: 15,
  ctb: 10,
  absent: 0,
  sick: 0,
  emergency: 0,
  unplanned: 0,
  finalScore: 52,
};

export const DEFAULT_KPI_TARGETS_UNIVERSAL: KPITargets = {
  ahtSeconds: 465, // 07:45 (7*60 + 45 = 465 secs)
  csi: 40,
  nps: 42, // Universal has NPS target of 42%
  fcr: 67, // Universal has FCR target of 67%
  ttb: 85,
  ctc: 15,
  ctb: 10,
  absent: 0,
  sick: 0,
  emergency: 0,
  unplanned: 0,
  finalScore: 52,
};

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: "44672",
    fullName: "Aya Maher Abdo Abdullah",
    newTL: "Hala Samy KamalEldin ElZomor",
    newSV: "Ehab Heness",
    mobileNumber: "1006144841",
    nationalId: "29106123456789",
    location: "WFH",
    lob: "Chat / ADSL",
    performance: [
      { month: "Jan-25", aht: "09:09", csi: 35, nps: 42, fcr: 77, ttb: 90, ctc: 10, ctb: 5, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 58 },
      { month: "Feb-25", aht: "08:33", csi: 23, nps: 34, fcr: 62, ttb: 87, ctc: 10, ctb: 5, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 46 },
      { month: "Mar-25", aht: "07:39", csi: 16, nps: 39, fcr: 63, ttb: 82, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 1, unplanned: 1, finalScore: 47 },
      { month: "Apr-25", aht: "07:35", csi: 19, nps: 30, fcr: 62, ttb: 84, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 55 },
      { month: "May-25", aht: "07:27", csi: 23, nps: 32, fcr: 53, ttb: 83, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 61 },
      { month: "Jun-25", aht: "08:29", csi: 10, nps: 13, fcr: 55, ttb: 72, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 37 },
      { month: "Jul-25", aht: "07:17", csi: 23, nps: 30, fcr: 55, ttb: 87, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 1, unplanned: 0, finalScore: 65 },
      { month: "Aug-25", aht: "07:59", csi: 0, nps: 11, fcr: 47, ttb: 72, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 33 },
      { month: "Sep-25", aht: "08:04", csi: 26, nps: 33, fcr: 67, ttb: 86, ctc: 15, ctb: 10, absent: 0, sick: 2, emergency: 0, unplanned: 0, finalScore: 46 },
      { month: "Oct-25", aht: "08:16", csi: 10, nps: 30, fcr: 58, ttb: 77, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 1, finalScore: 39 },
      { month: "Nov-25", aht: "00:00", csi: 11, nps: 33, fcr: 61, ttb: 76, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 65 },
      { month: "Dec-25", aht: "06:15", csi: 3, nps: -9, fcr: 50, ttb: 78, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 1, unplanned: 0, finalScore: 53 },
      { month: "Jan-26", aht: "06:47", csi: 5, nps: 4, fcr: 46, ttb: 75, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 1, unplanned: 0, finalScore: 59 },
      { month: "Feb-26", aht: "07:16", csi: 5, nps: 6, fcr: 54, ttb: 81, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 60 },
      { month: "Mar-26", aht: "06:37", csi: 13, nps: 20, fcr: 56, ttb: 76, ctc: 15, ctb: 10, absent: 0, sick: 6, emergency: 1, unplanned: 0, finalScore: 38 },
      { month: "Apr-26", aht: "07:14", csi: 19, nps: 11, fcr: 63, ttb: 81, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 74 },
      { month: "May-26", aht: "07:34", csi: 6, nps: 14, fcr: 29, ttb: 57, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 42 }
    ]
  },
  {
    id: "44673",
    fullName: "Hesham Mohamed Aly",
    newTL: "Hala Samy KamalEldin ElZomor",
    newSV: "Ehab Heness",
    mobileNumber: "1098765432",
    nationalId: "29210123456789",
    location: "Premise",
    lob: "Chat / ADSL",
    performance: [
      { month: "Jan-25", aht: "07:12", csi: 45, nps: 55, fcr: 70, ttb: 88, ctc: 12, ctb: 8, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 68 },
      { month: "Feb-25", aht: "06:55", csi: 42, nps: 48, fcr: 68, ttb: 86, ctc: 10, ctb: 9, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 62 },
      { month: "Mar-25", aht: "07:05", csi: 40, nps: 40, fcr: 66, ttb: 85, ctc: 15, ctb: 10, absent: 0, sick: 1, emergency: 0, unplanned: 0, finalScore: 58 },
      { month: "Apr-25", aht: "07:18", csi: 38, nps: 41, fcr: 65, ttb: 82, ctc: 15, ctb: 10, absent: 1, sick: 0, emergency: 0, unplanned: 1, finalScore: 50 },
      { month: "May-25", aht: "07:08", csi: 41, nps: 44, fcr: 67, ttb: 87, ctc: 14, ctb: 8, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 60 },
      { month: "Jun-25", aht: "07:30", csi: 35, nps: 30, fcr: 60, ttb: 80, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 48 },
      { month: "Jul-25", aht: "07:22", csi: 43, nps: 49, fcr: 69, ttb: 89, ctc: 13, ctb: 7, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 63 }
    ]
  },
  {
    id: "44674",
    fullName: "Mariam Ahmed Tawfik",
    newTL: "Ahmed Hassan Soliman",
    newSV: "Ehab Heness",
    mobileNumber: "1012345678",
    nationalId: "29408123456789",
    location: "WFH",
    lob: "Chat / ADSL",
    performance: [
      { month: "Jan-25", aht: "07:44", csi: 30, nps: 35, fcr: 63, ttb: 82, ctc: 14, ctb: 9, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 48 },
      { month: "Feb-25", aht: "07:25", csi: 34, nps: 38, fcr: 64, ttb: 84, ctc: 13, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 53 },
      { month: "Mar-25", aht: "07:18", csi: 39, nps: 42, fcr: 66, ttb: 85, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 56 },
      { month: "Apr-25", aht: "07:30", csi: 36, nps: 35, fcr: 60, ttb: 81, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 49 },
      { month: "May-25", aht: "07:05", csi: 43, nps: 52, fcr: 68, ttb: 89, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 64 }
    ]
  },
  {
    id: "44675",
    fullName: "Sherif Mahmoud Othman",
    newTL: "Hala Samy KamalEldin ElZomor",
    newSV: "Noha Gamil",
    mobileNumber: "1055566778",
    nationalId: "29012123456789",
    location: "Premise",
    lob: "Chat / ADSL",
    performance: [
      { month: "Jan-25", aht: "08:15", csi: 28, nps: 20, fcr: 58, ttb: 75, ctc: 15, ctb: 10, absent: 1, sick: 1, emergency: 0, unplanned: 2, finalScore: 40 },
      { month: "Feb-25", aht: "08:02", csi: 32, nps: 28, fcr: 61, ttb: 79, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 1, finalScore: 45 },
      { month: "Mar-25", aht: "07:48", csi: 35, nps: 34, fcr: 62, ttb: 83, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 49 },
      { month: "Apr-25", aht: "07:23", csi: 40, nps: 42, fcr: 65, ttb: 86, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 54 },
      { month: "May-25", aht: "07:11", csi: 42, nps: 45, fcr: 67, ttb: 88, ctc: 15, ctb: 10, absent: 0, sick: 0, emergency: 0, unplanned: 0, finalScore: 59 }
    ]
  }
];
