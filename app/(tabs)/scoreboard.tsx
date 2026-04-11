// app/(tabs)/scoreboard.tsx
// Scoreboard — All-Time tally, This Week with countdown, Top Players leaderboard
// Real-time Firestore listeners so tallies update live
import { FontAwesome } from "@expo/vector-icons";
import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, limit,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import {
  accentColor, accentBg, USC_RED, UCLA_BLUE,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
} from "../../utils/colors";

// ─── Types ───────────────────────────────────────────────────
interface TallyData {
  usc_alltime: number;
  ucla_alltime: number;
  usc_weekly: number;
  ucla_weekly: number;
  weekStart: any;
}

interface PlayerRow {
  uid: string;
  name: string;
  photo: string;
  side: "usc" | "ucla";
  wins: number;
}

// ─── Helpers ─────────────────────────────────────────────────
function getNextMondayMidnight(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 6=Sat
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Resetting...";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ─── Component ───────────────────────────────────────────────
export default function ScoreboardScreen() {
  const insets = useSafeAreaInsets();
  const [mySide, setMySide] = useState<string>("usc");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tally, setTally] = useState<TallyData>({
    usc_alltime: 0,
    ucla_alltime: 0,
    usc_weekly: 0,
    ucla_weekly: 0,
    weekStart: null,
  });
  const [topPlayers, setTopPlayers] = useState<PlayerRow[]>([]);
  const [countdown, setCountdown] = useState("");

  const styles = createStyles(mySide);

  // Load user side
  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
      if (snap.exists()) setMySide(snap.data().side || "usc");
    });
  }, []);

  // Real-time tally listener
  useEffect(() => {
    const tallyRef = doc(db, "scoreboard", "tallies");
    const unsub = onSnapshot(tallyRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTally({
          usc_alltime: data.usc_alltime || 0,
          ucla_alltime: data.ucla_alltime || 0,
          usc_weekly: data.usc_weekly || 0,
          ucla_weekly: data.ucla_weekly || 0,
          weekStart: data.weekStart || null,
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load top players
  useEffect(() => {
    loadTopPlayers();
  }, []);

  const loadTopPlayers = async () => {
    try {
      // Query users with wins > 0, ordered by wins desc, limited to 20
      const q = query(
        collection(db, "users"),
        where("wins", ">", 0),
        orderBy("wins", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      const players: PlayerRow[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          name: data.name || "Unknown",
          photo: data.photos?.[0] || "",
          side: data.side || "usc",
          wins: data.wins || 0,
        };
      });
      setTopPlayers(players);
    } catch (error) {
      console.error("Error loading top players:", error);
    }
  };

  // Weekly countdown timer
  useEffect(() => {
    const update = () => {
      const nextMonday = getNextMondayMidnight();
      const ms = nextMonday.getTime() - Date.now();
      setCountdown(formatCountdown(ms));
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTopPlayers();
    setRefreshing(false);
  };

  // ─── Tally Bar ─────────────────────────────────────────────
  const renderTallyBar = (uscWins: number, uclaWins: number) => {
    const total = uscWins + uclaWins;
    const uscPct = total > 0 ? (uscWins / total) * 100 : 50;
    const uclaPct = total > 0 ? (uclaWins / total) * 100 : 50;

    return (
      <View style={styles.tallyBar}>
        <View style={[styles.tallyBarUSC, { width: `${uscPct}%` }]} />
        <View style={[styles.tallyBarUCLA, { width: `${uclaPct}%` }]} />
      </View>
    );
  };

  // ─── Section: All-Time ─────────────────────────────────────
  const renderAllTime = () => {
    const uscWins = tally.usc_alltime;
    const uclaWins = tally.ucla_alltime;
    const leader =
      uscWins > uclaWins
        ? "USC leads overall 🔴"
        : uclaWins > uscWins
        ? "UCLA leads overall 🔵"
        : "Tied overall";

    return (
      <View style={styles.tallyCard}>
        <Text style={styles.tallySectionLabel}>ALL-TIME</Text>

        <View style={styles.tallyNumbers}>
          <View style={styles.tallySchool}>
            <Text style={[styles.tallySchoolLabel, { color: USC_RED }]}>USC</Text>
            <Text style={[styles.tallyCount, { color: USC_RED }]}>{uscWins}</Text>
          </View>

          <Text style={styles.tallyVS}>VS</Text>

          <View style={styles.tallySchool}>
            <Text style={[styles.tallySchoolLabel, { color: UCLA_BLUE }]}>UCLA</Text>
            <Text style={[styles.tallyCount, { color: UCLA_BLUE }]}>{uclaWins}</Text>
          </View>
        </View>

        {renderTallyBar(uscWins, uclaWins)}
        <Text style={styles.tallyLeader}>{leader}</Text>
      </View>
    );
  };

  // ─── Section: This Week ────────────────────────────────────
  const renderThisWeek = () => {
    const uscWins = tally.usc_weekly;
    const uclaWins = tally.ucla_weekly;
    const leader =
      uscWins > uclaWins
        ? "USC leads this week 🔴"
        : uclaWins > uscWins
        ? "UCLA leads this week 🔵"
        : "Tied this week";

    return (
      <View style={styles.tallyCard}>
        <View style={styles.weeklyHeader}>
          <Text style={styles.tallySectionLabel}>THIS WEEK</Text>
          <View style={styles.countdownBadge}>
            <FontAwesome name="refresh" size={10} color={accentColor(mySide)} />
            <Text style={styles.countdownText}>resets in {countdown}</Text>
          </View>
        </View>

        <View style={styles.tallyNumbers}>
          <View style={styles.tallySchool}>
            <Text style={[styles.tallySchoolLabel, { color: USC_RED }]}>USC</Text>
            <Text style={[styles.tallyCount, { color: USC_RED }]}>{uscWins}</Text>
          </View>

          <Text style={styles.tallyVS}>VS</Text>

          <View style={styles.tallySchool}>
            <Text style={[styles.tallySchoolLabel, { color: UCLA_BLUE }]}>UCLA</Text>
            <Text style={[styles.tallyCount, { color: UCLA_BLUE }]}>{uclaWins}</Text>
          </View>
        </View>

        {renderTallyBar(uscWins, uclaWins)}
        <Text style={styles.tallyLeader}>{leader}</Text>
      </View>
    );
  };

  // ─── Section: Top Players ──────────────────────────────────
  const renderPlayerRow = (player: PlayerRow, index: number) => {
    const sColor = player.side === "usc" ? USC_RED : UCLA_BLUE;
    const sideName = player.side === "usc" ? "USC" : "UCLA";
    const isMe = player.uid === auth.currentUser?.uid;

    return (
      <View
        key={player.uid}
        style={[styles.playerRow, isMe && styles.playerRowMe]}
      >
        {/* Rank */}
        <View style={styles.playerRank}>
          <Text
            style={[
              styles.playerRankText,
              index === 0 && { color: "#FFD700", fontWeight: "900" },
              index === 1 && { color: "#C0C0C0", fontWeight: "900" },
              index === 2 && { color: "#CD7F32", fontWeight: "900" },
            ]}
          >
            {index + 1}
          </Text>
        </View>

        {/* Photo + Ring */}
        {player.photo ? (
          <View style={[styles.playerPhotoRing, { borderColor: sColor }]}>
            <Image source={{ uri: player.photo }} style={styles.playerPhoto} />
          </View>
        ) : (
          <View style={[styles.playerPhotoRing, { borderColor: sColor }]}>
            <View style={styles.playerPhotoPlaceholder}>
              <FontAwesome name="user" size={14} color={TEXT_SECONDARY} />
            </View>
          </View>
        )}

        {/* Name + side */}
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>
            {player.name}
            {isMe ? " (you)" : ""}
          </Text>
          <View style={[styles.playerSideBadge, { backgroundColor: sColor }]}>
            <Text style={styles.playerSideText}>{sideName}</Text>
          </View>
        </View>

        {/* Win count */}
        <Text style={[styles.playerWins, { color: sColor }]}>
          {player.wins} W
        </Text>
      </View>
    );
  };

  const renderTopPlayers = () => {
    if (topPlayers.length === 0) {
      return (
        <View style={styles.tallyCard}>
          <Text style={styles.tallySectionLabel}>TOP PLAYERS</Text>
          <View style={styles.emptyLeaderboard}>
            <FontAwesome name="trophy" size={28} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyLeaderboardText}>
              No games played yet — be the first!
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tallyCard}>
        <Text style={styles.tallySectionLabel}>TOP PLAYERS</Text>
        {topPlayers.slice(0, 10).map((player, index) => renderPlayerRow(player, index))}
        {topPlayers.length > 10 && (
          <Text style={styles.seeAllLeaderboard}>
            See full leaderboard →
          </Text>
        )}
      </View>
    );
  };

  // ─── Main Render ───────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scoreboard</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(mySide)} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={accentColor(mySide)}
            />
          }
        >
          {renderAllTime()}
          {renderThisWeek()}
          {renderTopPlayers()}
        </ScrollView>
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
    scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },

    // ── Tally Card ───────────────────────────────────────────
    tallyCard: {
      backgroundColor: BG_SURFACE,
      borderRadius: 18,
      padding: 22,
      marginBottom: 16,
    },
    tallySectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: TEXT_SECONDARY,
      letterSpacing: 2,
      marginBottom: 18,
    },
    tallyNumbers: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    tallySchool: { flex: 1, alignItems: "center" },
    tallySchoolLabel: { fontSize: 14, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
    tallyCount: { fontSize: 42, fontWeight: "900" },
    tallyVS: { fontSize: 18, fontWeight: "800", color: TEXT_SECONDARY, marginHorizontal: 12 },

    // ── Tally Bar ────────────────────────────────────────────
    tallyBar: {
      flexDirection: "row",
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: 14,
    },
    tallyBarUSC: { backgroundColor: USC_RED, minWidth: 4 },
    tallyBarUCLA: { backgroundColor: UCLA_BLUE, minWidth: 4 },

    tallyLeader: {
      fontSize: 14,
      fontWeight: "600",
      color: TEXT_SECONDARY,
      textAlign: "center",
    },

    // ── Weekly Header ────────────────────────────────────────
    weeklyHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    countdownBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: accentBg(_s, 0.08),
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    countdownText: { fontSize: 12, fontWeight: "600", color: accentColor(_s) },

    // ── Top Players ──────────────────────────────────────────
    playerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.04)",
    },
    playerRowMe: {
      backgroundColor: accentBg(_s, 0.06),
      borderRadius: 10,
      paddingHorizontal: 8,
      marginHorizontal: -8,
    },
    playerRank: { width: 28, alignItems: "center" },
    playerRankText: { fontSize: 16, fontWeight: "700", color: TEXT_SECONDARY },
    playerPhotoRing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 8,
      marginRight: 12,
    },
    playerPhoto: { width: 34, height: 34, borderRadius: 17 },
    playerPhotoPlaceholder: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "#334155",
      justifyContent: "center",
      alignItems: "center",
    },
    playerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    playerName: { fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY, maxWidth: "60%" },
    playerSideBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
    },
    playerSideText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
    playerWins: { fontSize: 15, fontWeight: "800" },

    emptyLeaderboard: {
      alignItems: "center",
      paddingVertical: 30,
      gap: 12,
    },
    emptyLeaderboardText: {
      fontSize: 14,
      color: TEXT_SECONDARY,
      textAlign: "center",
    },
    seeAllLeaderboard: {
      fontSize: 14,
      fontWeight: "600",
      color: accentColor(_s),
      textAlign: "center",
      paddingTop: 14,
    },
  });
