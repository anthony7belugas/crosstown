// app/profile/settings.tsx
// Settings — Account, Notifications, Privacy & Safety, About, Danger Zone
// Rewritten for CrossTown with full section structure + trademark disclaimer footer
import { FontAwesome } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet,
  Switch, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { accentBg, accentColor } from "../../utils/colors";
import { removePushToken } from "../../utils/pushNotifications";

const SUPPORT_EMAIL = "support@crosstownapp.com";

interface NotifPrefs {
  pushEnabled: boolean;
  showdowns: boolean;
  messages: boolean;
  challenges: boolean;
  scoreboardAlerts: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  pushEnabled: true,
  showdowns: true,
  messages: true,
  challenges: true,
  scoreboardAlerts: true,
};

function formatMemberSince(createdAt: any): string {
  if (!createdAt) return "—";
  try {
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [userSide, setUserSide] = useState<string>("usc");
  const [userEmail, setUserEmail] = useState<string>("");
  const [memberSince, setMemberSince] = useState<string>("—");
  const [photoCount, setPhotoCount] = useState<number>(0);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Live listener keeps toggles and counts in sync with Firestore
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
        if (data.side) setUserSide(data.side);
        setUserEmail(data.email || auth.currentUser?.email || "");
        setMemberSince(formatMemberSince(data.createdAt));
        setPhotoCount((data.photos || []).length);
        setBlockedCount((data.blockedUsers || []).length);

        const storedPrefs = data.notificationPrefs || {};
        setPrefs({
          pushEnabled: storedPrefs.pushEnabled !== false,
          showdowns: storedPrefs.showdowns !== false,
          messages: storedPrefs.messages !== false,
          challenges: storedPrefs.challenges !== false,
          scoreboardAlerts: storedPrefs.scoreboardAlerts !== false,
        });
        setLoading(false);
      },
      (err) => {
        console.error("[Settings] listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Write a single pref back to Firestore (merged)
  const updatePref = async (key: keyof NotifPrefs, value: boolean) => {
    if (!auth.currentUser) return;
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { notificationPrefs: { [key]: value } },
        { merge: true }
      );
    } catch (e) {
      console.error(`[Settings] Failed to update ${key}:`, e);
      setPrefs((p) => ({ ...p, [key]: !value }));
    }
  };

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
            console.error("[Settings] Failed to remove push token:", e);
          }
          await signOut(auth);
          router.replace("/");
        },
      },
    ]);
  };

  const accent = accentColor(userSide);
  const sideLabel = userSide === "usc" ? "USC" : "UCLA";
  const sideDot = userSide === "usc" ? "🔴" : "🔵";
  const appVersion = Constants.expoConfig?.version || "0.9.0";
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.expoConfig?.android?.versionCode ||
    "—";

  const subToggleDisabled = !prefs.pushEnabled;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="chevron-left" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─────────── ACCOUNT ─────────── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push("/profile/edit" as any)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="pencil" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Edit Profile</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
          <View style={styles.divider} />

          <Pressable
            style={styles.settingRow}
            onPress={() => router.push("/profile/photos" as any)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="camera" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Photos</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {photoCount} {photoCount === 1 ? "photo" : "photos"}
              </Text>
              <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
            </View>
          </Pressable>
          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="envelope-o" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Email</Text>
            </View>
            <Text style={styles.settingValueMuted} numberOfLines={1}>
              {userEmail}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="graduation-cap" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Side</Text>
            </View>
            <Text style={styles.settingValueMuted}>
              {sideLabel} {sideDot}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="calendar-o" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Member since</Text>
            </View>
            <Text style={styles.settingValueMuted}>{memberSince}</Text>
          </View>
        </View>

        {/* ─────────── NOTIFICATIONS ─────────── */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="bell" size={16} color={accent} />
              <Text style={styles.settingText}>Allow Notifications</Text>
            </View>
            <Switch
              value={prefs.pushEnabled}
              onValueChange={(v) => updatePref("pushEnabled", v)}
              trackColor={{ false: "#334155", true: accentBg(userSide, 0.3) }}
              thumbColor={prefs.pushEnabled ? accent : "#94A3B8"}
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { marginTop: 10, opacity: subToggleDisabled ? 0.4 : 1 },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="fire" size={16} color={accent} />
              <Text style={styles.settingText}>New showdowns</Text>
            </View>
            <Switch
              value={prefs.showdowns && prefs.pushEnabled}
              onValueChange={(v) => updatePref("showdowns", v)}
              disabled={subToggleDisabled}
              trackColor={{ false: "#334155", true: accentBg(userSide, 0.3) }}
              thumbColor={
                prefs.showdowns && prefs.pushEnabled ? accent : "#94A3B8"
              }
            />
          </View>
          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="comment" size={16} color={accent} />
              <Text style={styles.settingText}>Messages</Text>
            </View>
            <Switch
              value={prefs.messages && prefs.pushEnabled}
              onValueChange={(v) => updatePref("messages", v)}
              disabled={subToggleDisabled}
              trackColor={{ false: "#334155", true: accentBg(userSide, 0.3) }}
              thumbColor={
                prefs.messages && prefs.pushEnabled ? accent : "#94A3B8"
              }
            />
          </View>
          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={[styles.swordIcon, { color: accent }]}>⚔</Text>
              <Text style={styles.settingText}>New challenges</Text>
            </View>
            <Switch
              value={prefs.challenges && prefs.pushEnabled}
              onValueChange={(v) => updatePref("challenges", v)}
              disabled={subToggleDisabled}
              trackColor={{ false: "#334155", true: accentBg(userSide, 0.3) }}
              thumbColor={
                prefs.challenges && prefs.pushEnabled ? accent : "#94A3B8"
              }
            />
          </View>
          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="trophy" size={16} color={accent} />
              <Text style={styles.settingText}>Scoreboard alerts</Text>
            </View>
            <Switch
              value={prefs.scoreboardAlerts && prefs.pushEnabled}
              onValueChange={(v) => updatePref("scoreboardAlerts", v)}
              disabled={subToggleDisabled}
              trackColor={{ false: "#334155", true: accentBg(userSide, 0.3) }}
              thumbColor={
                prefs.scoreboardAlerts && prefs.pushEnabled ? accent : "#94A3B8"
              }
            />
          </View>
        </View>

        {/* ─────────── PRIVACY & SAFETY ─────────── */}
        <Text style={styles.sectionLabel}>Privacy & Safety</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push("/legal/guidelines" as any)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="shield" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Community Guidelines</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
          <View style={styles.divider} />

          <Pressable
            style={styles.settingRow}
            onPress={() => router.push("/profile/blocked" as any)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="ban" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Blocked Users</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{blockedCount}</Text>
              <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
            </View>
          </Pressable>
        </View>

        {/* ─────────── ABOUT ─────────── */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push("/legal/terms" as any)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="file-text-o" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Terms of Service</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
          <View style={styles.divider} />

          <Pressable
            style={styles.settingRow}
            onPress={() => router.push("/legal/privacy" as any)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="shield" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
          <View style={styles.divider} />

          <Pressable
            style={styles.settingRow}
            onPress={() =>
              Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=CrossTown%20Support`)
            }
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="envelope-o" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Contact Support</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
        </View>

        {/* ─────────── DANGER ZONE ─────────── */}
        <View style={[styles.card, { marginTop: 32 }]}>
          <Pressable style={styles.settingRow} onPress={handleLogout}>
            <View style={styles.settingLeft}>
              <FontAwesome name="sign-out" size={16} color="#EF4444" />
              <Text style={[styles.settingText, { color: "#EF4444" }]}>Log Out</Text>
            </View>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push("/profile/deleteAccount" as any)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="trash" size={16} color="#EF4444" />
              <Text style={[styles.settingText, { color: "#EF4444" }]}>
                Delete Account
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(239,68,68,0.3)" />
          </Pressable>
        </View>

        {/* ─────────── FOOTER ─────────── */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>CrossTown v{appVersion}</Text>
          <Text style={styles.buildText}>Build {buildNumber} · iOS</Text>
          <Text style={styles.disclaimerText}>
            Not affiliated with USC or UCLA.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 24,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexShrink: 1,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingText: { fontSize: 16, fontWeight: "500", color: "#fff" },
  settingValue: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  settingValueMuted: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    maxWidth: 200,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginLeft: 48,
  },
  swordIcon: {
    fontSize: 18,
    fontWeight: "700",
    width: 16,
    textAlign: "center",
  },
  footer: {
    marginTop: 32,
    alignItems: "center",
  },
  versionText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
  },
  buildText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    marginTop: 2,
  },
  disclaimerText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    marginTop: 14,
    textAlign: "center",
  },
});
