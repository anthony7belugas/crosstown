// utils/challengeLimits.ts
// Daily challenge limit — adapted from Besties rateLimits.ts
import { doc, getDoc } from "firebase/firestore";
import { Alert } from "react-native";
import { auth, db } from "../firebaseConfig";

export const DAILY_CHALLENGE_LIMIT = 30;

function getTodayString(): string {
  return new Date().toLocaleDateString("en-CA"); // "2026-04-09" format
}

/**
 * Check if user has challenges remaining today
 */
export async function canChallenge(): Promise<{ allowed: boolean; remaining: number }> {
  try {
    if (!auth.currentUser) return { allowed: false, remaining: 0 };

    const userRef = doc(db, "users", auth.currentUser.uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data() || {};

    const today = getTodayString();
    const lastDate = userData.dailyChallengeDate || "";

    let count = 0;
    if (lastDate === today) {
      count = userData.dailyChallengeCount || 0;
    }

    return {
      allowed: count < DAILY_CHALLENGE_LIMIT,
      remaining: Math.max(0, DAILY_CHALLENGE_LIMIT - count),
    };
  } catch (error) {
    console.error("Error checking challenge limit:", error);
    return { allowed: true, remaining: DAILY_CHALLENGE_LIMIT };
  }
}

/**
 * Check and show alert if limit reached
 */
export async function canChallengeWithAlert(): Promise<boolean> {
  const { allowed, remaining } = await canChallenge();
  if (!allowed) {
    Alert.alert(
      "Daily Limit Reached",
      "You've used all 30 challenges for today.\nCome back tomorrow for more!",
      [{ text: "Got It" }]
    );
    return false;
  }
  return true;
}

/**
 * Get time until midnight reset
 */
export function getTimeUntilReset(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.ceil((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
