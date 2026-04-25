// app/(tabs)/rivals.tsx
// Rivals — Incoming Challenges (collapsible, top) + Active Showdowns (chats, below)
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
  accentColor, accentBg, schoolColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
} from "../../utils/colors";
import { createGame } from "../../utils/gameUtils";

// ─── Types ───────────────────────────────────────────────────
interface ChallengeItem {
  id: string;
  fromUserId: string;
  fromSide: "usc" | "ucla";
  name: string;
  photo: string;
  major: string;
  gradYear: string;
  createdAt: any;
}

interface ShowdownItem {
  showdownId: string;
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
  const [incomingChallenges, setIncomingChallenges] = useState<ChallengeItem[]>([]);
  const [challengesExpanded, setChallengesExpanded] = useState(true);
  const [showAllChallenges, setShowAllChallenges] = useState(false);
  const [showdowns, setShowdowns] = useState<ShowdownItem[]>([]);

  const showdownsRef = useRef<Map<string, ShowdownItem>>(new Map());
  const unsubscribersRef = useRef<(() => void)[]>([]);
  const listeningShowdownsRef = useRef<Set<string>>(new Set());

  const styles = createStyles(mySide);

  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
      if (snap.exists()) setMySide(snap.data().side || "usc");
    });
  }, []);

  // ─── Real-time incoming challenges ─────────────────────────
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "challenges"),
      where("toUserId", "==", auth.currentUser.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const items: ChallengeItem[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        try {
          const userSnap = await getDoc(doc(db, "users", data.fromUserId));
          const u = userSnap.exists() ? userSnap.data() : null;
          items.push({
            id: d.id, fromUserId: data.fromUserId,
            fromSide: data.fromSide || "usc",
            name: u?.name || "Unknown", photo: u?.photos?.[0] || "",
            major: u?.major || "", gradYear: u?.gradYear || "",
            createdAt: data.createdAt,
          });
        } catch {}
      }
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setIncomingChallenges(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── Real-time showdowns (active showdowns) ──────────────────
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const showdownsQuery = query(collection(db, "showdowns"), where("users", "array-contains", uid));

    const unsub = onSnapshot(showdownsQuery, (snap) => {
      for (const showdownDoc of snap.docs) {
        const showdownId = showdownDoc.id;
        if (listeningShowdownsRef.current.has(showdownId)) continue;
        listeningShowdownsRef.current.add(showdownId);
        const otherUserId = showdownDoc.data().users.find((id: string) => id !== uid);
        if (otherUserId) setupShowdownListener(showdownId, otherUserId);
      }
      setLoading(false);
    });

    unsubscribersRef.current.push(unsub);
    return () => {
      unsubscribersRef.current.forEach((u) => u());
      unsubscribersRef.current = [];
      listeningShowdownsRef.current.clear();
    };
  }, []);

  const setupShowdownListener = async (showdownId: string, otherUserId: string) => {
    let otherName = "Unknown", otherPhoto = "", otherSide: "usc" | "ucla" = "ucla";
    try {
      const s = await getDoc(doc(db, "users", otherUserId));
      if (s.exists()) {
        const u = s.data();
        otherName = u.name || "Unknown";
        otherPhoto = u.photos?.[0] || "";
        otherSide = u.side || "ucla";
      }
    } catch {}

    const messagesQuery = query(
      collection(db, "showdowns", showdownId, "messages"),
      orderBy("createdAt", "desc"), limit(1)
    );
    const unsub = onSnapshot(messagesQuery, (messagesSnap) => {
      let lastMessage = "Talk trash to your rival";
      let lastMessageAt = null;
      if (!messagesSnap.empty) {
        const msg = messagesSnap.docs[0].data();
        lastMessage = msg.text || "Sent a message";
        lastMessageAt = msg.createdAt;
      }
      showdownsRef.current.set(showdownId, {
        showdownId, otherUserId, otherName, otherPhoto, otherSide,
        lastMessage, lastMessageAt, isUnread: false,
      });
      const sorted = Array.from(showdownsRef.current.values()).sort(
        (a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0)
      );
      setShowdowns(sorted);
    });
    unsubscribersRef.current.push(unsub);
  };

  // ─── Actions ───────────────────────────────────────────────
  const handleAccept = async (challenge: ChallengeItem) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, "challenges", challenge.id), {
        status: "accepted", acceptedAt: serverTimestamp(),
      });
      const showdownUsers = [auth.currentUser.uid, challenge.fromUserId].sort();
      const showdownId = showdownUsers.join("_");
      await setDoc(doc(db, "showdowns", showdownId), {
        users: showdownUsers, createdAt: serverTimestamp(),
        lastMessage: null, lastMessageAt: serverTimestamp(),
      });

      // Create a Cup Pong game — acceptor goes first
      const mySnap = await getDoc(doc(db, "users", auth.currentUser.uid));
      const mySideVal = mySnap.exists() ? mySnap.data().side : "usc";
      const sides: Record<string, string> = {
        [auth.currentUser.uid]: mySideVal,
        [challenge.fromUserId]: challenge.fromSide,
      };
      const gameId = await createGame(
        showdownId, "cup_pong",
        [auth.currentUser.uid, challenge.fromUserId],
        sides as any
      );

      // Navigate directly into the game
      router.push(`/game/cup-pong/${gameId}` as any);
    } catch (error) {
      console.error("Error accepting:", error);
      Alert.alert("Error", "Failed to accept challenge.");
    }
  };

  const handleDecline = async (challenge: ChallengeItem) => {
    // Silent — challenger never knows
    try {
      await updateDoc(doc(db, "challenges", challenge.id), {
        status: "declined", declinedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error declining:", error);
    }
  };

  const handleOpenChat = (s: ShowdownItem) => {
    router.push(`/chat/${s.showdownId}` as any);
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) {
      const h = date.getHours() % 12 || 12;
      const m = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
      return `${h}:${m} ${date.getHours() >= 12 ? "PM" : "AM"}`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
    return `${date.getMonth()+1}/${date.getDate()}`;
  };

  // ─── Render: Challenge Row ─────────────────────────────────
  const renderChallengeRow = (item: ChallengeItem) => {
    const sColor = schoolColor(item.fromSide);
    const sideName = item.fromSide === "usc" ? "USC" : "UCLA";

    return (
      <View key={item.id} style={styles.challengeRow}>
        <Pressable style={styles.challengeProfile} onPress={() => router.push(`/profile/${item.fromUserId}` as any)}>
          {item.photo ? (
            <View style={[styles.photoRing, { borderColor: sColor }]}>
              <Image source={{ uri: item.photo }} style={styles.photoCircle} />
            </View>
          ) : (
            <View style={[styles.photoRing, { borderColor: sColor }]}>
              <View style={styles.photoPlaceholder}>
                <FontAwesome name="user" size={18} color={TEXT_SECONDARY} />
              </View>
            </View>
          )}
          <View style={styles.challengeInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.sideBadge, { backgroundColor: sColor }]}>
                <Text style={styles.sideText}>{sideName}</Text>
              </View>
            </View>
            <Text style={styles.metaText} numberOfLines={1}>
              {item.major}{item.gradYear ? ` · ${item.gradYear}` : ""}
            </Text>
          </View>
        </Pressable>
        <View style={styles.challengeActions}>
          <Pressable style={[styles.acceptBtn, { backgroundColor: accentColor(mySide) }]} onPress={() => handleAccept(item)}>
            <Text style={styles.acceptText}>Accept</Text>
          </Pressable>
          <Pressable style={styles.declineBtn} onPress={() => handleDecline(item)}>
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
          <View style={[styles.photoRing, { borderColor: sColor }]}>
            <Image source={{ uri: item.otherPhoto }} style={styles.photoCircle} />
          </View>
        ) : (
          <View style={[styles.photoRing, { borderColor: sColor }]}>
            <View style={styles.photoPlaceholder}>
              <FontAwesome name="user" size={18} color={TEXT_SECONDARY} />
            </View>
          </View>
        )}
        <View style={styles.showdownContent}>
          <View style={styles.showdownNameRow}>
            <Text style={styles.nameText} numberOfLines={1}>{item.otherName}</Text>
            <View style={[styles.sideBadge, { backgroundColor: sColor }]}>
              <Text style={styles.sideText}>{sideName}</Text>
            </View>
            <Text style={styles.timestamp}>{formatTimestamp(item.lastMessageAt)}</Text>
          </View>
          <Text style={styles.showdownMessage} numberOfLines={1}>{item.lastMessage}</Text>
        </View>
      </Pressable>
    );
  };

  // ─── Render: List Header ───────────────────────────────────
  const renderListHeader = () => {
    const hasIncoming = incomingChallenges.length > 0;
    const hasShowdowns = showdowns.length > 0;
    const visibleChallenges = showAllChallenges ? incomingChallenges : incomingChallenges.slice(0, 3);

    return (
      <View>
        {/* Incoming Challenges section */}
        {hasIncoming && (
          <View style={styles.incomingSection}>
            <Pressable style={styles.incomingSectionHeader} onPress={() => setChallengesExpanded(!challengesExpanded)}>
              <Text style={styles.incomingSectionTitle}>Incoming Challenges</Text>
              <View style={styles.incomingBadge}>
                <Text style={styles.incomingBadgeText}>{incomingChallenges.length}</Text>
              </View>
            </Pressable>

            {challengesExpanded && (
              <>
                {visibleChallenges.map(renderChallengeRow)}
                {!showAllChallenges && incomingChallenges.length > 3 && (
                  <Pressable style={styles.seeAllBtn} onPress={() => setShowAllChallenges(true)}>
                    <Text style={styles.seeAllText}>See all {incomingChallenges.length} incoming →</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        {/* ACTIVE SHOWDOWNS section label */}
        {(hasIncoming || hasShowdowns) && (
          <Text style={styles.showdownsSectionTitle}>ACTIVE SHOWDOWNS</Text>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rivals</Text>
        <Pressable style={styles.bellButton}>
          <FontAwesome name="bell" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(mySide)} />
        </View>
      ) : (
        <FlatList
          data={showdowns}
          renderItem={renderShowdownRow}
          keyExtractor={(item) => item.showdownId}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); }} tintColor={accentColor(mySide)} />}
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
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 12,
    },
    headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
    bellButton: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
    listContent: { paddingBottom: 100, flexGrow: 1 },

    // ── Incoming Section ─────────────────────────────────────
    incomingSection: { paddingHorizontal: 16 },
    incomingSectionHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 14,
    },
    incomingSectionTitle: { fontSize: 15, fontWeight: "600", color: TEXT_SECONDARY, fontStyle: "italic" },
    incomingBadge: {
      backgroundColor: "#EF4444", borderRadius: 12, minWidth: 24, height: 24,
      justifyContent: "center", alignItems: "center", paddingHorizontal: 6,
    },
    incomingBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },

    // ── Challenge Row ────────────────────────────────────────
    challengeRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: BG_SURFACE, borderRadius: 14,
      padding: 14, marginBottom: 8,
    },
    challengeProfile: { flex: 1, flexDirection: "row", alignItems: "center" },
    challengeInfo: { flex: 1 },
    challengeActions: { flexDirection: "row", gap: 8, marginLeft: 8 },
    acceptBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    acceptText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    declineBtn: {
      paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    },
    declineText: { fontSize: 14, fontWeight: "600", color: TEXT_SECONDARY },

    seeAllBtn: { paddingVertical: 12, alignItems: "center" },
    seeAllText: { fontSize: 14, fontWeight: "600", color: accentColor(_s) },

    // ── Active Showdowns ─────────────────────────────────────
    showdownsSectionTitle: {
      fontSize: 12, fontWeight: "800", color: TEXT_SECONDARY,
      letterSpacing: 2, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10,
    },
    showdownRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 14, paddingHorizontal: 16,
      backgroundColor: BG_SURFACE, borderRadius: 12,
      marginHorizontal: 16, marginBottom: 6,
    },
    showdownContent: { flex: 1 },
    showdownNameRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    timestamp: { fontSize: 12, color: TEXT_SECONDARY, marginLeft: "auto" },
    showdownMessage: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 19 },

    // ── Shared ───────────────────────────────────────────────
    photoRing: {
      width: 50, height: 50, borderRadius: 25, borderWidth: 2.5,
      justifyContent: "center", alignItems: "center", marginRight: 12,
    },
    photoCircle: { width: 43, height: 43, borderRadius: 21.5 },
    photoPlaceholder: {
      width: 43, height: 43, borderRadius: 21.5, backgroundColor: "#334155",
      justifyContent: "center", alignItems: "center",
    },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
    nameText: { fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY, maxWidth: "60%" },
    sideBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
    sideText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
    metaText: { fontSize: 13, color: TEXT_SECONDARY },

    // ── Empty ────────────────────────────────────────────────
    emptyContainer: {
      flex: 1, justifyContent: "center", alignItems: "center",
      paddingHorizontal: 40, paddingVertical: 80,
    },
    emptyIcon: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: accentBg(_s, 0.1),
      justifyContent: "center", alignItems: "center", marginBottom: 20,
    },
    emptyTitle: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 8 },
    emptySubtitle: { fontSize: 15, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 22 },
  });
