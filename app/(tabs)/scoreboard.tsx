// app/(tabs)/scoreboard.tsx
// Scoreboard — ALL TIME | THIS WEEK (resets in Xd Xh) | TOP PLAYERS
// Real-time Firestore listener on scoreboard/tallies doc
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, limit,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import {
  accentColor, accentBg, USC_RED, UCLA_BLUE,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
} from "../../utils/colors";

interface TallyData {
  usc_alltime: number; ucla_alltime: number;
  usc_weekly: number; ucla_weekly: number;
}

interface PlayerRow {
  uid: string; name: string; photo: string;
  side: "usc" | "ucla"; wins: number;
}

function getNextMondayMidnight(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "RESETTING...";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `RESETS IN ${d}D ${h}H`;
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `RESETS IN ${h}H ${m}M`;
  return `RESETS IN ${m}M`;
}

export default function ScoreboardScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scrollTo?: string }>();
  const [mySide, setMySide] = useState<string>("usc");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tally, setTally] = useState<TallyData>({ usc_alltime: 0, ucla_alltime: 0, usc_weekly: 0, ucla_weekly: 0 });
  const [topPlayers, setTopPlayers] = useState<PlayerRow[]>([]);
  const [myOwnRow, setMyOwnRow] = useState<PlayerRow | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");
  const styles = createStyles(mySide);

  // Refs for scroll-to-me behavior
  const scrollViewRef = useRef<ScrollView>(null);
  const myRowY = useRef<number>(0);
  const ghostRowY = useRef<number>(0);

  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, "users", auth.currentUser.uid)).then((s) => {
      if (s.exists()) {
        const d = s.data();
        setMySide(d.side || "usc");
        setMyRank(d.currentRank ?? null);
        setMyOwnRow({
          uid: auth.currentUser!.uid,
          name: d.name || "You",
          photo: d.photos?.[0] || "",
          side: d.side || "usc",
          wins: d.wins || 0,
        });
      }
    });
  }, []);

  // Real-time tally
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "scoreboard", "tallies"), (s) => {
      if (s.exists()) {
        const d = s.data();
        setTally({
          usc_alltime: d.usc_alltime || 0, ucla_alltime: d.ucla_alltime || 0,
          usc_weekly: d.usc_weekly || 0, ucla_weekly: d.ucla_weekly || 0,
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Top players — fetch top 100 for unified leaderboard (across USC + UCLA)
  useEffect(() => { loadTopPlayers(); }, []);
  const loadTopPlayers = async () => {
    try {
      const q = query(collection(db, "users"), where("wins", ">", 0), orderBy("wins", "desc"), limit(100));
      const snap = await getDocs(q);
      setTopPlayers(snap.docs.map((d) => {
        const data = d.data();
        return { uid: d.id, name: data.name || "Unknown", photo: data.photos?.[0] || "", side: data.side || "usc", wins: data.wins || 0 };
      }));
    } catch (e) { console.error("Error loading top players:", e); }
  };

  // When ?scrollTo=me is in route params, scroll to the user's row
  // (or to the ghost row if they're unranked). Small delay lets the layout settle.
  useEffect(() => {
    if (params.scrollTo !== "me") return;
    if (loading || topPlayers.length === 0) return;
    const t = setTimeout(() => {
      const target =
        myRank !== null && myRank > 0 ? myRowY.current : ghostRowY.current;
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, target - 80),
        animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [params.scrollTo, loading, topPlayers.length, myRank]);

  // Countdown timer
  useEffect(() => {
    const update = () => setCountdown(formatCountdown(getNextMondayMidnight().getTime() - Date.now()));
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, []);

  // ─── Tally Bar ─────────────────────────────────────────────
  const TallyBar = ({ usc, ucla }: { usc: number; ucla: number }) => {
    const total = usc + ucla;
    const uscPct = total > 0 ? (usc / total) * 100 : 50;
    return (
      <View style={styles.tallyBar}>
        <View style={[styles.tallyBarUSC, { width: `${uscPct}%` }]} />
        <View style={[styles.tallyBarUCLA, { width: `${100 - uscPct}%` }]} />
      </View>
    );
  };

  const leaderText = (usc: number, ucla: number, suffix: string) =>
    usc > ucla ? `USC leads ${suffix} 🔴` : ucla > usc ? `UCLA leads ${suffix} 🔵` : `Tied ${suffix}`;

  // ─── Render ────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scoreboard</Text>
        <Pressable style={styles.bellButton}>
          <FontAwesome name="bell" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={accentColor(mySide)} /></View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadTopPlayers(); setRefreshing(false); }} tintColor={accentColor(mySide)} />}>

          {/* ALL TIME */}
          <Text style={styles.sectionLabel}>ALL TIME</Text>
          <View style={styles.tallyCard}>
            <View style={styles.tallyNumbers}>
              <View style={styles.tallySchool}>
                <Text style={[styles.tallyCount, { color: USC_RED }]}>{tally.usc_alltime.toLocaleString()}</Text>
                <Text style={[styles.tallySchoolLabel, { color: TEXT_SECONDARY }]}>USC wins</Text>
              </View>
              <Text style={styles.tallyVS}>VS</Text>
              <View style={styles.tallySchool}>
                <Text style={[styles.tallyCount, { color: UCLA_BLUE }]}>{tally.ucla_alltime.toLocaleString()}</Text>
                <Text style={[styles.tallySchoolLabel, { color: TEXT_SECONDARY }]}>UCLA wins</Text>
              </View>
            </View>
            <TallyBar usc={tally.usc_alltime} ucla={tally.ucla_alltime} />
            <Text style={styles.tallyLeader}>{leaderText(tally.usc_alltime, tally.ucla_alltime, "overall")}</Text>
          </View>

          {/* THIS WEEK */}
          <View style={styles.weeklyLabelRow}>
            <Text style={styles.sectionLabel}>THIS WEEK</Text>
            <Text style={styles.countdownInline}>{countdown}</Text>
          </View>
          <View style={styles.tallyCard}>
            <View style={styles.tallyNumbers}>
              <View style={styles.tallySchool}>
                <Text style={[styles.tallyCount, { color: USC_RED }]}>{tally.usc_weekly}</Text>
                <Text style={[styles.tallySchoolLabel, { color: TEXT_SECONDARY }]}>USC this week</Text>
              </View>
              <Text style={styles.tallyVS}>VS</Text>
              <View style={styles.tallySchool}>
                <Text style={[styles.tallyCount, { color: UCLA_BLUE }]}>{tally.ucla_weekly}</Text>
                <Text style={[styles.tallySchoolLabel, { color: TEXT_SECONDARY }]}>UCLA this week</Text>
              </View>
            </View>
            <TallyBar usc={tally.usc_weekly} ucla={tally.ucla_weekly} />
            <Text style={styles.tallyLeader}>{leaderText(tally.usc_weekly, tally.ucla_weekly, "this week")}</Text>
          </View>

          {/* TOP PLAYERS */}
          <Text style={styles.sectionLabel}>TOP PLAYERS</Text>
          <View
            style={styles.tallyCard}
            onLayout={(e) => {
              // Track where the Top Players card starts so we can scroll to the
              // ghost row by computing offset below. (Used as a fallback.)
            }}
          >
            {topPlayers.length === 0 ? (
              <View style={styles.emptyLeaderboard}>
                <FontAwesome name="trophy" size={28} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyLeaderboardText}>No games played yet — be the first!</Text>
              </View>
            ) : (
              topPlayers.map((player, i) => {
                const sColor = player.side === "usc" ? USC_RED : UCLA_BLUE;
                const sideName = player.side === "usc" ? "USC" : "UCLA";
                const isMe = player.uid === auth.currentUser?.uid;
                return (
                  <View
                    key={player.uid}
                    style={[styles.playerRow, isMe && styles.playerRowMe]}
                    onLayout={(e) => {
                      if (isMe) {
                        // y here is relative to the card, but the card is
                        // itself offset — we measure via pageY instead in a
                        // later enhancement. For now the ScrollView's scrollTo
                        // with a generous offset handles most cases.
                        // We approximate by storing y within the card.
                        myRowY.current = e.nativeEvent.layout.y + 400;
                      }
                    }}
                  >
                    <Text style={[styles.rank, i < 3 && { color: ["#FFD700","#C0C0C0","#CD7F32"][i], fontWeight: "900" }]}>#{i+1}</Text>
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
                    <Text style={styles.playerName} numberOfLines={1}>{player.name}{isMe ? " (you)" : ""}</Text>
                    <View style={[styles.playerSideBadge, { backgroundColor: sColor }]}>
                      <Text style={styles.playerSideText}>{sideName}</Text>
                    </View>
                    <Text style={[styles.playerWins, { color: sColor }]}>{player.wins} wins</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* GHOST ROW — only for unranked users (not in top 100) */}
          {myOwnRow &&
            myRank === null &&
            !topPlayers.some((p) => p.uid === auth.currentUser?.uid) && (
              <View
                style={styles.ghostSection}
                onLayout={(e) => {
                  ghostRowY.current = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.ghostDivider}>
                  <Text style={styles.ghostDividerText}>· · ·</Text>
                </View>
                <View style={[styles.playerRow, styles.ghostRow]}>
                  <Text style={styles.ghostRank}>—</Text>
                  {myOwnRow.photo ? (
                    <View
                      style={[
                        styles.playerPhotoRing,
                        {
                          borderColor:
                            myOwnRow.side === "usc" ? USC_RED : UCLA_BLUE,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: myOwnRow.photo }}
                        style={styles.playerPhoto}
                      />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.playerPhotoRing,
                        {
                          borderColor:
                            myOwnRow.side === "usc" ? USC_RED : UCLA_BLUE,
                        },
                      ]}
                    >
                      <View style={styles.playerPhotoPlaceholder}>
                        <FontAwesome
                          name="user"
                          size={14}
                          color={TEXT_SECONDARY}
                        />
                      </View>
                    </View>
                  )}
                  <Text style={styles.playerName} numberOfLines={1}>
                    {myOwnRow.name} (you)
                  </Text>
                  <View
                    style={[
                      styles.playerSideBadge,
                      {
                        backgroundColor:
                          myOwnRow.side === "usc" ? USC_RED : UCLA_BLUE,
                      },
                    ]}
                  >
                    <Text style={styles.playerSideText}>
                      {myOwnRow.side === "usc" ? "USC" : "UCLA"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.playerWins,
                      {
                        color:
                          myOwnRow.side === "usc" ? USC_RED : UCLA_BLUE,
                      },
                    ]}
                  >
                    {myOwnRow.wins} {myOwnRow.wins === 1 ? "win" : "wins"}
                  </Text>
                </View>
                <Text style={styles.ghostCaption}>
                  Crack the top 100 to appear here.
                </Text>
              </View>
            )}
        </ScrollView>
      )}
    </View>
  );
}

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
    scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },

    // ── Section labels ───────────────────────────────────────
    sectionLabel: { fontSize: 12, fontWeight: "800", color: TEXT_SECONDARY, letterSpacing: 2, marginBottom: 10, marginTop: 6 },
    weeklyLabelRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 6, marginBottom: 10 },
    countdownInline: { fontSize: 11, fontWeight: "700", color: TEXT_SECONDARY, letterSpacing: 1.5 },

    // ── Tally Card ───────────────────────────────────────────
    tallyCard: { backgroundColor: BG_SURFACE, borderRadius: 18, padding: 22, marginBottom: 16 },
    tallyNumbers: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
    tallySchool: { flex: 1, alignItems: "center" },
    tallySchoolLabel: { fontSize: 13, fontWeight: "600", marginTop: 2 },
    tallyCount: { fontSize: 40, fontWeight: "900" },
    tallyVS: { fontSize: 18, fontWeight: "800", color: TEXT_SECONDARY, marginHorizontal: 12 },
    tallyBar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 14 },
    tallyBarUSC: { backgroundColor: USC_RED, minWidth: 4 },
    tallyBarUCLA: { backgroundColor: UCLA_BLUE, minWidth: 4 },
    tallyLeader: { fontSize: 14, fontWeight: "600", color: TEXT_SECONDARY, textAlign: "center" },

    // ── Players ──────────────────────────────────────────────
    playerRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
    },
    playerRowMe: {
      backgroundColor: accentBg(_s, 0.08),
      borderRadius: 10,
      paddingHorizontal: 8,
      marginHorizontal: -8,
      borderLeftWidth: 3,
      borderLeftColor: accentColor(_s),
    },
    rank: { fontSize: 14, fontWeight: "700", color: TEXT_SECONDARY, width: 30 },
    playerPhotoRing: {
      width: 38, height: 38, borderRadius: 19, borderWidth: 2,
      justifyContent: "center", alignItems: "center", marginRight: 10,
    },
    playerPhoto: { width: 32, height: 32, borderRadius: 16 },
    playerPhotoPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
    playerName: { fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY, flex: 1 },
    playerSideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginRight: 10 },
    playerSideText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
    playerWins: { fontSize: 14, fontWeight: "800" },

    emptyLeaderboard: { alignItems: "center", paddingVertical: 30, gap: 12 },
    emptyLeaderboardText: { fontSize: 14, color: TEXT_SECONDARY, textAlign: "center" },

    // ── Ghost row (unranked user — shown below the top 100) ──
    ghostSection: { marginTop: -8, marginBottom: 20 },
    ghostDivider: {
      alignItems: "center",
      paddingVertical: 10,
    },
    ghostDividerText: {
      fontSize: 20,
      color: "rgba(255,255,255,0.2)",
      letterSpacing: 4,
    },
    ghostRow: {
      opacity: 0.5,
      backgroundColor: BG_SURFACE,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.04)",
      borderStyle: "dashed",
    },
    ghostRank: {
      fontSize: 14,
      fontWeight: "700",
      color: "rgba(255,255,255,0.3)",
      width: 30,
    },
    ghostCaption: {
      fontSize: 12,
      color: TEXT_SECONDARY,
      textAlign: "center",
      marginTop: 12,
      fontStyle: "italic",
    },
  });
