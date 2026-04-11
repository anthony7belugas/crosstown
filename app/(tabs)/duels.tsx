// app/(tabs)/duels.tsx
// Duels — browse rival profiles and send challenges
// Swiping right or tapping Challenge sends a challenge to the rival.
// The rival sees it in the Rivals tab and can Accept or Decline.
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc, collection, doc, getDoc, getDocs, query,
  serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Dimensions, Image, Modal,
  PanResponder, Pressable, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoreOptionsMenu } from "../../components/MoreOptionsMenu";
import { BlockModal } from "../../components/BlockModal";
import { ReportModal } from "../../components/ReportModal";
import { auth, db } from "../../firebaseConfig";
import { blockUser, reportUser, ReportReason } from "../../utils/blockUtils";
import { DAILY_SWIPE_LIMIT } from "../../utils/swipeLimits";
import { accentColor, accentBg, schoolColor, rivalColor } from "../../utils/colors";

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

      // Get already-challenged and passed IDs
      const excludedIds = new Set<string>();

      // Challenges sent by me (any status — don't re-challenge)
      const challengesSent = await getDocs(
        query(collection(db, "challenges"), where("fromUserId", "==", auth.currentUser.uid))
      );
      challengesSent.docs.forEach((d) => excludedIds.add(d.data().toUserId));

      // Challenges sent TO me (they challenged me — I'll see them in Rivals)
      const challengesReceived = await getDocs(
        query(collection(db, "challenges"), where("toUserId", "==", auth.currentUser.uid))
      );
      challengesReceived.docs.forEach((d) => excludedIds.add(d.data().fromUserId));

      // Existing matches
      const matchesSnap = await getDocs(
        query(collection(db, "matches"), where("users", "array-contains", auth.currentUser.uid))
      );
      matchesSnap.docs.forEach((d) => {
        d.data().users.forEach((uid: string) => excludedIds.add(uid));
      });

      // Today's passes
      const passesSnap = await getDocs(
        query(collection(db, "passes"), where("fromUserId", "==", auth.currentUser.uid), where("date", "==", today))
      );
      passesSnap.docs.forEach((d) => excludedIds.add(d.data().toUserId));

      const blockedUsers: string[] = userData.blockedUsers || [];
      const blockedByUsers: string[] = userData.blockedByUsers || [];
      blockedUsers.forEach((id) => excludedIds.add(id));
      blockedByUsers.forEach((id) => excludedIds.add(id));
      excludedIds.add(auth.currentUser.uid);

      // Fetch rival profiles
      const rivalSide = userData.side === "usc" ? "ucla" : "usc";
      const showMe = userData.showMe;
      let genderFilter: string[] = [];
      if (showMe === "men") genderFilter = ["man"];
      else if (showMe === "women") genderFilter = ["woman"];
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
          uid: d.id,
          name: data.name || "Unknown",
          age: data.age || 0,
          side: data.side,
          photos: data.photos || [],
          major: data.major || "",
          gradYear: data.gradYear || "",
          bio: data.bio || "",
        });
      });

      // Shuffle
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

      // Create a challenge document
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
    if (!auth.currentUser || challengesRemaining <= 0) return;
    try {
      await incrementSwipeCount();
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
            toValue: { x: width + 100, y: g.dy },
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            handleChallenge(current);
            position.setValue({ x: 0, y: 0 });
          });
        } else if (g.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -width - 100, y: g.dy },
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            handlePass(current);
            position.setValue({ x: 0, y: 0 });
          });
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-12deg", "0deg", "12deg"],
  });
  const challengeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const handleButtonChallenge = () => {
    const c = profiles[currentIndex];
    if (!c) return;
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      handleChallenge(c);
      position.setValue({ x: 0, y: 0 });
    });
  };

  const handleButtonPass = () => {
    const c = profiles[currentIndex];
    if (!c) return;
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      handlePass(c);
      position.setValue({ x: 0, y: 0 });
    });
  };

  const handleBlock = async () => {
    const c = profiles[currentIndex];
    if (!c) return;
    setBlockLoading(true);
    try {
      await blockUser(c.uid);
      setShowBlockModal(false);
      setCurrentIndex((p) => p + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setBlockLoading(false);
    }
  };

  const handleReport = async (reason: ReportReason, desc?: string) => {
    const c = profiles[currentIndex];
    if (!c) return;
    setReportLoading(true);
    try {
      await reportUser({ reportedId: c.uid, reason, description: desc });
      setShowReportModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setReportLoading(false);
    }
  };

  const handlePhotoTap = (side: "left" | "right") => {
    const c = profiles[currentIndex];
    if (!c) return;
    if (side === "right" && currentPhotoIndex < c.photos.length - 1)
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    else if (side === "left" && currentPhotoIndex > 0)
      setCurrentPhotoIndex(currentPhotoIndex - 1);
  };

  const currentProfile = profiles[currentIndex];

  if (loading)
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Duels</Text>
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
          <Text style={styles.headerTitle}>Duels</Text>
        </View>
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="clock-o" size={40} color={accentColor(userSide)} />
          </View>
          <Text style={styles.emptyTitle}>Daily Limit Reached</Text>
          <Text style={styles.emptySubtitle}>
            You've used all 30 challenges today.{"\n"}Come back tomorrow!
          </Text>
        </View>
      </View>
    );

  if (!currentProfile)
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Duels</Text>
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

  const sideColor = schoolColor(currentProfile.side);
  const sideName = currentProfile.side === "usc" ? "USC" : "UCLA";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Duels</Text>
        <View style={styles.swipeCounter}>
          <FontAwesome name="bolt" size={12} color={accentColor(userSide)} />
          <Text style={styles.swipeCountText}>{challengesRemaining} left</Text>
        </View>
      </View>

      {/* Card Stack */}
      <View style={styles.cardContainer}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: currentProfile.photos[currentPhotoIndex] || "" }}
            style={styles.cardImage}
          />
          <Pressable style={styles.photoTapLeft} onPress={() => handlePhotoTap("left")} />
          <Pressable style={styles.photoTapRight} onPress={() => handlePhotoTap("right")} />
          {currentProfile.photos.length > 1 && (
            <View style={styles.photoIndicators}>
              {currentProfile.photos.map((_, i) => (
                <View
                  key={i}
                  style={[styles.indicator, i === currentPhotoIndex && styles.indicatorActive]}
                />
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

          {/* Card overlay info */}
          <View style={styles.cardOverlay}>
            <View style={[styles.sideBadge, { backgroundColor: sideColor }]}>
              <Text style={styles.sideBadgeText}>{sideName}</Text>
            </View>
            <Text style={styles.cardName}>
              {currentProfile.name}, {currentProfile.age}
            </Text>
            <Text style={styles.cardInfo}>
              {currentProfile.major} • {currentProfile.gradYear}
            </Text>
            {currentProfile.bio ? (
              <Text style={styles.cardBio} numberOfLines={2}>
                {currentProfile.bio}
              </Text>
            ) : null}
          </View>

          <Pressable style={styles.moreButton} onPress={() => setShowOptions(true)}>
            <FontAwesome name="ellipsis-h" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </Animated.View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.passBtn]} onPress={handleButtonPass}>
          <FontAwesome name="times" size={28} color="#EF4444" />
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.challengeBtn]} onPress={handleButtonChallenge}>
          <FontAwesome name="bolt" size={28} color={accentColor(userSide)} />
        </Pressable>
      </View>

      {/* Modals */}
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
        userName={currentProfile?.name || ""}
        loading={blockLoading}
      />
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        userName={currentProfile?.name || ""}
        loading={reportLoading}
      />
    </View>
  );
}

const createStyles = (_s: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F172A" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
    swipeCounter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: accentBg(_s, 0.1),
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    swipeCountText: { fontSize: 14, fontWeight: "700", color: accentColor(_s) },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: accentBg(_s, 0.1),
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    emptyTitle: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 8 },
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
    refreshText: { fontSize: 16, fontWeight: "600", color: accentColor(_s) },
    cardContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    card: {
      width: width - 24,
      height: height * 0.58,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#1E293B",
    },
    cardImage: { width: "100%", height: "100%", backgroundColor: "#334155" },
    photoTapLeft: { position: "absolute", left: 0, top: 0, bottom: 80, width: "40%" },
    photoTapRight: { position: "absolute", right: 0, top: 0, bottom: 80, width: "40%" },
    photoIndicators: {
      position: "absolute",
      top: 12,
      left: 16,
      right: 16,
      flexDirection: "row",
      gap: 4,
    },
    indicator: { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2 },
    indicatorActive: { backgroundColor: "#fff" },
    stampContainer: { position: "absolute", top: 40, padding: 10, borderWidth: 3, borderRadius: 10 },
    challengeStamp: {
      left: 20,
      borderColor: accentColor(_s),
      transform: [{ rotate: "-15deg" }],
    },
    passStamp: {
      right: 20,
      borderColor: "#EF4444",
      transform: [{ rotate: "15deg" }],
    },
    stampText: { fontSize: 32, fontWeight: "900", letterSpacing: 3 },
    cardOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      paddingTop: 60,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    sideBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 8,
    },
    sideBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 1 },
    cardName: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 2 },
    cardInfo: { fontSize: 15, color: "rgba(255,255,255,0.7)", marginBottom: 4 },
    cardBio: { fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 20 },
    moreButton: {
      position: "absolute",
      top: 16,
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    actions: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 32,
      paddingVertical: 16,
      paddingBottom: 8,
    },
    actionBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
    passBtn: {
      backgroundColor: "rgba(239,68,68,0.12)",
      borderWidth: 2,
      borderColor: "rgba(239,68,68,0.3)",
    },
    challengeBtn: {
      backgroundColor: accentBg(_s, 0.12),
      borderWidth: 2,
      borderColor: accentBg(_s, 0.3),
    },
  });
