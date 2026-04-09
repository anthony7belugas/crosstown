// app/profile/settings.tsx
// Settings — adapted from Besties settings.tsx
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { deleteUser, signOut } from "firebase/auth";
import {
  collection, deleteDoc, doc, getDocs, query, where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { ACCENT, ACCENT_TRACK } from "../../utils/colors";


interface BlockedUser {
  uid: string;
  name: string;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifMatches, setNotifMatches] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifLikes, setNotifLikes] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    if (!auth.currentUser) return;
    try {
      const userDoc = await getDocs(
        query(collection(db, "users"), where("__name__", "==", auth.currentUser.uid))
      );
      // For now, just show count from the blockedUsers array
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account, all matches, messages, and data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmDelete(),
        },
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      "Are you absolutely sure?",
      "Type DELETE in the next prompt to confirm.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delete Everything",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              if (!auth.currentUser) return;
              // Delete user doc
              await deleteDoc(doc(db, "users", auth.currentUser.uid));
              // Delete Firebase Auth account
              await deleteUser(auth.currentUser);
              router.replace("/");
            } catch (error: any) {
              if (error.code === "auth/requires-recent-login") {
                Alert.alert(
                  "Re-authentication Required",
                  "Please log out, log back in, and try again."
                );
              } else {
                Alert.alert("Error", "Failed to delete account. Please try again.");
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
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
              <FontAwesome name="fire" size={16} color={ACCENT} />
              <Text style={styles.settingText}>New matches</Text>
            </View>
            <Switch
              value={notifMatches}
              onValueChange={setNotifMatches}
              trackColor={{ false: "#334155", true: ACCENT_TRACK }}
              thumbColor={notifMatches ? ACCENT : "#94A3B8"}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="comment" size={16} color={ACCENT} />
              <Text style={styles.settingText}>Messages</Text>
            </View>
            <Switch
              value={notifMessages}
              onValueChange={setNotifMessages}
              trackColor={{ false: "#334155", true: ACCENT_TRACK }}
              thumbColor={notifMessages ? ACCENT : "#94A3B8"}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="heart" size={16} color={ACCENT} />
              <Text style={styles.settingText}>Someone liked you</Text>
            </View>
            <Switch
              value={notifLikes}
              onValueChange={setNotifLikes}
              trackColor={{ false: "#334155", true: ACCENT_TRACK }}
              thumbColor={notifLikes ? ACCENT : "#94A3B8"}
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
          <Pressable style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <FontAwesome name="file-text-o" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.settingText}>Terms of Service</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.settingRow}>
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
          <Pressable style={styles.settingRow}>
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
          <Pressable style={styles.settingRow} onPress={handleDeleteAccount}>
            <View style={styles.settingLeft}>
              <FontAwesome name="trash" size={16} color="#EF4444" />
              <Text style={[styles.settingText, { color: "#EF4444" }]}>
                {deleting ? "Deleting..." : "Delete Account"}
              </Text>
            </View>
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
