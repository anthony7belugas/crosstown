// app/(tabs)/chat.tsx
// Matches list + active conversations — adapted from Besties chat tab
import { FontAwesome } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { getUserProfile } from "../../utils/userProfileCache";
import { accentColor, accentBg, schoolColor } from "../../utils/colors";


interface MatchItem {
  matchId: string;
  otherUserId: string;
  name: string;
  photo: string;
  side: "usc" | "ucla";
  lastMessage: string | null;
  lastMessageAt: any;
  hasConversation: boolean;
  createdAt: any;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSide, setUserSide] = useState<string>("usc");
  const [refreshing, setRefreshing] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const styles = createStyles(userSide);

  const setupListener = useCallback(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Load current user side for accent colors
    getDoc(doc(db, "users", uid)).then(meDoc => {
      if (meDoc.exists()) setUserSide(meDoc.data().side || "usc");
    }).catch(() => {});

    // Listen to matches where current user is a participant
    const matchesQuery = query(
      collection(db, "matches"),
      where("users", "array-contains", uid)
    );

    const unsub = onSnapshot(matchesQuery, async (snapshot) => {
      const items: MatchItem[] = [];

      for (const matchDoc of snapshot.docs) {
        const data = matchDoc.data();
        const otherUserId = data.users.find((id: string) => id !== uid);
        if (!otherUserId) continue;

        // Fetch other user's profile
        let profile: any = null;
        try {
          profile = await getUserProfile(otherUserId);
          if (!profile) {
            const userDoc = await getDoc(doc(db, "users", otherUserId));
            if (userDoc.exists()) profile = userDoc.data();
          }
        } catch (e) {
          console.error("Error fetching profile:", e);
        }

        items.push({
          matchId: matchDoc.id,
          otherUserId,
          name: profile?.name || "Unknown",
          photo: profile?.photos?.[0] || "",
          side: profile?.side || "usc",
          lastMessage: data.lastMessage || null,
          lastMessageAt: data.lastMessageAt,
          hasConversation: !!data.lastMessage,
          createdAt: data.createdAt,
        });
      }

      // Sort: conversations with messages first (by recency), then new matches (by match time)
      items.sort((a, b) => {
        if (a.hasConversation && !b.hasConversation) return -1;
        if (!a.hasConversation && b.hasConversation) return 1;
        if (a.hasConversation && b.hasConversation) {
          const aTime = a.lastMessageAt?.seconds || 0;
          const bTime = b.lastMessageAt?.seconds || 0;
          return bTime - aTime;
        }
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setMatches(items);
      setLoading(false);
      setRefreshing(false);
    });

    unsubRef.current = unsub;
  }, []);

  useEffect(() => {
    setupListener();
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [setupListener]);

  useFocusEffect(
    useCallback(() => {
      // Refresh on focus
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    if (unsubRef.current) unsubRef.current();
    setupListener();
  };

  const openChat = (matchId: string) => {
    router.push(`/chat/${matchId}` as any);
  };

  // Split into new matches (no messages) and active conversations
  const newMatches = matches.filter((m) => !m.hasConversation);
  const conversations = matches.filter((m) => m.hasConversation);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Matches</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(userSide)} />
        </View>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Matches</Text>
        </View>
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="comment" size={40} color={accentColor(userSide)} />
          </View>
          <Text style={styles.emptyTitle}>No Matches Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start swiping to find your rival match!
          </Text>
        </View>
      </View>
    );
  }

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
        <Text style={styles.matchCount}>{matches.length}</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.matchId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accentColor(userSide)}
          />
        }
        ListHeaderComponent={
          newMatches.length > 0 ? (
            <View style={styles.newMatchesSection}>
              <Text style={styles.sectionLabel}>New Matches</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.matchesRow}
              >
                {newMatches.map((match) => (
                  <Pressable
                    key={match.matchId}
                    style={styles.matchCircle}
                    onPress={() => openChat(match.matchId)}
                  >
                    <View
                      style={[
                        styles.matchCircleGlow,
                        {
                          borderColor:
                            schoolColor(match.side),
                        },
                      ]}
                    >
                      {match.photo ? (
                        <Image
                          source={{ uri: match.photo }}
                          style={styles.matchPhoto}
                        />
                      ) : (
                        <View style={styles.matchPhotoPlaceholder}>
                          <FontAwesome
                            name="user"
                            size={24}
                            color="rgba(255,255,255,0.3)"
                          />
                        </View>
                      )}
                    </View>
                    <Text style={styles.matchName} numberOfLines={1}>
                      {match.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {conversations.length > 0 && (
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                  Messages
                </Text>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.conversationRow,
              pressed && styles.conversationRowPressed,
            ]}
            onPress={() => openChat(item.matchId)}
          >
            <View style={styles.convPhotoContainer}>
              {item.photo ? (
                <Image
                  source={{ uri: item.photo }}
                  style={styles.convPhoto}
                />
              ) : (
                <View style={[styles.convPhoto, styles.convPhotoPlaceholder]}>
                  <FontAwesome
                    name="user"
                    size={20}
                    color="rgba(255,255,255,0.3)"
                  />
                </View>
              )}
              <View
                style={[
                  styles.sideDot,
                  {
                    backgroundColor:
                      schoolColor(item.side),
                  },
                ]}
              />
            </View>

            <View style={styles.convContent}>
              <View style={styles.convTopRow}>
                <Text style={styles.convName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.convTime}>
                  {formatTime(item.lastMessageAt)}
                </Text>
              </View>
              <Text style={styles.convMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          newMatches.length > 0 ? (
            <View style={styles.noConvos}>
              <Text style={styles.noConvosText}>
                Tap a match above to start chatting!
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const createStyles = (_s: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
  matchCount: {
    fontSize: 14,
    fontWeight: "700",
    color: accentColor(_s),
    backgroundColor: accentBg(_s, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
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
  emptyTitle: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 8 },
  emptySubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    lineHeight: 22,
  },
  listContent: { paddingBottom: 100 },

  // New matches horizontal row
  newMatchesSection: { paddingTop: 4, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  matchesRow: { paddingHorizontal: 16, gap: 16 },
  matchCircle: { alignItems: "center", width: 72 },
  matchCircleGlow: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  matchPhoto: { width: 60, height: 60, borderRadius: 30 },
  matchPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
  },
  matchName: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },

  // Conversation rows
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  conversationRowPressed: { backgroundColor: "rgba(255,255,255,0.04)" },
  convPhotoContainer: { position: "relative" },
  convPhoto: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#1E293B" },
  convPhotoPlaceholder: { justifyContent: "center", alignItems: "center" },
  sideDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: "#0F172A",
  },
  convContent: { flex: 1 },
  convTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  convName: { fontSize: 16, fontWeight: "700", color: "#fff", flex: 1, marginRight: 8 },
  convTime: { fontSize: 12, color: "rgba(255,255,255,0.3)" },
  convMessage: { fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 20 },

  noConvos: { paddingHorizontal: 20, paddingVertical: 30, alignItems: "center" },
  noConvosText: { fontSize: 14, color: "rgba(255,255,255,0.3)", fontStyle: "italic" },
});
