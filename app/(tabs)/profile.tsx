// app/(tabs)/profile.tsx
// Profile tab — CrossTown player card.
// Modes: PLAYED (wins > 0) | FRESH (wins === 0) | EARLY (0 < wins < 3, win rate locked)
//
// Structure:
//   Header (Profile · gear)
//   Player Card (circular photo + side ring, name, side pill, major, year,
//                rank pill in top-right corner if ranked,
//                Preview + Edit inline at bottom)
//   Season Stats Row (Wins · Win Rate · Rank)  — OR — Fresh-user empty state card
//   Contribution Line (PLAYED/EARLY only)
//   Instagram Card
//   Log Out
//   Version footer
import { FontAwesome } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { accentBg, accentColor } from "../../utils/colors";
import { removePushToken } from "../../utils/pushNotifications";

const WIN_RATE_UNLOCK_AT = 3;
const INSTAGRAM_URL = "https://instagram.com/crosstownapp";
const INSTAGRAM_HANDLE = "@crosstownapp";

interface ProfileData {
  name: string;
  side: "usc" | "ucla";
  photos: string[];
  major: string;
  gradYear: string;
  wins: number;
  gamesPlayed: number; // total showdowns (for win rate)
  weeklyWins: number;
  weeklyWinsWeek: string | null;
  currentRank: number | null;
}

// Compute same ISO week key as the Cloud Function.
// Used to decide if weeklyWins is for this week or stale.
function getCurrentISOWeekKey(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    (((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(
      doc(db, "users", auth.currentUser.uid),
      (snap) => {
        if (!snap.exists()) {
          setLoading(false);
          return;
        }
        const data = snap.data();
        setProfile({
          name: data.name || "",
          side: data.side || "usc",
          photos: data.photos || [],
          major: data.major || "",
          gradYear: data.gradYear || "",
          wins: data.wins || 0,
          gamesPlayed: data.gamesPlayed || 0,
          weeklyWins: data.weeklyWins || 0,
          weeklyWinsWeek: data.weeklyWinsWeek || null,
          currentRank: data.currentRank ?? null,
        });
        setLoading(false);
      },
      (err) => {
        console.error("[Profile] listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const userSide = profile?.side || "usc";
  const styles = useMemo(() => createStyles(userSide), [userSide]);

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await removePushToken();
          } catch (e) {
            console.error("[Profile] Failed to remove push token:", e);
          }
          await signOut(auth);
          router.replace("/");
        },
      },
    ]);
  };

  if (loading || !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(userSide)} />
        </View>
      </View>
    );
  }

  const accent = accentColor(userSide);
  const sideName = profile.side === "usc" ? "USC" : "UCLA";
  const isFresh = profile.wins === 0 && profile.gamesPlayed === 0;
  const winRateLocked = profile.gamesPlayed < WIN_RATE_UNLOCK_AT;
  const winRate =
    profile.gamesPlayed > 0
      ? Math.round((profile.wins / profile.gamesPlayed) * 100)
      : 0;
  const isRanked = profile.currentRank !== null && profile.currentRank > 0;

  // Weekly wins are only valid if the stored week matches this week
  const currentWeekKey = getCurrentISOWeekKey();
  const validWeeklyWins =
    profile.weeklyWinsWeek === currentWeekKey ? profile.weeklyWins : 0;

  const mainPhoto = profile.photos[0];
  const appVersion = Constants.expoConfig?.version || "0.9.0";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          style={styles.gearButton}
          hitSlop={10}
          onPress={() => router.push("/profile/settings" as any)}
        >
          <FontAwesome name="cog" size={22} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─────────── PLAYER CARD ─────────── */}
        <View style={styles.playerCard}>
          {/* Rank pill (top-right corner) — only if ranked in top 100 */}
          {isRanked && (
            <Pressable
              style={styles.rankPill}
              onPress={() =>
                router.push("/(tabs)/scoreboard?scrollTo=me" as any)
              }
              hitSlop={6}
            >
              <Text style={styles.rankPillText}>#{profile.currentRank}</Text>
            </Pressable>
          )}

          <View style={styles.playerCardInner}>
            {/* Circular photo with school-color ring */}
            <View style={[styles.avatarRing, { borderColor: accent }]}>
              {mainPhoto ? (
                <Image source={{ uri: mainPhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <FontAwesome
                    name="camera"
                    size={20}
                    color="rgba(255,255,255,0.3)"
                  />
                </View>
              )}
            </View>

            {/* Name, side badge, major, year */}
            <View style={styles.playerCardInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {profile.name || "Your Name"}
                </Text>
                <View style={[styles.sidePill, { backgroundColor: accent }]}>
                  <Text style={styles.sidePillText}>
                    {profile.side === "usc" ? "TROJAN" : "BRUIN"}
                  </Text>
                </View>
              </View>
              <Text style={styles.playerMajor} numberOfLines={1}>
                {profile.major || "Set your major"}
              </Text>
              <Text style={styles.playerYear}>
                {profile.gradYear
                  ? profile.gradYear === "Graduate"
                    ? "Graduate"
                    : `Class of ${profile.gradYear}`
                  : "Set your class year"}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.playerCardDivider} />

          {/* Preview + Edit inline */}
          <View style={styles.playerCardActions}>
            <Pressable
              style={styles.playerCardAction}
              onPress={() => router.push("/profile/preview" as any)}
            >
              <FontAwesome
                name="eye"
                size={14}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.playerCardActionText}>Preview</Text>
            </Pressable>
            <View style={styles.actionDivider} />
            <Pressable
              style={styles.playerCardAction}
              onPress={() => router.push("/profile/edit" as any)}
            >
              <FontAwesome
                name="pencil"
                size={14}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.playerCardActionText}>Edit</Text>
            </Pressable>
          </View>
        </View>

        {/* ─────────── STATS ROW or EMPTY STATE ─────────── */}
        {isFresh ? (
          <View style={styles.emptyStateCard}>
            <Text style={[styles.emptyStateIcon, { color: accent }]}>⚔</Text>
            <Text style={styles.emptyStateTitle}>Your record starts here</Text>
            <Text style={styles.emptyStateBody}>
              Play your first showdown — wins, rank, and school contribution
              show up as you play.
            </Text>
            <Pressable
              style={[styles.emptyStateButton, { backgroundColor: accent }]}
              onPress={() => router.push("/(tabs)/duels" as any)}
            >
              <Text style={styles.emptyStateButtonText}>Challenge a rival →</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.statsCard}>
            {/* Wins */}
            <View style={styles.statCell}>
              <View style={styles.statValueRow}>
                <FontAwesome name="trophy" size={14} color={accent} />
                <Text style={styles.statValue}>{profile.wins}</Text>
              </View>
              <Text style={styles.statLabel}>Lifetime</Text>
            </View>

            <View style={styles.statDivider} />

            {/* Win Rate */}
            <View style={styles.statCell}>
              <Text
                style={
                  winRateLocked ? styles.statValueLocked : styles.statValue
                }
              >
                {winRateLocked ? "—" : `${winRate}%`}
              </Text>
              <Text style={styles.statLabel}>
                {winRateLocked
                  ? `${WIN_RATE_UNLOCK_AT - profile.gamesPlayed} more ${
                      WIN_RATE_UNLOCK_AT - profile.gamesPlayed === 1
                        ? "game"
                        : "games"
                    }`
                  : "Showdowns"}
              </Text>
            </View>

            <View style={styles.statDivider} />

            {/* Rank — tappable, routes to Scoreboard */}
            <Pressable
              style={styles.statCell}
              onPress={() =>
                router.push("/(tabs)/scoreboard?scrollTo=me" as any)
              }
            >
              <Text
                style={isRanked ? styles.statValue : styles.statValueLocked}
              >
                {isRanked ? `#${profile.currentRank}` : "—"}
              </Text>
              <Text style={styles.statLabel}>
                {isRanked ? "Overall" : "Unranked"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ─────────── CONTRIBUTION LINE ─────────── */}
        {!isFresh && (
          <View style={styles.contributionRow}>
            {validWeeklyWins > 0 ? (
              <Text style={styles.contributionText}>
                You've contributed{" "}
                <Text style={[styles.contributionNumber, { color: accent }]}>
                  {validWeeklyWins}
                </Text>{" "}
                {validWeeklyWins === 1 ? "win" : "wins"} to {sideName} this week.
              </Text>
            ) : (
              <Text style={styles.contributionText}>
                Haven't won for {sideName} this week yet —{" "}
                <Text
                  style={[styles.contributionLink, { color: accent }]}
                  onPress={() => router.push("/(tabs)/duels" as any)}
                >
                  get in the game →
                </Text>
              </Text>
            )}
          </View>
        )}

        {/* ─────────── INSTAGRAM CARD ─────────── */}
        <Pressable
          style={styles.igCard}
          onPress={() => Linking.openURL(INSTAGRAM_URL)}
        >
          <View style={styles.igStripe} />
          <View style={styles.igContent}>
            <FontAwesome name="instagram" size={22} color="#fff" />
            <View style={styles.igTextBlock}>
              <Text style={styles.igTitle}>Follow CrossTown</Text>
              <Text style={styles.igHandle}>{INSTAGRAM_HANDLE}</Text>
            </View>
          </View>
          <View style={styles.igButton}>
            <Text style={styles.igButtonText}>Follow</Text>
          </View>
        </Pressable>

        {/* ─────────── LOG OUT ─────────── */}
        <Pressable onPress={handleLogout} style={styles.logoutWrap}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        {/* ─────────── FOOTER ─────────── */}
        <Text style={styles.versionText}>CrossTown v{appVersion}</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (side: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F172A" },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
    gearButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 120,
    },

    // ─── Player Card ───
    playerCard: {
      backgroundColor: "#1E293B",
      borderRadius: 20,
      padding: 20,
      position: "relative",
    },
    playerCardInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    avatarRing: {
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 3,
      justifyContent: "center",
      alignItems: "center",
      padding: 2,
    },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: "#334155",
    },
    avatarEmpty: {
      justifyContent: "center",
      alignItems: "center",
    },
    playerCardInfo: {
      flex: 1,
      gap: 3,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 3,
    },
    playerName: {
      fontSize: 20,
      fontWeight: "800",
      color: "#fff",
      flexShrink: 1,
    },
    sidePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    sidePillText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 1,
    },
    playerMajor: {
      fontSize: 14,
      color: "rgba(255,255,255,0.55)",
    },
    playerYear: {
      fontSize: 14,
      color: "rgba(255,255,255,0.55)",
    },

    rankPill: {
      position: "absolute",
      top: 14,
      right: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    rankPillText: {
      fontSize: 12,
      fontWeight: "800",
      color: "rgba(255,255,255,0.7)",
      letterSpacing: 0.5,
    },

    playerCardDivider: {
      height: 1,
      backgroundColor: "rgba(255,255,255,0.06)",
      marginTop: 18,
      marginHorizontal: -20,
    },
    playerCardActions: {
      flexDirection: "row",
      marginTop: 6,
      marginHorizontal: -20,
      marginBottom: -14,
    },
    playerCardAction: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
    },
    playerCardActionText: {
      fontSize: 14,
      fontWeight: "600",
      color: "rgba(255,255,255,0.7)",
    },
    actionDivider: {
      width: 1,
      backgroundColor: "rgba(255,255,255,0.06)",
    },

    // ─── Empty State Card ───
    emptyStateCard: {
      backgroundColor: "#1E293B",
      borderRadius: 20,
      padding: 28,
      marginTop: 16,
      alignItems: "center",
    },
    emptyStateIcon: {
      fontSize: 36,
      fontWeight: "900",
      marginBottom: 12,
    },
    emptyStateTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: "#fff",
      marginBottom: 8,
    },
    emptyStateBody: {
      fontSize: 13,
      color: "rgba(255,255,255,0.5)",
      textAlign: "center",
      lineHeight: 19,
      marginBottom: 20,
    },
    emptyStateButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      alignSelf: "stretch",
      alignItems: "center",
    },
    emptyStateButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.3,
    },

    // ─── Stats Row ───
    statsCard: {
      backgroundColor: "#1E293B",
      borderRadius: 14,
      marginTop: 16,
      flexDirection: "row",
      paddingVertical: 16,
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    statValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statValue: {
      fontSize: 22,
      fontWeight: "800",
      color: "#fff",
    },
    statValueLocked: {
      fontSize: 22,
      fontWeight: "800",
      color: "rgba(255,255,255,0.25)",
    },
    statLabel: {
      fontSize: 11,
      color: "rgba(255,255,255,0.4)",
      textAlign: "center",
      paddingHorizontal: 4,
    },
    statDivider: {
      width: 1,
      backgroundColor: "rgba(255,255,255,0.06)",
      marginVertical: 4,
    },

    // ─── Contribution line ───
    contributionRow: {
      marginTop: 20,
      paddingHorizontal: 10,
    },
    contributionText: {
      fontSize: 14,
      color: "rgba(255,255,255,0.55)",
      textAlign: "center",
      lineHeight: 20,
    },
    contributionNumber: {
      fontWeight: "800",
    },
    contributionLink: {
      fontWeight: "700",
      textDecorationLine: "underline",
    },

    // ─── Instagram Card ───
    igCard: {
      backgroundColor: "#1E293B",
      borderRadius: 14,
      marginTop: 24,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      paddingVertical: 14,
      paddingHorizontal: 14,
      paddingLeft: 18,
    },
    igStripe: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: "#E1306C", // Instagram pink — single color, not gradient
    },
    igContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    igTextBlock: {
      gap: 1,
    },
    igTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: "#fff",
    },
    igHandle: {
      fontSize: 12,
      color: "rgba(255,255,255,0.5)",
    },
    igButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.1)",
    },
    igButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#fff",
    },

    // ─── Log Out ───
    logoutWrap: {
      marginTop: 36,
      alignItems: "center",
      paddingVertical: 12,
    },
    logoutText: {
      fontSize: 14,
      color: "#EF4444",
      fontWeight: "600",
    },

    // ─── Version footer ───
    versionText: {
      fontSize: 11,
      color: "rgba(255,255,255,0.15)",
      textAlign: "center",
      marginTop: 4,
    },
  });
