// utils/userProfileCache.ts
// Ported from Besties — minimizes Firestore reads for profile lookups
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export interface CachedUserProfile {
  name: string;
  photo?: string;
  major?: string;
  age?: number;
  side?: string;
  fetchedAt: number;
}

const profileCache = new Map<string, CachedUserProfile>();
const pendingFetches = new Map<string, Promise<CachedUserProfile | null>>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const getUserProfile = async (userId: string): Promise<CachedUserProfile | null> => {
  if (!userId) return null;

  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) return cached;

  const pending = pendingFetches.get(userId);
  if (pending) return pending;

  const fetchPromise = (async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const profile: CachedUserProfile = {
          name: data.name || "Unknown",
          photo: data.photos?.[0],
          major: data.major,
          age: data.age,
          side: data.side,
          fetchedAt: Date.now(),
        };
        profileCache.set(userId, profile);
        return profile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching profile:", userId, error);
      return null;
    } finally {
      pendingFetches.delete(userId);
    }
  })();

  pendingFetches.set(userId, fetchPromise);
  return fetchPromise;
};

export const getCachedProfile = (userId: string): CachedUserProfile | null => {
  if (!userId) return null;
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) return cached;
  return null;
};

export const setCachedProfile = (userId: string, profile: Omit<CachedUserProfile, "fetchedAt">): void => {
  if (!userId) return;
  profileCache.set(userId, { ...profile, fetchedAt: Date.now() });
};

export const clearCachedProfile = (userId: string): void => { profileCache.delete(userId); };
export const clearAllCachedProfiles = (): void => { profileCache.clear(); pendingFetches.clear(); };
