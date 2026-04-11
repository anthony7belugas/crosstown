// app/(tabs)/rivals.tsx
// Rivals tab — Incoming Challenges (collapsible) + Active Showdowns (chats)
// Pattern: Besties friends.tsx pending section + chat.tsx real-time listeners
import { FontAwesome } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, updateDoc, where, limit,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import {
  accentColor, accentBg, schoolColor, rivalColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
} from "../../utils/colors";

// ─── Types ───────────────────────────────────────────────────
interface ChallengeItem {
  id: string;          // challenge doc ID
  fromUserId: string;
  fromSide: "usc" | "ucla";
  name: string;
  photo: string;
  major: string;
  gradYear: string;
  createdAt: any;
}

interface ShowdownItem {
  matchId: string;
  otherUserId: string;
  otherName: string;
  otherPhoto: string;
  otherSide: "usc" | "ucla";
  lastMessage: string;
  lastMessageAt: any;
  isUnread: boolean;
}

// ─── Component ───────────────────────────────────────────────
export default function RivalsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mySide, setMySide] = useState<string>("usc");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Incoming challenges
  const [incomingChallenges, setIncomingChallenges] = useState<ChallengeItem[]>([]);
  const [challengesExpanded, setChallengesExpanded] = useState(true);
  const [showAllChallenges, setShowAllChallenges] = useState(false);

  // Active showdowns (accepted matches with chat)
  const [showdowns, setShowdowns] = useState<ShowdownItem[]>([]);

  const showdownsRef = useRef<Map<string, ShowdownItem>>(new Map());
  const unsubscribersRef = useRef<(() => void)[]>([]);
  const listeningMatchesRef = useRef<Set<string>>(new Set());

  const styles = createStyles(mySide);

  // ─── Load side ─────────────────────────────────────────────
  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
      if (snap.exists()) setMySide(snap.data().side || "usc");
    });
  }, []);

  // ─── Real-time incoming challenges ─────────────────────────
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const q = query(
      collection(db, "challenges"),
      where("toUserId", "==", uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const items: ChallengeItem[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        // Fetch challenger profile
        try {
          const userSnap = await getDoc(doc(db, "users", data.fromUserId));
          const userData = userSnap.exists() ? userSnap.data() : null;
          items.push({
            id: d.id,
            fromUserId: data.fromUserId,
            fromSide: data.fromSide || "usc",
            name: userData?.name || "Unknown",
            photo: userData?.photos?.[0] || "",
            major: userData?.major || "",
            gradYear: userData?.gradYear || "",
            createdAt: data.createdAt,
          });
        } catch {}
      }
      // Sort newest first
      items.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setIncomingChallenges(items);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // ─── Real-time matches (active showdowns) ──────────────────
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const matchesQuery = query(
      collection(db, "matches"),
      where("users", "array-contains", uid)
    );

    const unsub = onSnapshot(matchesQuery, (snap) => {
      for (const matchDoc of snap.docs) {
        const matchId = matchDoc.id;
        if (listeningMatchesRef.current.has(matchId)) continue;
        listeningMatchesRef.current.add(matchId);

        const matchData = matchDoc.data();
        const otherUserId = matchData.users.find((id: string) => id !== uid);
        if (!otherUserId) continue;

        setupShowdownListener(matchId, otherUserId);
      }
      setLoading(false);
    });

    unsubscribersRef.current.push(unsub);

    return () => {
      unsubscribersRef.current.forEach((u) => u());
      unsubscribersRef.current = [];
      listeningMatchesRef.current.clear();
    };
  }, []);

  const setupShowdownListener = async (matchId: string, otherUserId: string) => {
    // Load other user profile
    let otherName = "Unknown";
    let otherPhoto = "";
    let otherSide: "usc" | "ucla" = "ucla";

    try {
      const userSnap = await getDoc(doc(db, "users", otherUserId));
      if (userSnap.exists()) {
        const u = userSnap.data();
        otherName = u.name || "Unknown";
        otherPhoto = u.photos?.[0] || "";
        otherSide = u.side || "ucla";
      }
    } catch {}

    // Listen to last message
    const messagesQuery = query(
      collection(db, "matches", matchId, "messages"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(messagesQuery, (messagesSnap) => {
      let lastMessage = "Say something to your rival 🔥";
      let lastMessageAt = null;

      if (!messagesSnap.empty) {
        const msg = messagesSnap.docs[0].data();
        lastMessage = msg.text || "Sent a message";
        lastMessageAt = msg.createdAt;
      }

      const item: ShowdownItem = {
        matchId,
        otherUserId,
        otherName,
        otherPhoto,
        otherSide,
        lastMessage,
        lastMessageAt,
        isUnread: false,
      };

      showdownsRef.current.set(matchId, item);

      const sorted = Array.from(showdownsRef.current.values()).sort((a, b) => {
        const aTime = a.lastMessageAt?.seconds || 0;
        const bTime = b.lastMessageAt?.seconds || 0;
        return bTime - aTime;
      });

      setShowdowns(sorted);
    });

    unsubscribersRef.current.push(unsub);
  };

  // ─── Actions ───────────────────────────────────────────────
  const handleAcceptChallenge = async (challenge: ChallengeItem) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
      // Update challenge status
      await updateDoc(doc(db, "challenges", challenge.id), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
      });

      // Create match
      const matchUsers = [uid, challenge.fromUserId].sort();
      const matchId = matchUsers.join("_");
      await setDoc(doc(db, "matches", matchId), {
        users: matchUsers,
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: serverTimestamp(),
      });

      // Navigate to chat
      router.push(`/chat/${matchId}` as any);
    } catch (error) {
      console.error("Error accepting challenge:", error);
      Alert.alert("Error", "Failed to accept challenge. Try again.");
    }
  };

  const handleDeclineChallenge = async (challenge: ChallengeItem) => {
    try {
      // Silent decline — update status, no notification to challenger
      await updateDoc(doc(db, "challenges", challenge.id), {
        status: "declined",
        declinedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error declining challenge:", error);
    }
  };

  const handleOpenChat = (showdown: ShowdownItem) => {
    router.push(`/chat/${showdown.matchId}` as any);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Listeners are real-time, just wait a moment
    setTimeout(() => setRefreshing(false), 500);
  };

  // ─── Helpers ───────────────────────────────────────────────
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate
      ? timestamp.toDate()
      : timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const h = hours % 12 || 12;
      const m = minutes < 10 ? `0${minutes}` : minutes;
      return `${h}:${m} ${ampm}`;
    } else if (diffDays === 1) return "Yesterday";
    else if (diffDays < 7) {
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  // ─── Render: Incoming Challenge Row ────────────────────────
  const renderChallengeRow = (item: ChallengeItem) => {
    const sColor = schoolColor(item.fromSide);
    const sideName = item.fromSide === "usc" ? "USC" : "UCLA";

    return (
      <View key={item.id} style={styles.challengeRow}>
        <Pressable
          style={styles.challengeProfile}
          onPress={() => router.push(`/profile/${item.fromUserId}` as any)}
        >
          {item.photo ? (
            <View style={[styles.challengePhotoRing, { borderColor: sColor }]}>
              <Image source={{ uri: item.photo }} style={styles.challengePhoto} />
            </View>
          ) : (
            <View style={[styles.challengePhotoRing, { borderColor: sColor }]}>
              <View style={styles.challengePhotoPlaceholder}>
                <FontAwesome name="user" size={18} color={TEXT_SECONDARY} />
              </View>
            </View>
          )}
          <View style={styles.challengeInfo}>
            <View style={styles.challengeNameRow}>
              <Text style={styles.challengeName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={[styles.challengeSideBadge, { backgroundColor: sColor }]}>
                <Text style={styles.challengeSideText}>{sideName}</Text>
              </View>
            </View>
            <Text style={styles.challengeMeta} numberOfLines={1}>
              {item.major}{item.gradYear ? ` • ${item.gradYear}` : ""}
            </Text>
          </View>
        </Pressable>

        <View style={styles.challengeActions}>
          <Pressable
            style={[styles.acceptBtn, { backgroundColor: accentColor(mySide) }]}
            onPress={() => handleAcceptChallenge(item)}
          >
            <Text style={styles.acceptText}>Accept</Text>
          </Pressable>
          <Pressable
            style={styles.declineBtn}
            onPress={() => handleDeclineChallenge(item)}
          >
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // ─── Render: Showdown Row ──────────────────────────────────
  const renderShowdownRow = ({ item }: { item: ShowdownItem }) => {
    const sColor = schoolColor(item.otherSide);
    const sideName = item.otherSide === "usc" ? "USC" : "UCLA";

    return (
      <Pressable style={styles.showdownRow} onPress={() => handleOpenChat(item)}>
        {item.otherPhoto ? (
          <View style={[styles.showdownPhotoRing, { borderColor: sColor }]}>
            <Image source={{ uri: item.otherPhoto }} style={styles.showdownPhoto} />
          </View>
        ) : (
          <View style={[styles.showdownPhotoRing, { borderColor: sColor }]}>
            <View style={styles.showdownPhotoPlaceholder}>
              <FontAwesome name="user" size={18} color={TEXT_SECONDARY} />
            </View>
          </View>
        )}

        <View style={styles.showdownContent}>
          <View style={styles.showdownNameRow}>
            <Text style={styles.showdownName} numberOfLines={1}>
              {item.otherName}
            </Text>
            <View style={[styles.showdownSideBadge, { backgroundColor: sColor }]}>
              <Text style={styles.showdownSideText}>{sideName}</Text>
            </View>
            <Text style={styles.showdownTime}>
              {formatTimestamp(item.lastMessageAt)}
            </Text>
          </View>
          <Text style={styles.showdownMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>

        <FontAwesome name="chevron-right" size={12} color="rgba(255,255,255,0.15)" />
      </Pressable>
    );
  };

  // ─── Render: List Header (Incoming Challenges section) ─────
  const renderListHeader = () => {
    if (incomingChallenges.length === 0) return null;

    const visibleChallenges = showAllChallenges
      ? incomingChallenges
      : incomingChallenges.slice(0, 3);

    return (
      <View style={styles.incomingSection}>
        {/* Section header — tap to collapse/expand */}
        <Pressable
          style={styles.incomingSectionHeader}
          onPress={() => setChallengesExpanded(!challengesExpanded)}
        >
          <View style={styles.incomingSectionLeft}>
            <Text style={styles.incomingSectionTitle}>Incoming Challenges</Text>
            <View style={styles.incomingBadge}>
              <Text style={styles.incomingBadgeText}>{incomingChallenges.length}</Text>
            </View>
          </View>
          <FontAwesome
            name={challengesExpanded ? "chevron-up" : "chevron-down"}
            size={12}
            color={TEXT_SECONDARY}
          />
        </Pressable>

        {/* Challenge rows */}
        {challengesExpanded && (
          <>
            {visibleChallenges.map(renderChallengeRow)}

            {/* "See all N →" link */}
            {!showAllChallenges && incomingChallenges.length > 3 && (
              <Pressable
                style={styles.seeAllBtn}
                onPress={() => setShowAllChallenges(true)}
              >
                <Text style={styles.seeAllText}>
                  See all {incomingChallenges.length} incoming →
                </Text>
              </Pressable>
            )}
          </>
        )}

        {/* Divider between sections */}
        <View style={styles.sectionDivider} />

        {/* Active Showdowns section title */}
        <Text style={styles.showdownsSectionTitle}>Active Showdowns</Text>
      </View>
    );
  };

  // ─── Render: Empty state ───────────────────────────────────
  const renderEmpty = () => {
    if (loading) return null;
    // Only show empty if NO incoming AND NO showdowns
    if (incomingChallenges.length > 0) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <FontAwesome name="bolt" size={36} color={accentColor(mySide)} />
        </View>
        <Text style={styles.emptyTitle}>No rivals yet</Text>
        <Text style={styles.emptySubtitle}>
          Head to Duels to challenge someone{"\n"}from the other side
        </Text>
      </View>
    );
  };

  // ─── Main Render ───────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rivals</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(mySide)} />
        </View>
      ) : (
        <FlatList
          data={showdowns}
          renderItem={renderShowdownRow}
          keyExtractor={(item) => item.matchId}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            incomingChallenges.length > 0 ? renderListHeader : (
              showdowns.length > 0 ? (
                <Text style={styles.showdownsSectionTitleStandalone}>Active Showdowns</Text>
              ) : null
            )
          }
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={accentColor(mySide)}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const createStyles = (_s: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: BG_PRIMARY },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
    listContent: { paddingBottom: 100, flexGrow: 1 },

    // ── Incoming Challenges Section ──────────────────────────
    incomingSection: { paddingHorizontal: 16 },
    incomingSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    incomingSectionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    incomingSectionTitle: { fontSize: 17, fontWeight: "700", color: TEXT_PRIMARY },
    incomingBadge: {
      backgroundColor: "#EF4444",
      borderRadius: 10,
      minWidth: 22,
      height: 22,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
    },
    incomingBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },

    // ── Challenge Row ────────────────────────────────────────
    challengeRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: BG_SURFACE,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
    },
    challengeProfile: { flex: 1, flexDirection: "row", alignItems: "center" },
    challengePhotoRing: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 2.5,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    challengePhoto: { width: 44, height: 44, borderRadius: 22 },
    challengePhotoPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#334155",
      justifyContent: "center",
      alignItems: "center",
    },
    challengeInfo: { flex: 1 },
    challengeNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
    challengeName: { fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY, maxWidth: "60%" },
    challengeSideBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
    },
    challengeSideText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
    challengeMeta: { fontSize: 13, color: TEXT_SECONDARY },

    challengeActions: { flexDirection: "row", gap: 8, marginLeft: 8 },
    acceptBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    acceptText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    declineBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    declineText: { fontSize: 14, fontWeight: "600", color: TEXT_SECONDARY },

    seeAllBtn: { paddingVertical: 12, alignItems: "center" },
    seeAllText: { fontSize: 14, fontWeight: "600", color: accentColor(_s) },

    sectionDivider: {
      height: 1,
      backgroundColor: "rgba(255,255,255,0.06)",
      marginVertical: 8,
    },

    // ── Active Showdowns ─────────────────────────────────────
    showdownsSectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: TEXT_PRIMARY,
      paddingVertical: 10,
    },
    showdownsSectionTitleStandalone: {
      fontSize: 17,
      fontWeight: "700",
      color: TEXT_PRIMARY,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },

    showdownRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.04)",
    },
    showdownPhotoRing: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2.5,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    showdownPhoto: { width: 44, height: 44, borderRadius: 22 },
    showdownPhotoPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#334155",
      justifyContent: "center",
      alignItems: "center",
    },
    showdownContent: { flex: 1 },
    showdownNameRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    showdownName: {
      fontSize: 16,
      fontWeight: "700",
      color: TEXT_PRIMARY,
      marginRight: 8,
      maxWidth: "45%",
    },
    showdownSideBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      marginRight: 8,
    },
    showdownSideText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
    showdownTime: { fontSize: 12, color: TEXT_SECONDARY, marginLeft: "auto" },
    showdownMessage: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 19 },

    // ── Empty State ──────────────────────────────────────────
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
      paddingVertical: 80,
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
    emptyTitle: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 8 },
    emptySubtitle: {
      fontSize: 15,
      color: "rgba(255,255,255,0.4)",
      textAlign: "center",
      lineHeight: 22,
    },
  });
