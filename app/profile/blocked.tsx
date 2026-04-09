// app/profile/blocked.tsx
// Blocked users list — adapted from Besties blockedUsers.tsx
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { unblockUser } from "../../utils/blockUtils";

const GOLD = "#FFD100";
const CARDINAL = "#9B1B30";
const BRUIN_BLUE = "#2774AE";

interface BlockedUser {
  uid: string;
  name: string;
  photo: string;
  side: "usc" | "ucla";
}

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to current user's blocked list
    const unsub = onSnapshot(
      doc(db, "users", auth.currentUser.uid),
      async (snapshot) => {
        if (!snapshot.exists()) {
          setLoading(false);
          return;
        }

        const userData = snapshot.data();
        const blockedIds: string[] = userData.blockedUsers || [];

        if (blockedIds.length === 0) {
          setBlockedUsers([]);
          setLoading(false);
          return;
        }

        // Fetch blocked user profiles
        const users: BlockedUser[] = [];
        for (const uid of blockedIds) {
          try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              users.push({
                uid,
                name: data.name || "Unknown",
                photo: data.photos?.[0] || "",
                side: data.side || "usc",
              });
            } else {
              users.push({
                uid,
                name: "Deleted User",
                photo: "",
                side: "usc",
              });
            }
          } catch (e) {
            console.error("Error fetching blocked user:", e);
          }
        }

        setBlockedUsers(users);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock ${user.name}? They will be able to see your profile again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setUnblocking(user.uid);
            try {
              await unblockUser(user.uid);
            } catch (e) {
              console.error("Error unblocking:", e);
              Alert.alert("Error", "Failed to unblock user.");
            } finally {
              setUnblocking(null);
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
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <FontAwesome name="check-circle" size={40} color="rgba(16,185,129,0.6)" />
          </View>
          <Text style={styles.emptyTitle}>No Blocked Users</Text>
          <Text style={styles.emptySubtitle}>
            You haven't blocked anyone yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const sideColor = item.side === "usc" ? CARDINAL : BRUIN_BLUE;
            return (
              <View style={styles.userRow}>
                <View style={styles.userLeft}>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.userPhoto} />
                  ) : (
                    <View style={[styles.userPhoto, styles.userPhotoPlaceholder]}>
                      <FontAwesome name="user" size={18} color="rgba(255,255,255,0.2)" />
                    </View>
                  )}
                  <View>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={[styles.userSide, { color: sideColor }]}>
                      {item.side.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.unblockButton}
                  onPress={() => handleUnblock(item)}
                  disabled={unblocking === item.uid}
                >
                  {unblocking === item.uid ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.unblockText}>Unblock</Text>
                  )}
                </Pressable>
              </View>
            );
          }}
        />
      )}
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
    backgroundColor: "rgba(16,185,129,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 8 },
  emptySubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  userLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  userPhoto: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1E293B" },
  userPhotoPlaceholder: { justifyContent: "center", alignItems: "center" },
  userName: { fontSize: 16, fontWeight: "600", color: "#fff" },
  userSide: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 2 },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
  },
  unblockText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
