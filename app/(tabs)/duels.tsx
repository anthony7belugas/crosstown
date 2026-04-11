// app/(tabs)/duels.tsx
// Duels — card stack with ⚔ Challenge button on card, swipe left to pass
// Matches the spec: "the Challenge button is full-width, bold, colored in
// the current user's school color, and reads '⚔ Challenge'."
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc, collection, doc, getDoc, getDocs, query,
  serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Dimensions, Image,
  PanResponder, Pressable, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoreOptionsMenu } from "../../components/MoreOptionsMenu";
import { BlockModal } from "../../components/BlockModal";
import { ReportModal } from "../../components/ReportModal";
import { auth, db } from "../../firebaseConfig";
import { blockUser, reportUser, ReportReason } from "../../utils/blockUtils";
import { DAILY_SWIPE_LIMIT } from "../../utils/swipeLimits";
import { accentColor, accentBg, schoolColor } from "../../utils/colors";

const { width, height } = Dimensions.get("window");
const SWIPE_THRESHOLD = width * 0.25;

interface ProfileCard {
  uid: string;
  name: string;
  age: number;
  side: "usc" | "ucla";
  photos: string[];
  major: string;
  gradYear: string;
  bio: string;
}

function getTodayString(): string {
  return new Date().toLocaleDateString("en-CA");
}

export default function DuelsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [challengesRemaining, setChallengesRemaining] = useState(DAILY_SWIPE_LIMIT);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const [currentUserData, setCurrentUserData] = useState<any>(null);

  const userSide = currentUserData?.side || "usc";
  const styles = createStyles(userSide);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (!userDoc.exists()) { setLoading(false); return; }
      const userData = userDoc.data();
      setCurrentUserData(userData);

      const today = getTodayString();
      let swipeCount = 0;
      if (userData.dailySwipeDate === today) swipeCount = userData.dailySwipeCount || 0;
      setChallengesRemaining(Math.max(0, DAILY_SWIPE_LIMIT - swipeCount));

      // Build exclusion set: already challenged, challenged by, matched, passed today
      const excludedIds = new Set<string>();

      const challengesSent = await getDocs(
        query(collection(db, "challenges"), where("fromUserId", "==", auth.currentUser.uid))
      );
      challengesSent.docs.forEach((d) => excludedIds.add(d.data().toUserId));

      const challengesReceived = await getDocs(
        query(collection(db, "challenges"), where("toUserId", "==", auth.currentUser.uid))
      );
      challengesReceived.docs.forEach((d) => excludedIds.add(d.data().fromUserId));

      const matchesSnap = await getDocs(
        query(collection(db, "matches"), where("users", "array-contains", auth.currentUser.uid))
      );
      matchesSnap.docs.forEach((d) => {
        d.data().users.forEach((uid: string) => excludedIds.add(uid));
      });

      const passesSnap = await getDocs(
        query(collection(db, "passes"), where("fromUserId", "==", auth.currentUser.uid), where("date", "==", today))
      );
      passesSnap.docs.forEach((d) => excludedIds.add(d.data().toUserId));

      (userData.blockedUsers || []).forEach((id: string) => excludedIds.add(id));
      (userData.blockedByUsers || []).forEach((id: string) => excludedIds.add(id));
      excludedIds.add(auth.currentUser.uid);

      // Fetch rival profiles
      const rivalSide = userData.side === "usc" ? "ucla" : "usc";
      let genderFilter: string[] = [];
      if (userData.showMe === "men") genderFilter = ["man"];
      else if (userData.showMe === "women") genderFilter = ["woman"];
      else genderFilter = ["man", "woman", "nonbinary"];

      const rivalsSnap = await getDocs(
        query(collection(db, "users"), where("side", "==", rivalSide), where("profileCompleted", "==", true))
      );
      const eligible: ProfileCard[] = [];
      rivalsSnap.docs.forEach((d) => {
        if (excludedIds.has(d.id)) return;
        const data = d.data();
        if (!genderFilter.includes(data.gender)) return;
        if (data.showMe !== "everyone") {
          if (data.showMe === "men" && userData.gender !== "man") return;
          if (data.showMe === "women" && userData.gender !== "woman") return;
        }
        eligible.push({
          uid: d.id, name: data.name || "Unknown", age: data.age || 0,
          side: data.side, photos: data.photos || [], major: data.major || "",
          gradYear: data.gradYear || "", bio: data.bio || "",
        });
      });

      // Fisher-Yates shuffle
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
      setProfiles(eligible);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Error loading profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const incrementSwipeCount = async () => {
    if (!auth.currentUser) return;
    const today = getTodayString();
    const userRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userRef);
    const d = snap.data() || {};
    let newCount = d.dailySwipeDate === today ? (d.dailySwipeCount || 0) + 1 : 1;
    await updateDoc(userRef, { dailySwipeCount: newCount, dailySwipeDate: today });
    setChallengesRemaining(Math.max(0, DAILY_SWIPE_LIMIT - newCount));
  };

  const handleChallenge = async (profile: ProfileCard) => {
    if (!auth.currentUser || challengesRemaining <= 0) return;
    try {
      await incrementSwipeCount();
      await addDoc(collection(db, "challenges"), {
        fromUserId: auth.currentUser.uid,
        toUserId: profile.uid,
        fromSide: currentUserData?.side || "usc",
        toSide: profile.side,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setCurrentPhotoIndex(0);
      setCurrentIndex((p) => p + 1);
    } catch (error) {
      console.error("Error sending challenge:", error);
    }
  };

  const handlePass = async (profile: ProfileCard) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, "passes"), {
        fromUserId: auth.currentUser.uid,
        toUserId: profile.uid,
        date: getTodayString(),
        createdAt: serverTimestamp(),
      });
      setCurrentPhotoIndex(0);
      setCurrentIndex((p) => p + 1);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Swipe: right = challenge, left = pass (silent)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: (_, g) => {
        position.setValue({ x: g.dx, y: g.dy * 0.3 });
      },
      onPanResponderRelease: (_, g) => {
        const current = profiles[currentIndex];
        if (!current) return;
        if (g.dx > SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: width + 100, y: g.dy }, duration: 250, useNativeDriver: true,
          }).start(() => { handleChallenge(current); position.setValue({ x: 0, y: 0 }); });
        } else if (g.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -width - 100, y: g.dy }, duration: 250, useNativeDriver: true,
          }).start(() => { handlePass(current); position.setValue({ x: 0, y: 0 }); });
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width], outputRange: ["-12deg", "0deg", "12deg"],
  });
  const challengeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: "clamp",
  });
  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: "clamp",
  });

  // Tap the Challenge button on the card
  const handleChallengeButtonTap = () => {
    const c = profiles[currentIndex];
    if (!c) return;
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 }, duration: 300, useNativeDriver: true,
    }).start(() => { handleChallenge(c); position.setValue({ x: 0, y: 0 }); });
  };

  const handleBlock = async () => {
    const c = profiles[currentIndex];
    if (!c) return;
    setBlockLoading(true);
    try { await blockUser(c.uid); setShowBlockModal(false); setCurrentIndex((p) => p + 1); }
    catch (e) { console.error(e); }
    finally { setBlockLoading(false); }
  };

  const handleReport = async (reason: ReportReason, desc?: string) => {
    const c = profiles[currentIndex];
    if (!c) return;
    setReportLoading(true);
    try { await reportUser({ reportedId: c.uid, reason, description: desc }); setShowReportModal(false); }
    catch (e) { console.error(e); }
    finally { setReportLoading(false); }
  };

  const handlePhotoTap = (tapSide: "left" | "right") => {
    const c = profiles[currentIndex];
    if (!c) return;
    if (tapSide === "right" && currentPhotoIndex < c.photos.length - 1) setCurrentPhotoIndex(currentPhotoIndex + 1);
    else if (tapSide === "left" && currentPhotoIndex > 0) setCurrentPhotoIndex(currentPhotoIndex - 1);
  };

  const currentProfile = profiles[currentIndex];

  // ─── Empty states ──────────────────────────────────────────
  if (loading)
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Duels</Text>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(userSide)} />
        </View>
      </View>
    );

  if (challengesRemaining <= 0)
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Duels</Text>
          </View>
        </View>
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="clock-o" size={40} color={accentColor(userSide)} />
          </View>
          <Text style={styles.emptyTitle}>Daily Limit Reached</Text>
          <Text style={styles.emptySubtitle}>
            You've used all your challenges for today.{"\n"}Come back tomorrow!
          </Text>
        </View>
      </View>
    );

  if (!currentProfile)
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Duels</Text>
          </View>
        </View>
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="search" size={40} color={accentColor(userSide)} />
          </View>
          <Text style={styles.emptyTitle}>No More Rivals</Text>
          <Text style={styles.emptySubtitle}>
            You've seen everyone for now.{"\n"}Check back later!
          </Text>
          <Pressable style={styles.refreshBtn} onPress={loadData}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>
      </View>
    );

  // ─── Main render ───────────────────────────────────────────
  const rivalSideColor = schoolColor(currentProfile.side);
  const rivalSideName = currentProfile.side === "usc" ? "USC" : "UCLA";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header: "Duels  30 left today"  🔔 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Duels</Text>
          <Text style={styles.headerCounter}>{challengesRemaining} left today</Text>
        </View>
        <Pressable style={styles.bellButton}>
          <FontAwesome name="bell" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      {/* Card Stack */}
      <View style={styles.cardContainer}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.card, {
            transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
          }]}
        >
          {/* Photo */}
          <Image source={{ uri: currentProfile.photos[currentPhotoIndex] || "" }} style={styles.cardImage} />
          <Pressable style={styles.photoTapLeft} onPress={() => handlePhotoTap("left")} />
          <Pressable style={styles.photoTapRight} onPress={() => handlePhotoTap("right")} />

          {/* Photo indicators */}
          {currentProfile.photos.length > 1 && (
            <View style={styles.photoIndicators}>
              {currentProfile.photos.map((_, i) => (
                <View key={i} style={[styles.indicator, i === currentPhotoIndex && styles.indicatorActive]} />
              ))}
            </View>
          )}

          {/* Swipe stamps */}
          <Animated.View style={[styles.stampContainer, styles.challengeStamp, { opacity: challengeOpacity }]}>
            <Text style={[styles.stampText, { color: accentColor(userSide) }]}>⚔</Text>
          </Animated.View>
          <Animated.View style={[styles.stampContainer, styles.passStamp, { opacity: passOpacity }]}>
            <Text style={[styles.stampText, { color: "#EF4444" }]}>PASS</Text>
          </Animated.View>

          {/* Info overlay on photo */}
          <View style={styles.cardOverlay}>
            <View style={styles.cardInfoRow}>
              <Text style={styles.cardName}>{currentProfile.name}.</Text>
              <View style={[styles.sideBadge, { backgroundColor: rivalSideColor }]}>
                <Text style={styles.sideBadgeText}>{rivalSideName}</Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {currentProfile.major} · Class of {currentProfile.gradYear}
            </Text>
          </View>

          {/* More options */}
          <Pressable style={styles.moreButton} onPress={() => setShowOptions(true)}>
            <FontAwesome name="ellipsis-h" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>

          {/* Bio + Challenge button (below photo area, inside card) */}
          <View style={styles.cardBottom}>
            {currentProfile.bio ? (
              <Text style={styles.cardBio} numberOfLines={2}>
                "{currentProfile.bio}"
              </Text>
            ) : null}

            {/* ⚔ Challenge — the primary action, full-width on card */}
            <Pressable style={styles.challengeButton} onPress={handleChallengeButtonTap}>
              <Text style={styles.challengeButtonText}>⚔ Challenge</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>

      {/* Dot indicators below card */}
      {currentProfile.photos.length > 1 && (
        <View style={styles.dotsBelow}>
          {currentProfile.photos.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dotBelow,
                { backgroundColor: i === currentPhotoIndex ? accentColor(userSide) : "rgba(255,255,255,0.25)" },
              ]}
            />
          ))}
        </View>
      )}

      {/* Modals */}
      <MoreOptionsMenu visible={showOptions} onClose={() => setShowOptions(false)} onBlock={() => setShowBlockModal(true)} onReport={() => setShowReportModal(true)} />
      <BlockModal visible={showBlockModal} onClose={() => setShowBlockModal(false)} onBlock={handleBlock} userName={currentProfile?.name || ""} loading={blockLoading} />
      <ReportModal visible={showReportModal} onClose={() => setShowReportModal(false)} onSubmit={handleReport} userName={currentProfile?.name || ""} loading={reportLoading} />
    </View>
  );
}

const createStyles = (_s: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F172A" },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },

    // ── Header ───────────────────────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerLeft: { flexDirection: "row", alignItems: "baseline", gap: 10 },
    headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
    headerCounter: { fontSize: 15, fontWeight: "600", color: accentColor(_s) },
    bellButton: {
      width: 36, height: 36, borderRadius: 18,
      justifyContent: "center", alignItems: "center",
    },

    // ── Card ─────────────────────────────────────────────────
    cardContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    card: {
      width: width - 32,
      maxHeight: height * 0.68,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#1E293B",
    },
    cardImage: { width: "100%", height: "70%", backgroundColor: "#334155" },
    photoTapLeft: { position: "absolute", left: 0, top: 0, width: "40%", height: "60%" },
    photoTapRight: { position: "absolute", right: 0, top: 0, width: "40%", height: "60%" },

    // Photo indicators on top of photo
    photoIndicators: {
      position: "absolute", top: 12, left: 16, right: 16,
      flexDirection: "row", gap: 4,
    },
    indicator: { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2 },
    indicatorActive: { backgroundColor: "#fff" },

    // Swipe stamps
    stampContainer: { position: "absolute", top: 50, padding: 10, borderWidth: 3, borderRadius: 10 },
    challengeStamp: { left: 20, borderColor: accentColor(_s), transform: [{ rotate: "-15deg" }] },
    passStamp: { right: 20, borderColor: "#EF4444", transform: [{ rotate: "15deg" }] },
    stampText: { fontSize: 32, fontWeight: "900", letterSpacing: 3 },

    // Info overlay on bottom of photo
    cardOverlay: {
      position: "absolute", left: 0, right: 0,
      bottom: "30%", // sits above the cardBottom section
      padding: 20, paddingTop: 50,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    cardInfoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
    cardName: { fontSize: 26, fontWeight: "800", color: "#fff" },
    sideBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    sideBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 1 },
    cardMeta: { fontSize: 14, color: "rgba(255,255,255,0.7)" },

    // Bottom section of card (bio + challenge button)
    cardBottom: {
      paddingHorizontal: 20, paddingVertical: 16,
      justifyContent: "center",
    },
    cardBio: {
      fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 20,
      marginBottom: 14, fontStyle: "italic",
    },
    challengeButton: {
      backgroundColor: accentColor(_s),
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    challengeButtonText: {
      fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: 0.5,
    },

    // More options
    moreButton: {
      position: "absolute", top: 16, right: 16,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center", alignItems: "center",
    },

    // Dots below card
    dotsBelow: {
      flexDirection: "row", justifyContent: "center", gap: 6,
      paddingVertical: 12,
    },
    dotBelow: { width: 8, height: 8, borderRadius: 4 },

    // ── Empty states ─────────────────────────────────────────
    emptyIcon: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: accentBg(_s, 0.1),
      justifyContent: "center", alignItems: "center", marginBottom: 20,
    },
    emptyTitle: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 8 },
    emptySubtitle: { fontSize: 15, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 22 },
    refreshBtn: {
      marginTop: 24, paddingVertical: 12, paddingHorizontal: 28,
      backgroundColor: accentBg(_s, 0.1), borderRadius: 12,
      borderWidth: 1, borderColor: accentBg(_s, 0.2),
    },
    refreshText: { fontSize: 16, fontWeight: "600", color: accentColor(_s) },
  });
