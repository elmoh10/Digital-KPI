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
  deleteDoc,
  query,
  where,
  getCountFromServer,
  serverTimestamp
} from "firebase/firestore";
import { Employee, KPITargets, SystemUser } from "../types";
import { INITIAL_EMPLOYEES, DEFAULT_KPI_TARGETS, DEFAULT_KPI_TARGETS_CHAT, DEFAULT_KPI_TARGETS_UNIVERSAL, DEFAULT_USERS } from "../data";

// Session UUID for presence
const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

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
    
    // 3. Seed Users
    const usersColRef = collection(db, "users");
    const usersSnap = await getDocs(usersColRef);
    if (usersSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_USERS.forEach((user) => {
        const docRef = doc(db, "users", user.id);
        batch.set(docRef, user);
      });
      await batch.commit();
      console.log("Database seeded successfully with default users.");
    }
  } catch (error) {
    console.warn("Error seeding Firebase database:", error);
    throw error;
  }
}

export async function subscribeToUsers(onUpdate: (users: SystemUser[]) => void, onError?: (err: Error) => void) {
  const usersColRef = collection(db, "users");
  return onSnapshot(usersColRef, (colSnap) => {
    const list: SystemUser[] = [];
    colSnap.forEach((docSnap) => {
      list.push(docSnap.data() as SystemUser);
    });
    onUpdate(list);
  }, (err) => {
    console.warn("Error subscribing to users:", err);
    if (onError) onError(err);
  });
}

export async function saveUserToCloud(user: SystemUser) {
  const docRef = doc(db, "users", user.id);
  await setDoc(docRef, user);
}

export async function deleteUserFromCloud(userId: string) {
  const docRef = doc(db, "users", userId);
  await deleteDoc(docRef);
}

export async function deleteEmployeesBatch(employeeIds: string[]) {
  const batch = writeBatch(db);
  employeeIds.forEach(id => {
    const docRef = doc(db, "employees", id);
    batch.delete(docRef);
  });
  await batch.commit();
}

/**
 * Sync configuration from Cloud Database.
 */
export function subscribeToConfig(
  onUpdate: (data: { targetsChat: KPITargets; targetsUniversal: KPITargets; historicalTargets?: Record<string, { chat: KPITargets; universal: KPITargets }>; bannerNotice: string; maintenancePages: string[]; lobOptions: string[] }) => void,
  onError?: (err: Error) => void
) {
  const configRef = doc(db, "we_config", "general");
  return onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      onUpdate({
        targetsChat: data.targetsChat || data.targets || DEFAULT_KPI_TARGETS_CHAT,
        targetsUniversal: data.targetsUniversal || data.targets || DEFAULT_KPI_TARGETS_UNIVERSAL,
        historicalTargets: data.historicalTargets || {},
        bannerNotice: data.bannerNotice || "",
        maintenancePages: data.maintenancePages || (data.maintenanceMode ? ["dashboard", "analytics", "weekly"] : []),
        lobOptions: data.lobOptions || ["Chat / ADSL", "Universal"]
      });
    }
  }, (err) => {
    console.warn("Error subscribing to general config:", err);
    if (onError) onError(err);
  });
}

/**
 * Sync employees list from Cloud Database.
 */
export function subscribeToEmployees(
  onUpdate: (employees: Employee[]) => void,
  onError?: (err: Error) => void
) {
  const empColRef = collection(db, "employees");
  return onSnapshot(empColRef, (colSnap) => {
    const list: Employee[] = [];
    colSnap.forEach((docSnap) => {
      list.push(docSnap.data() as Employee);
    });
    // Sort or return as-is
    onUpdate(list);
  }, (err) => {
    console.warn("Error subscribing to employees collection:", err);
    if (onError) onError(err);
  });
}

/**
 * Save targets and notice to cloud
 */
export async function updateCloudConfig(targetsChat: KPITargets, targetsUniversal: KPITargets, bannerNotice: string, maintenancePages: string[] = [], historicalTargets?: Record<string, { chat: KPITargets; universal: KPITargets }>) {
  const configRef = doc(db, "we_config", "general");
  const payload: any = {
    targetsChat,
    targetsUniversal,
    targets: targetsChat, // maintain default for backward compatibility
    bannerNotice,
    maintenancePages,
    updatedAt: new Date().toISOString()
  };
  if (historicalTargets) {
    payload.historicalTargets = historicalTargets;
  }
  await setDoc(configRef, payload, { merge: true });
}

export async function updateLobOptionsConfig(lobOptions: string[]) {
  const configRef = doc(db, "we_config", "general");
  await setDoc(configRef, { lobOptions }, { merge: true });
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

/**
 * Update current user's presence online
 */
export async function updatePresence() {
  try {
    const presenceRef = doc(db, "presence", sessionId);
    await setDoc(presenceRef, {
      lastSeen: Date.now()
    }, { merge: true });
  } catch (e) {
    console.warn("Failed to update presence", e);
  }
}

/**
 * Remove current user's presence online (run on window unload)
 */
export async function removePresence() {
  try {
    const presenceRef = doc(db, "presence", sessionId);
    await deleteDoc(presenceRef);
  } catch (e) {
    console.warn("Failed to remove presence", e);
  }
}

/**
 * Get current online user count based on heartbeat within last 120 seconds.
 */
export async function getOnlineCount() {
  try {
    // get count of docs where lastSeen >= Date.now() - 120000
    const q = query(
      collection(db, "presence"), 
      where("lastSeen", ">=", Date.now() - 120000)
    );
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count || 1; // At least 1 (self)
  } catch (e) {
    console.warn("Failed to get online count", e);
    return 1;
  }
}