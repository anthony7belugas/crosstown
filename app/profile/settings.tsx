// app/profile/settings.tsx
// Settings — notification prefs wired to Firestore, legal links, push token cleared on logout
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { accentColor, accentBg } from "../../utils/colors";
import { removePushToken } from "../../utils/pushNotifications";

const SUPPORT_EMAIL = "support@crosstownapp.com";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifShowdowns, setNotifShowdowns] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifChallenges, setNotifChallenges] = useState(true);
  const [userSide, setUserSide] = useState<string>("usc");

  // ─── Load user data + notification prefs on mount ───────────
  useEffect(() => {
    const loadUserData = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (!snap.exists()) return;
        const data = snap.data();

        // Side for accent colors
        if (data.side) setUserSide(data.side);

        // Notification preferences — default to true if not set
        const prefs = data.notificationPrefs || {};
        setNotifShowdowns(prefs.showdowns !== false);
        setNotifMessages(prefs.messages !== false);
        setNotifChallenges(prefs.challenges !== false);
      } catch (e) {
        console.error("[Settings] Failed to load user data:", e);
      }
    };
    loadUserData();
  }, []);

  // ─── Write a single notification pref back to Firestore ─────
  const updateNotifPref = async (
    key: "showdowns" | "messages" | "challenges",
    value: boolean
  ) => {
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { notificationPrefs: { [key]: value } },
        { merge: true }
      );
    } catch (e) {
      console.error(`[Settings] Failed to update ${key}:`, e);
    }
  };

  const toggleShowdowns = (v: boolean) => {
    setNotifShowdowns(v);
    updateNotifPref("showdowns", v);
  };
  const toggleMessages = (v: boolean) => {
    setNotifMessages(v);
    updateNotifPref("messages", v);
  };
  const toggleChallenges = (v: boolean) => {
    setNotifChallenges(v);
    updateNotifPref("challenges", v);
  };

  // ─── Logout — clear push token first ───────────────────────
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
        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="fire" size={16} color={accentColor(userSide)} />
              <Text style={styles.settingText}>New showdowns</Text>
            </View>
            <Switch
              value={notifShowdowns}
              onValueChange={toggleShowdowns}
              trackColor={{ false: "#334155", true: accentBg(userSide, 0.3) }}
              thumbColor={notifShowdowns ? accentColor(userSide) : "#94A3B8"}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="comment" size={16} color={accentColor(userSide)} />
              <Text style={styles.settingText}>Messages</Text>
            </View>
            <Switch
              value={notifMessages}
              onValueChange={toggleMessages}
              trackColor={{ false: "#334155", true: accentBg(userSide, 0.3) }}
              thumbColor={notifMessages ? accentColor(userSide) : "#94A3B8"}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="bolt" size={16} color={accentColor(userSide)} />
              <Text style={styles.settingText}>New challenges</Text>
            </View>
            <Switch
              value={notifChallenges}
              onValueChange={toggleChallenges}
              trackColor={{ false: "#334155", true: accentBg(userSide, 0.3) }}
              thumbColor={notifChallenges ? accentColor(userSide) : "#94A3B8"}
            />
          </View>
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push("/profile/blocked" as any)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="ban" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Blocked Users</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
        </View>

        {/* Legal */}
        <Text style={styles.sectionLabel}>Legal</Text>
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
        </View>

        {/* Support */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=CrossTown%20Support`
              )
            }
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="envelope-o" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Contact Us</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
        </View>

        {/* Danger zone */}
        <View style={[styles.card, { marginTop: 24 }]}>
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
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
        </View>

        <Text style={styles.versionText}>CrossTown v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
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
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  settingText: { fontSize: 16, fontWeight: "500", color: "#fff" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginLeft: 48 },
  versionText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.15)",
    textAlign: "center",
    marginTop: 32,
  },
});
