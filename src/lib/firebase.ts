import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch,
  onSnapshot,
  deleteDoc
} from "firebase/firestore";
import { Employee, KPITargets } from "../types";
import { INITIAL_EMPLOYEES, DEFAULT_KPI_TARGETS, DEFAULT_KPI_TARGETS_CHAT, DEFAULT_KPI_TARGETS_UNIVERSAL } from "../data";

// Read Firebase configurations
const firebaseConfig = {
  projectId: "gen-lang-client-0014091682",
  appId: "1:607191861183:web:078389eb1dab23f41f430a",
  apiKey: "AIzaSyDHDWbG5b6A7u-1xbKB01BsVYWoFJri92w",
  authDomain: "gen-lang-client-0014091682.firebaseapp.com",
  storageBucket: "gen-lang-client-0014091682.firebasestorage.app",
  messagingSenderId: "607191861183"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore specifying the custom database ID as configured
export const db = getFirestore(app, "ai-studio-82f94d3f-074b-42fe-9c07-c0419167aba6");

/**
 * Seeding initial default configuration and employees to Firestore if empty.
 */
export async function seedDatabaseIfEmpty() {
  try {
    // 1. Seed Config (Targets & Banner Notice)
    const configRef = doc(db, "we_config", "general");
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        targets: DEFAULT_KPI_TARGETS_CHAT,
        targetsChat: DEFAULT_KPI_TARGETS_CHAT,
        targetsUniversal: DEFAULT_KPI_TARGETS_UNIVERSAL,
        bannerNotice: "📢 أهلاً بكم في بوابة Digital Chat KPI الموحدة. تم تفعيل المزامنة السحابية الفورية لتقييمات الأداء مع جميع المشرفين وليدر الفرق بنجاح!",
        updatedAt: new Date().toISOString()
      });
    }

    // 2. Seed Employees
    const empColRef = collection(db, "employees");
    const empSnap = await getDocs(empColRef);
    if (empSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_EMPLOYEES.forEach((emp) => {
        const docRef = doc(db, "employees", emp.id);
        batch.set(docRef, emp);
      });
      await batch.commit();
      console.log("Database seeded successfully with default WE employees.");
    }
  } catch (error) {
    console.error("Error seeding Firebase database:", error);
  }
}

/**
 * Sync configuration from Cloud Database.
 */
export function subscribeToConfig(onUpdate: (data: { targetsChat: KPITargets; targetsUniversal: KPITargets; bannerNotice: string; maintenanceMode: boolean }) => void) {
  const configRef = doc(db, "we_config", "general");
  return onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      onUpdate({
        targetsChat: data.targetsChat || data.targets || DEFAULT_KPI_TARGETS_CHAT,
        targetsUniversal: data.targetsUniversal || data.targets || DEFAULT_KPI_TARGETS_UNIVERSAL,
        bannerNotice: data.bannerNotice || "",
        maintenanceMode: data.maintenanceMode || false
      });
    }
  }, (err) => {
    console.error("Error subscribing to general config:", err);
  });
}

/**
 * Sync employees list from Cloud Database.
 */
export function subscribeToEmployees(onUpdate: (employees: Employee[]) => void) {
  const empColRef = collection(db, "employees");
  return onSnapshot(empColRef, (colSnap) => {
    const list: Employee[] = [];
    colSnap.forEach((docSnap) => {
      list.push(docSnap.data() as Employee);
    });
    // Sort or return as-is
    onUpdate(list);
  }, (err) => {
    console.error("Error subscribing to employees collection:", err);
  });
}

/**
 * Save targets and notice to cloud
 */
export async function updateCloudConfig(targetsChat: KPITargets, targetsUniversal: KPITargets, bannerNotice: string, maintenanceMode: boolean = false) {
  const configRef = doc(db, "we_config", "general");
  await setDoc(configRef, {
    targetsChat,
    targetsUniversal,
    targets: targetsChat, // maintain default for backward compatibility
    bannerNotice,
    maintenanceMode,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Save updated list of employees to cloud.
 * To minimize network operations, we upsert matching items or commit full adjustments safely.
 */
export async function saveEmployeeToCloud(employee: Employee) {
  const docRef = doc(db, "employees", employee.id);
  await setDoc(docRef, employee);
}

/**
 * Deletes an employee from cloud
 */
export async function deleteEmployeeFromCloud(id: string) {
  const docRef = doc(db, "employees", id);
  await deleteDoc(docRef);
}

/**
 * Composed full sync updates. Matches existing schema expectations.
 */
export async function updateAllEmployeesInCloud(employeesList: Employee[]) {
  // Fetch existing employee IDs from Firestore to know which ones to delete
  const employeesCol = collection(db, "employees");
  const querySnapshot = await getDocs(employeesCol);
  
  const existingDocIds = new Set<string>();
  querySnapshot.forEach(doc => existingDocIds.add(doc.id));

  const newDocIds = new Set<string>();
  employeesList.forEach(emp => newDocIds.add(emp.id));

  // Determine which documents need to be deleted
  const idsToDelete = Array.from(existingDocIds).filter(id => !newDocIds.has(id));

  // Firebase allows a maximum of 500 writes per batch
  const MAX_BATCH_SIZE = 500;
  let batch = writeBatch(db);
  let batchCount = 0;

  const commitBatchIfNeeded = async () => {
    if (batchCount > 0 && batchCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  };

  // Perform sets
  for (const emp of employeesList) {
    const docRef = doc(db, "employees", emp.id);
    batch.set(docRef, emp);
    batchCount++;
    await commitBatchIfNeeded();
  }

  // Perform deletes
  for (const id of idsToDelete) {
    const docRef = doc(db, "employees", id);
    batch.delete(docRef);
    batchCount++;
    await commitBatchIfNeeded();
  }

  // Commit any remaining writes
  if (batchCount > 0) {
    await batch.commit();
  }
}
