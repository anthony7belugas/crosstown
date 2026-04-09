// utils/blockUtils.ts
// Simplified from Besties — no anonymous block types needed for CrossTown
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc,
  doc, getDocs, query, serverTimestamp, where, writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export type ReportReason = "spam" | "harassment" | "inappropriate_content" | "fake_profile" | "other";

export interface ReportParams {
  reportedId: string;
  reason: ReportReason;
  description?: string;
}

/**
 * Block a user — adds to both users' block arrays and deletes any match between them
 */
export async function blockUser(blockedId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Not authenticated");
  if (currentUser.uid === blockedId) throw new Error("Cannot block yourself");

  const batch = writeBatch(db);

  // Add to current user's blockedUsers
  const currentUserRef = doc(db, "users", currentUser.uid);
  batch.update(currentUserRef, { blockedUsers: arrayUnion(blockedId) });

  // Add to other user's blockedByUsers
  const blockedUserRef = doc(db, "users", blockedId);
  batch.update(blockedUserRef, { blockedByUsers: arrayUnion(currentUser.uid) });

  // Create block record for audit trail
  const blockRef = doc(collection(db, "blocks"));
  batch.set(blockRef, {
    blockerId: currentUser.uid,
    blockedId,
    status: "active",
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  // Delete any matches between the two users
  await deleteMatchesBetweenUsers(currentUser.uid, blockedId);

  // Delete any likes between the two users
  await deleteLikesBetweenUsers(currentUser.uid, blockedId);
}

/**
 * Unblock a user
 */
export async function unblockUser(blockedId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Not authenticated");

  const batch = writeBatch(db);

  const currentUserRef = doc(db, "users", currentUser.uid);
  batch.update(currentUserRef, { blockedUsers: arrayRemove(blockedId) });

  const otherUserRef = doc(db, "users", blockedId);
  batch.update(otherUserRef, { blockedByUsers: arrayRemove(currentUser.uid) });

  // Soft-delete block records
  const blocksQuery = query(
    collection(db, "blocks"),
    where("blockerId", "==", currentUser.uid),
    where("blockedId", "==", blockedId),
    where("status", "==", "active")
  );
  const blocksSnapshot = await getDocs(blocksQuery);
  blocksSnapshot.docs.forEach((d) => {
    batch.update(d.ref, { status: "unblocked", unblockedAt: serverTimestamp() });
  });

  await batch.commit();
}

/**
 * Report a user
 */
export async function reportUser(params: ReportParams): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Not authenticated");

  await addDoc(collection(db, "reports"), {
    reporterId: currentUser.uid,
    reportedId: params.reportedId,
    reason: params.reason,
    description: params.description?.substring(0, 500) || null,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

/**
 * Check if a user is blocked in either direction
 */
export function isUserBlocked(
  userId: string,
  blockedUsers: string[],
  blockedByUsers: string[]
): boolean {
  return blockedUsers.includes(userId) || blockedByUsers.includes(userId);
}

// --- Helpers ---

async function deleteMatchesBetweenUsers(uid1: string, uid2: string): Promise<void> {
  try {
    // Matches store both user IDs in a users array
    const q1 = query(collection(db, "matches"), where("users", "array-contains", uid1));
    const snapshot = await getDocs(q1);
    const deletePromises: Promise<void>[] = [];
    snapshot.docs.forEach((d) => {
      const data = d.data();
      if (data.users && data.users.includes(uid2)) {
        deletePromises.push(deleteDoc(d.ref));
      }
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting matches:", error);
  }
}

async function deleteLikesBetweenUsers(uid1: string, uid2: string): Promise<void> {
  try {
    const q1 = query(collection(db, "likes"), where("fromUserId", "==", uid1), where("toUserId", "==", uid2));
    const q2 = query(collection(db, "likes"), where("fromUserId", "==", uid2), where("toUserId", "==", uid1));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const deletePromises: Promise<void>[] = [];
    s1.docs.forEach((d) => deletePromises.push(deleteDoc(d.ref)));
    s2.docs.forEach((d) => deletePromises.push(deleteDoc(d.ref)));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting likes:", error);
  }
}
