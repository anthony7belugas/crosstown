// app/(tabs)/swipe.tsx
// Core swipe screen — fetches rival profiles, handles likes/passes, detects matches
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc, collection, doc, getDoc, getDocs, query,
  serverTimestamp, setDoc, updateDoc, where,
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

const { width, height } = Dimensions.get("window");
const SWIPE_THRESHOLD = width * 0.25;
const GOLD = "#FFD100";
const CARDINAL = "#9B1B30";
const BRUIN_BLUE = "#2774AE";

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

export default function SwipeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipesRemaining, setSwipesRemaining] = useState(DAILY_SWIPE_LIMIT);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<ProfileCard | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const matchScale = useRef(new Animated.Value(0)).current;
  const [currentUserData, setCurrentUserData] = useState<any>(null);

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
      setSwipesRemaining(Math.max(0, DAILY_SWIPE_LIMIT - swipeCount));

      // Get already-swiped IDs
      const swipedIds = new Set<string>();
      const likesSnap = await getDocs(query(collection(db, "likes"), where("fromUserId", "==", auth.currentUser.uid)));
      likesSnap.docs.forEach((d) => swipedIds.add(d.data().toUserId));
      const passesSnap = await getDocs(query(collection(db, "passes"), where("fromUserId", "==", auth.currentUser.uid), where("date", "==", today)));
      passesSnap.docs.forEach((d) => swipedIds.add(d.data().toUserId));

      const blockedUsers: string[] = userData.blockedUsers || [];
      const blockedByUsers: string[] = userData.blockedByUsers || [];
      const allExcluded = new Set([...swipedIds, ...blockedUsers, ...blockedByUsers, auth.currentUser.uid]);

      const rivalSide = userData.side === "usc" ? "ucla" : "usc";
      const showMe = userData.showMe;
      let genderFilter: string[] = [];
      if (showMe === "men") genderFilter = ["man"];
      else if (showMe === "women") genderFilter = ["woman"];
      else genderFilter = ["man", "woman", "nonbinary"];

      const rivalsSnap = await getDocs(query(collection(db, "users"), where("side", "==", rivalSide), where("profileCompleted", "==", true)));
      const eligible: ProfileCard[] = [];
      rivalsSnap.docs.forEach((d) => {
        if (allExcluded.has(d.id)) return;
        const data = d.data();
        if (!genderFilter.includes(data.gender)) return;
        if (data.showMe !== "everyone") {
          if (data.showMe === "men" && userData.gender !== "man") return;
          if (data.showMe === "women" && userData.gender !== "woman") return;
        }
        eligible.push({ uid: d.id, name: data.name || "Unknown", age: data.age || 0, side: data.side, photos: data.photos || [], major: data.major || "", gradYear: data.gradYear || "", bio: data.bio || "" });
      });

      // Shuffle
      for (let i = eligible.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [eligible[i], eligible[j]] = [eligible[j], eligible[i]]; }
      setProfiles(eligible);
      setCurrentIndex(0);
    } catch (error) { console.error("Error loading profiles:", error); }
    finally { setLoading(false); }
  };

  const incrementSwipeCount = async () => {
    if (!auth.currentUser) return;
    const today = getTodayString();
    const userRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userRef);
    const d = snap.data() || {};
    let newCount = d.dailySwipeDate === today ? (d.dailySwipeCount || 0) + 1 : 1;
    await updateDoc(userRef, { dailySwipeCount: newCount, dailySwipeDate: today });
    setSwipesRemaining(Math.max(0, DAILY_SWIPE_LIMIT - newCount));
  };

  const handleLike = async (profile: ProfileCard) => {
    if (!auth.currentUser || swipesRemaining <= 0) return;
    try {
      await incrementSwipeCount();
      await addDoc(collection(db, "likes"), { fromUserId: auth.currentUser.uid, toUserId: profile.uid, fromSide: currentUserData?.side, createdAt: serverTimestamp() });
      const mutualSnap = await getDocs(query(collection(db, "likes"), where("fromUserId", "==", profile.uid), where("toUserId", "==", auth.currentUser.uid)));
      if (!mutualSnap.empty) {
        const users = [auth.currentUser.uid, profile.uid].sort();
        await setDoc(doc(db, "matches", users.join("_")), { users, createdAt: serverTimestamp(), lastMessage: null, lastMessageAt: null });
        setMatchedProfile(profile);
        setShowMatch(true);
        matchScale.setValue(0);
        Animated.spring(matchScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }).start();
      }
      setCurrentPhotoIndex(0);
      setCurrentIndex((p) => p + 1);
    } catch (error) { console.error("Error:", error); }
  };

  const handlePass = async (profile: ProfileCard) => {
    if (!auth.currentUser || swipesRemaining <= 0) return;
    try {
      await incrementSwipeCount();
      await addDoc(collection(db, "passes"), { fromUserId: auth.currentUser.uid, toUserId: profile.uid, date: getTodayString(), createdAt: serverTimestamp() });
      setCurrentPhotoIndex(0);
      setCurrentIndex((p) => p + 1);
    } catch (error) { console.error("Error:", error); }
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
    onPanResponderMove: (_, g) => { position.setValue({ x: g.dx, y: g.dy * 0.3 }); },
    onPanResponderRelease: (_, g) => {
      const current = profiles[currentIndex];
      if (!current) return;
      if (g.dx > SWIPE_THRESHOLD) {
        Animated.timing(position, { toValue: { x: width + 100, y: g.dy }, duration: 250, useNativeDriver: true }).start(() => { handleLike(current); position.setValue({ x: 0, y: 0 }); });
      } else if (g.dx < -SWIPE_THRESHOLD) {
        Animated.timing(position, { toValue: { x: -width - 100, y: g.dy }, duration: 250, useNativeDriver: true }).start(() => { handlePass(current); position.setValue({ x: 0, y: 0 }); });
      } else {
        Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: true }).start();
      }
    },
  })).current;

  const rotate = position.x.interpolate({ inputRange: [-width, 0, width], outputRange: ["-12deg", "0deg", "12deg"] });
  const likeOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: "clamp" });
  const passOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: "clamp" });

  const handleButtonLike = () => { const c = profiles[currentIndex]; if (!c) return; Animated.timing(position, { toValue: { x: width + 100, y: 0 }, duration: 300, useNativeDriver: true }).start(() => { handleLike(c); position.setValue({ x: 0, y: 0 }); }); };
  const handleButtonPass = () => { const c = profiles[currentIndex]; if (!c) return; Animated.timing(position, { toValue: { x: -width - 100, y: 0 }, duration: 300, useNativeDriver: true }).start(() => { handlePass(c); position.setValue({ x: 0, y: 0 }); }); };

  const handleBlock = async () => { const c = profiles[currentIndex]; if (!c) return; setBlockLoading(true); try { await blockUser(c.uid); setShowBlockModal(false); setCurrentIndex((p) => p + 1); } catch (e) { console.error(e); } finally { setBlockLoading(false); } };
  const handleReport = async (reason: ReportReason, desc?: string) => { const c = profiles[currentIndex]; if (!c) return; setReportLoading(true); try { await reportUser({ reportedId: c.uid, reason, description: desc }); setShowReportModal(false); } catch (e) { console.error(e); } finally { setReportLoading(false); } };

  const handlePhotoTap = (side: "left" | "right") => { const c = profiles[currentIndex]; if (!c) return; if (side === "right" && currentPhotoIndex < c.photos.length - 1) setCurrentPhotoIndex(currentPhotoIndex + 1); else if (side === "left" && currentPhotoIndex > 0) setCurrentPhotoIndex(currentPhotoIndex - 1); };

  const currentProfile = profiles[currentIndex];

  if (loading) return (<View style={[styles.container, { paddingTop: insets.top }]}><View style={styles.header}><Text style={styles.headerTitle}>CrossTown</Text></View><View style={styles.centered}><ActivityIndicator size="large" color={GOLD} /></View></View>);
  if (swipesRemaining <= 0) return (<View style={[styles.container, { paddingTop: insets.top }]}><View style={styles.header}><Text style={styles.headerTitle}>CrossTown</Text></View><View style={styles.centered}><View style={styles.emptyIcon}><FontAwesome name="clock-o" size={40} color={GOLD} /></View><Text style={styles.emptyTitle}>Daily Limit Reached</Text><Text style={styles.emptySubtitle}>You've used all 30 swipes today.{"\n"}Come back tomorrow!</Text></View></View>);
  if (!currentProfile) return (<View style={[styles.container, { paddingTop: insets.top }]}><View style={styles.header}><Text style={styles.headerTitle}>CrossTown</Text></View><View style={styles.centered}><View style={styles.emptyIcon}><FontAwesome name="search" size={40} color={GOLD} /></View><Text style={styles.emptyTitle}>No More Profiles</Text><Text style={styles.emptySubtitle}>You've seen everyone for now.{"\n"}Check back later!</Text><Pressable style={styles.refreshBtn} onPress={loadData}><Text style={styles.refreshText}>Refresh</Text></Pressable></View></View>);

  const sideColor = currentProfile.side === "usc" ? CARDINAL : BRUIN_BLUE;
  const sideName = currentProfile.side === "usc" ? "USC" : "UCLA";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}><Text style={styles.headerTitle}>CrossTown</Text><View style={styles.swipeCounter}><FontAwesome name="heart" size={12} color={GOLD} /><Text style={styles.swipeCountText}>{swipesRemaining}</Text></View></View>
      <View style={styles.cardContainer}>
        <Animated.View {...panResponder.panHandlers} style={[styles.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]}>
          <Image source={{ uri: currentProfile.photos[currentPhotoIndex] || "" }} style={styles.cardImage} />
          <Pressable style={styles.photoTapLeft} onPress={() => handlePhotoTap("left")} />
          <Pressable style={styles.photoTapRight} onPress={() => handlePhotoTap("right")} />
          {currentProfile.photos.length > 1 && <View style={styles.photoIndicators}>{currentProfile.photos.map((_, i) => <View key={i} style={[styles.indicator, i === currentPhotoIndex && styles.indicatorActive]} />)}</View>}
          <Animated.View style={[styles.stampContainer, styles.likeStamp, { opacity: likeOpacity }]}><Text style={styles.stampText}>LIKE</Text></Animated.View>
          <Animated.View style={[styles.stampContainer, styles.passStamp, { opacity: passOpacity }]}><Text style={[styles.stampText, { color: "#EF4444" }]}>PASS</Text></Animated.View>
          <View style={styles.cardOverlay}>
            <View style={[styles.sideBadge, { backgroundColor: sideColor }]}><Text style={styles.sideBadgeText}>{sideName}</Text></View>
            <Text style={styles.cardName}>{currentProfile.name}, {currentProfile.age}</Text>
            <Text style={styles.cardInfo}>{currentProfile.major} • {currentProfile.gradYear}</Text>
            {currentProfile.bio ? <Text style={styles.cardBio} numberOfLines={2}>{currentProfile.bio}</Text> : null}
          </View>
          <Pressable style={styles.moreButton} onPress={() => setShowOptions(true)}><FontAwesome name="ellipsis-h" size={18} color="rgba(255,255,255,0.7)" /></Pressable>
        </Animated.View>
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.passBtn]} onPress={handleButtonPass}><FontAwesome name="times" size={28} color="#EF4444" /></Pressable>
        <Pressable style={[styles.actionBtn, styles.likeBtn]} onPress={handleButtonLike}><FontAwesome name="heart" size={28} color="#10B981" /></Pressable>
      </View>
      <Modal visible={showMatch} transparent animationType="fade">
        <View style={styles.matchOverlay}><Animated.View style={[styles.matchContent, { transform: [{ scale: matchScale }] }]}>
          <Text style={styles.matchEmoji}>🔥</Text><Text style={styles.matchTitle}>It's a Match!</Text>
          <Text style={styles.matchSubtitle}>You and {matchedProfile?.name} from {matchedProfile?.side?.toUpperCase()} liked each other</Text>
          <Pressable style={styles.matchChatBtn} onPress={() => { setShowMatch(false); const users = [auth.currentUser!.uid, matchedProfile!.uid].sort(); router.push(`/chat/${users.join("_")}` as any); }}><Text style={styles.matchChatText}>Send a Message</Text></Pressable>
          <Pressable style={styles.matchKeepBtn} onPress={() => setShowMatch(false)}><Text style={styles.matchKeepText}>Keep Swiping</Text></Pressable>
        </Animated.View></View>
      </Modal>
      <MoreOptionsMenu visible={showOptions} onClose={() => setShowOptions(false)} onBlock={() => setShowBlockModal(true)} onReport={() => setShowReportModal(true)} />
      <BlockModal visible={showBlockModal} onClose={() => setShowBlockModal(false)} onBlock={handleBlock} userName={currentProfile?.name || ""} loading={blockLoading} />
      <ReportModal visible={showReportModal} onClose={() => setShowReportModal(false)} onSubmit={handleReport} userName={currentProfile?.name || ""} loading={reportLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
  swipeCounter: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,209,0,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  swipeCountText: { fontSize: 14, fontWeight: "700", color: "#FFD100" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,209,0,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 22 },
  refreshBtn: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 28, backgroundColor: "rgba(255,209,0,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,209,0,0.2)" },
  refreshText: { fontSize: 16, fontWeight: "600", color: "#FFD100" },
  cardContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  card: { width: width - 24, height: height * 0.58, borderRadius: 20, overflow: "hidden", backgroundColor: "#1E293B" },
  cardImage: { width: "100%", height: "100%", backgroundColor: "#334155" },
  photoTapLeft: { position: "absolute", left: 0, top: 0, bottom: 80, width: "40%" },
  photoTapRight: { position: "absolute", right: 0, top: 0, bottom: 80, width: "40%" },
  photoIndicators: { position: "absolute", top: 12, left: 16, right: 16, flexDirection: "row", gap: 4 },
  indicator: { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2 },
  indicatorActive: { backgroundColor: "#fff" },
  stampContainer: { position: "absolute", top: 40, padding: 10, borderWidth: 3, borderRadius: 10, transform: [{ rotate: "-15deg" }] },
  likeStamp: { left: 20, borderColor: "#10B981" },
  passStamp: { right: 20, borderColor: "#EF4444", transform: [{ rotate: "15deg" }] },
  stampText: { fontSize: 32, fontWeight: "900", color: "#10B981", letterSpacing: 3 },
  cardOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingTop: 60, backgroundColor: "rgba(0,0,0,0.5)" },
  sideBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  sideBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  cardName: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 2 },
  cardInfo: { fontSize: 15, color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  cardBio: { fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 20 },
  moreButton: { position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  actions: { flexDirection: "row", justifyContent: "center", gap: 32, paddingVertical: 16, paddingBottom: 8 },
  actionBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  passBtn: { backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 2, borderColor: "rgba(239,68,68,0.3)" },
  likeBtn: { backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 2, borderColor: "rgba(16,185,129,0.3)" },
  matchOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 32 },
  matchContent: { backgroundColor: "#1E293B", borderRadius: 24, padding: 32, alignItems: "center", width: "100%", borderWidth: 2, borderColor: "#FFD100" },
  matchEmoji: { fontSize: 56, marginBottom: 16 },
  matchTitle: { fontSize: 32, fontWeight: "900", color: "#FFD100", marginBottom: 8 },
  matchSubtitle: { fontSize: 16, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 24, marginBottom: 24 },
  matchChatBtn: { width: "100%", backgroundColor: "#FFD100", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 12 },
  matchChatText: { fontSize: 17, fontWeight: "700", color: "#1E293B" },
  matchKeepBtn: { paddingVertical: 12 },
  matchKeepText: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.4)" },
});
