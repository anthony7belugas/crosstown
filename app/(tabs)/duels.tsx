// app/(tabs)/duels.tsx
// Duels — vertical list of rivals from the opposite school.
// Tap row body → opens RivalProfileSheet. Tap row Challenge → fires challenge.
// No swipe gestures anywhere on this screen.
import { FontAwesome } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlockModal } from "../../components/BlockModal";
import { MoreOptionsMenu } from "../../components/MoreOptionsMenu";
import { ReportModal } from "../../components/ReportModal";
import {
  RivalProfileSheet,
  RivalProfileSheetHandle,
} from "../../components/RivalProfileSheet";
import { RivalCard, RivalRow } from "../../components/RivalRow";
import { ScoreboardBanner } from "../../components/ScoreboardBanner";
import { auth, db } from "../../firebaseConfig";
import { blockUser, reportUser, ReportReason } from "../../utils/blockUtils";
import { DAILY_CHALLENGE_LIMIT } from "../../utils/challengeLimits";
import { accentBg, accentColor } from "../../utils/colors";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function getTodayString(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * ISO week key, e.g. "2026-W17". Mirrors the helper in functions/index.js
 * so client-side reads of weekly counters use the same week boundary as
 * the Cloud Function that writes them.
 */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

type LoadMode = "initial" | "refresh";

export default function DuelsScreen() {
  const insets = useSafeAreaInsets();

  const [profiles, setProfiles] = useState<RivalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challengesRemaining, setChallengesRemaining] = useState(
    DAILY_CHALLENGE_LIMIT
  );
  const [currentUserData, setCurrentUserData] = useState<any>(null);

  // Sheet state
  const [viewingProfile, setViewingProfile] = useState<RivalCard | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetRef = useRef<RivalProfileSheetHandle>(null);

  // Block / report state
  const [showOptions, setShowOptions] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // Tracks Firestore writes in flight so rapid taps don't exceed daily limit
  const inFlightChallengesRef = useRef(0);

  // Unmount guard for async handlers
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const userSide = currentUserData?.side || "usc";
  const styles = useMemo(() => createStyles(userSide), [userSide]);

  useEffect(() => {
    loadData("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (mode: LoadMode = "initial") => {
    if (!auth.currentUser) {
      if (isMountedRef.current && mode === "initial") setLoading(false);
      return;
    }
    if (mode === "initial" && isMountedRef.current) setLoading(true);

    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (!userDoc.exists()) return;
      const userData = userDoc.data();
      if (isMountedRef.current) setCurrentUserData(userData);

      const today = getTodayString();
      const savedCount =
        userData.dailyChallengeDate === today
          ? userData.dailyChallengeCount || 0
          : 0;
      if (isMountedRef.current) {
        setChallengesRemaining(Math.max(0, DAILY_CHALLENGE_LIMIT - savedCount));
      }

      // Build exclusion set
      const excludedIds = new Set<string>();
      excludedIds.add(auth.currentUser.uid);

      const [challengesSent, challengesReceived, showdownsSnap, passesSnap] =
        await Promise.all([
          getDocs(
            query(
              collection(db, "challenges"),
              where("fromUserId", "==", auth.currentUser.uid)
            )
          ),
          getDocs(
            query(
              collection(db, "challenges"),
              where("toUserId", "==", auth.currentUser.uid)
            )
          ),
          getDocs(
            query(
              collection(db, "showdowns"),
              where("users", "array-contains", auth.currentUser.uid)
            )
          ),
          getDocs(
            query(
              collection(db, "passes"),
              where("fromUserId", "==", auth.currentUser.uid),
              where("date", "==", today)
            )
          ),
        ]);

      challengesSent.docs.forEach((d) => excludedIds.add(d.data().toUserId));
      challengesReceived.docs.forEach((d) =>
        excludedIds.add(d.data().fromUserId)
      );
      showdownsSnap.docs.forEach((d) => {
        (d.data().users || []).forEach((uid: string) => excludedIds.add(uid));
      });
      passesSnap.docs.forEach((d) => excludedIds.add(d.data().toUserId));

      (userData.blockedUsers || []).forEach((id: string) =>
        excludedIds.add(id)
      );
      (userData.blockedByUsers || []).forEach((id: string) =>
        excludedIds.add(id)
      );

      const rivalSide = userData.side === "usc" ? "ucla" : "usc";
      const rivalsSnap = await getDocs(
        query(
          collection(db, "users"),
          where("side", "==", rivalSide),
          where("profileCompleted", "==", true)
        )
      );

      const eligible: RivalCard[] = [];
      const currentWeek = getISOWeekKey(new Date());
      rivalsSnap.docs.forEach((d) => {
        if (excludedIds.has(d.id)) return;
        const data = d.data();
        const photos = (data.photos || []).slice(0, 2);
        if (photos.length === 0) return; // skip profiles with no photos
        eligible.push({
          uid: d.id,
          name: data.name || "Unknown",
          side: data.side,
          photos,
          major: data.major || "",
          gradYear: data.gradYear || "",
          // Player stats — surfaced on RivalProfileSheet.
          // weeklyWins is only fresh if the stored week key matches the
          // current week; otherwise treat as zero (the user hasn't won yet
          // this week, regardless of what last week's number was).
          wins: data.wins || 0,
          gamesPlayed: data.gamesPlayed || 0,
          weeklyWins: data.weeklyWinsWeek === currentWeek ? (data.weeklyWins || 0) : 0,
          weeklyWinsWeek: data.weeklyWinsWeek,
          currentRank: data.currentRank ?? null,
        });
      });

      // Fisher-Yates shuffle
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }

      if (isMountedRef.current) setProfiles(eligible);
    } catch (error) {
      console.error("[Duels] loadData error:", error);
    } finally {
      if (isMountedRef.current && mode === "initial") setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData("refresh");
    if (isMountedRef.current) setRefreshing(false);
  };

  const removeFromList = (uid: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setProfiles((prev) => prev.filter((p) => p.uid !== uid));
  };

  // ─── Challenge flow ─────────────────────────────────────────
  // Order: (1) optimistically reserve a slot, (2) write challenge,
  // (3) increment the daily count. If the challenge write fails, we release
  // the reserved slot and never touch the daily count. This avoids losing
  // slots to failed writes.

  const handleChallenge = async (profile: RivalCard) => {
    if (!auth.currentUser) return;

    // Optimistic reservation — blocks rapid-fire taps from exceeding limit
    if (challengesRemaining - inFlightChallengesRef.current <= 0) return;
    inFlightChallengesRef.current += 1;
    if (isMountedRef.current) {
      setChallengesRemaining((prev) => Math.max(0, prev - 1));
    }

    try {
      // Write the challenge doc first — if this fails, release the reservation
      await addDoc(collection(db, "challenges"), {
        fromUserId: auth.currentUser.uid,
        toUserId: profile.uid,
        fromSide: currentUserData?.side || "usc",
        toSide: profile.side,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Then increment the daily count using Firestore's atomic increment.
      // If today is a new day, we reset to 1 in a separate branch.
      const userRef = doc(db, "users", auth.currentUser.uid);
      const today = getTodayString();
      if (currentUserData?.dailyChallengeDate === today) {
        await updateDoc(userRef, { dailyChallengeCount: increment(1) });
      } else {
        await updateDoc(userRef, {
          dailyChallengeCount: 1,
          dailyChallengeDate: today,
        });
        // Update our local mirror so the next challenge uses increment()
        if (isMountedRef.current) {
          setCurrentUserData((prev: any) => ({
            ...(prev || {}),
            dailyChallengeDate: today,
            dailyChallengeCount: 1,
          }));
        }
      }

      // Successful write — the optimistic state is now confirmed.
      removeFromList(profile.uid);
    } catch (error) {
      console.error("[Duels] challenge failed:", error);
      // Roll back the reservation
      if (isMountedRef.current) {
        setChallengesRemaining((prev) =>
          Math.min(DAILY_CHALLENGE_LIMIT, prev + 1)
        );
      }
      // NOTE: the row-level "✓ Sent" animation has already played. We leave
      // the row out of the list rather than trying to restore it; the user
      // can pull-to-refresh to see it again. Silent failure is preferable to
      // a confusing mid-animation restore.
    } finally {
      inFlightChallengesRef.current = Math.max(
        0,
        inFlightChallengesRef.current - 1
      );
    }
  };

  const handlePass = async (profile: RivalCard) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, "passes"), {
        fromUserId: auth.currentUser.uid,
        toUserId: profile.uid,
        date: getTodayString(),
        createdAt: serverTimestamp(),
      });
      removeFromList(profile.uid);
    } catch (error) {
      console.error("[Duels] pass failed:", error);
    }
  };

  // ─── Sheet handlers ─────────────────────────────────────────

  const openSheet = (profile: RivalCard) => {
    setViewingProfile(profile);
    setSheetVisible(true);
  };

  const onSheetClose = () => {
    setSheetVisible(false);
    // Delay clearing profile so sheet has data during slide-out
    setTimeout(() => {
      if (isMountedRef.current) setViewingProfile(null);
    }, 300);
  };

  const onSheetChallenge = () => {
    if (!viewingProfile) return;
    const target = viewingProfile;
    // Sheet has already animated itself closed before calling this
    setSheetVisible(false);
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setViewingProfile(null);
      handleChallenge(target);
    }, 50);
  };

  const onSheetSkip = () => {
    if (!viewingProfile) return;
    const target = viewingProfile;
    setSheetVisible(false);
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setViewingProfile(null);
      handlePass(target);
    }, 50);
  };

  // ─── Block / report ─────────────────────────────────────────
  // Only reachable from the sheet's "..." button.

  const onSheetMoreOptions = () => {
    setShowOptions(true);
  };

  const closeSheetAnimated = (after: () => void) => {
    if (sheetRef.current) {
      sheetRef.current.animateClose(() => {
        setSheetVisible(false);
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setViewingProfile(null);
          after();
        }, 50);
      });
    } else {
      setSheetVisible(false);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setViewingProfile(null);
        after();
      }, 50);
    }
  };

  const handleBlock = async () => {
    if (!viewingProfile) return;
    const target = viewingProfile;
    setBlockLoading(true);
    try {
      await blockUser(target.uid);
      if (!isMountedRef.current) return;
      setShowBlockModal(false);
      closeSheetAnimated(() => removeFromList(target.uid));
    } catch (e) {
      console.error("[Duels] block failed:", e);
    } finally {
      if (isMountedRef.current) setBlockLoading(false);
    }
  };

  const handleReport = async (reason: ReportReason, desc?: string) => {
    if (!viewingProfile) return;
    setReportLoading(true);
    try {
      await reportUser({
        reportedId: viewingProfile.uid,
        reason,
        description: desc,
      });
      if (isMountedRef.current) setShowReportModal(false);
    } catch (e) {
      console.error("[Duels] report failed:", e);
    } finally {
      if (isMountedRef.current) setReportLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────
  // The sheet and block/report modals are rendered at the end of the tree
  // UNCONDITIONALLY so they don't unmount if the screen flips to the
  // loading or daily-limit branch mid-flow.

  const Header = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Duels</Text>
        <Text style={styles.headerCounter}>
          {challengesRemaining} left today
        </Text>
      </View>
      <Pressable style={styles.bellButton}>
        <FontAwesome name="bell" size={18} color="rgba(255,255,255,0.5)" />
      </Pressable>
    </View>
  );

  // Always-rendered overlay layer (sheet + modals) so mid-flow state survives
  const Overlays = (
    <>
      <RivalProfileSheet
        ref={sheetRef}
        visible={sheetVisible}
        profile={viewingProfile}
        userSide={userSide}
        challengeDisabled={challengesRemaining <= 0}
        onChallenge={onSheetChallenge}
        onSkip={onSheetSkip}
        onClose={onSheetClose}
        onOpenMoreOptions={onSheetMoreOptions}
      />
      <MoreOptionsMenu
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        onBlock={() => setShowBlockModal(true)}
        onReport={() => setShowReportModal(true)}
      />
      <BlockModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onBlock={handleBlock}
        userName={viewingProfile?.name || ""}
        loading={blockLoading}
      />
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        userName={viewingProfile?.name || ""}
        loading={reportLoading}
      />
    </>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {Header}
        <ScoreboardBanner />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(userSide)} />
        </View>
        {Overlays}
      </View>
    );
  }

  if (challengesRemaining <= 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {Header}
        <ScoreboardBanner />
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <FontAwesome
              name="clock-o"
              size={40}
              color={accentColor(userSide)}
            />
          </View>
          <Text style={styles.emptyTitle}>Daily Limit Reached</Text>
          <Text style={styles.emptySubtitle}>
            You've used all your challenges for today.{"\n"}Come back tomorrow!
          </Text>
        </View>
        {Overlays}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {Header}
      <ScoreboardBanner />

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <RivalRow
            profile={item}
            userSide={userSide}
            onChallenge={handleChallenge}
            onOpen={openSheet}
          />
        )}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
        removeClippedSubviews
        windowSize={5}
        initialNumToRender={8}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor(userSide)}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <View style={styles.emptyIcon}>
              <FontAwesome
                name="search"
                size={40}
                color={accentColor(userSide)}
              />
            </View>
            <Text style={styles.emptyTitle}>No More Rivals</Text>
            <Text style={styles.emptySubtitle}>
              You've seen everyone for now.{"\n"}Check back later!
            </Text>
            <Pressable
              style={styles.refreshBtn}
              onPress={() => loadData("refresh")}
            >
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>
        }
      />

      {Overlays}
    </View>
  );
}

const createStyles = (_s: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F172A" },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerLeft: { flexDirection: "row", alignItems: "baseline", gap: 10 },
    headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
    headerCounter: {
      fontSize: 15,
      fontWeight: "600",
      color: accentColor(_s),
    },
    bellButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },

    emptyList: {
      paddingVertical: 60,
      alignItems: "center",
      paddingHorizontal: 40,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: accentBg(_s, 0.1),
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: "#fff",
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 15,
      color: "rgba(255,255,255,0.4)",
      textAlign: "center",
      lineHeight: 22,
    },
    refreshBtn: {
      marginTop: 24,
      paddingVertical: 12,
      paddingHorizontal: 28,
      backgroundColor: accentBg(_s, 0.1),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: accentBg(_s, 0.2),
    },
    refreshText: {
      fontSize: 16,
      fontWeight: "600",
      color: accentColor(_s),
    },
  });
