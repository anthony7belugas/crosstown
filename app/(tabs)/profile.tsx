// app/(tabs)/profile.tsx
// Profile tab — user's profile as others see it, likes counter, edit, settings
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection, doc, getDocs, onSnapshot, query, where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";

const GOLD = "#FFD100";
const CARDINAL = "#9B1B30";
const BRUIN_BLUE = "#2774AE";

interface UserData {
  name: string;
  age: number;
  side: "usc" | "ucla";
  gender: string;
  photos: string[];
  major: string;
  gradYear: string;
  bio: string;
  email: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [matchesCount, setMatchesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Real-time user data listener
    const unsub = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserData({
          name: data.name || "",
          age: data.age || 0,
          side: data.side || "usc",
          gender: data.gender || "",
          photos: data.photos || [],
          major: data.major || "",
          gradYear: data.gradYear || "",
          bio: data.bio || "",
          email: data.email || auth.currentUser?.email || "",
        });
      }
      setLoading(false);
    });

    // Count likes received
    const loadLikes = async () => {
      try {
        const likesSnap = await getDocs(
          query(collection(db, "likes"), where("toUserId", "==", uid))
        );
        setLikesCount(likesSnap.size);
      } catch (e) {
        console.error("Error loading likes:", e);
      }
    };

    // Count matches
    const loadMatches = async () => {
      try {
        const matchesSnap = await getDocs(
          query(collection(db, "matches"), where("users", "array-contains", uid))
        );
        setMatchesCount(matchesSnap.size);
      } catch (e) {
        console.error("Error loading matches:", e);
      }
    };

    loadLikes();
    loadMatches();
    return () => unsub();
  }, []);

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

  const sideColor = userData?.side === "usc" ? CARDINAL : BRUIN_BLUE;
  const sideName = userData?.side === "usc" ? "USC" : "UCLA";

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push("/profile/settings" as any)}
        >
          <FontAwesome name="cog" size={22} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Likes counter card */}
        <Pressable style={styles.likesCard}>
          <View style={styles.likesLeft}>
            <FontAwesome name="heart" size={22} color={GOLD} />
            <View>
              <Text style={styles.likesCount}>{likesCount}</Text>
              <Text style={styles.likesLabel}>rivals liked you</Text>
            </View>
          </View>
          <View style={styles.blurredGrid}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.blurredThumb}>
                <FontAwesome name="user" size={14} color="rgba(255,255,255,0.1)" />
              </View>
            ))}
          </View>
        </Pressable>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{matchesCount}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{likesCount}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
        </View>

        {/* Profile card preview */}
        <View style={styles.profileCard}>
          {/* Photo */}
          {userData?.photos && userData.photos.length > 0 ? (
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: userData.photos[currentPhotoIndex] }}
                style={styles.profilePhoto}
              />
              {userData.photos.length > 1 && (
                <View style={styles.photoIndicators}>
                  {userData.photos.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.indicator,
                        i === currentPhotoIndex && styles.indicatorActive,
                      ]}
                    />
                  ))}
                </View>
              )}
              {userData.photos.length > 1 && (
                <>
                  <Pressable
                    style={styles.photoNavLeft}
                    onPress={() =>
                      setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1))
                    }
                  />
                  <Pressable
                    style={styles.photoNavRight}
                    onPress={() =>
                      setCurrentPhotoIndex(
                        Math.min(userData.photos.length - 1, currentPhotoIndex + 1)
                      )
                    }
                  />
                </>
              )}
            </View>
          ) : (
            <View style={styles.noPhotoContainer}>
              <FontAwesome name="camera" size={40} color="rgba(255,255,255,0.2)" />
            </View>
          )}

          {/* Info overlay */}
          <View style={styles.profileInfo}>
            <View style={[styles.sideBadge, { backgroundColor: sideColor }]}>
              <Text style={styles.sideBadgeText}>{sideName}</Text>
            </View>
            <Text style={styles.profileName}>
              {userData?.name}, {userData?.age}
            </Text>
            <Text style={styles.profileDetails}>
              {userData?.major} • Class of {userData?.gradYear}
            </Text>
            {userData?.bio ? (
              <Text style={styles.profileBio}>{userData.bio}</Text>
            ) : null}
          </View>

          {/* Edit button */}
          <Pressable
            style={styles.editButton}
            onPress={() => router.push("/profile/edit" as any)}
          >
            <FontAwesome name="pencil" size={14} color={GOLD} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsSection}>
          <Pressable
            style={styles.actionRow}
            onPress={() => router.push("/profile/settings" as any)}
          >
            <View style={styles.actionLeft}>
              <FontAwesome name="cog" size={18} color="rgba(255,255,255,0.5)" />
              <Text style={styles.actionText}>Settings</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </Pressable>

          <Pressable style={styles.actionRow} onPress={handleLogout}>
            <View style={styles.actionLeft}>
              <FontAwesome name="sign-out" size={18} color="#EF4444" />
              <Text style={[styles.actionText, { color: "#EF4444" }]}>Log Out</Text>
            </View>
          </Pressable>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },

  // Likes card
  likesCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,209,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,209,0,0.12)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  likesLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  likesCount: { fontSize: 28, fontWeight: "900", color: GOLD },
  likesLabel: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: -2 },
  blurredGrid: { flexDirection: "row", gap: 6 },
  blurredThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  // Profile card
  profileCard: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
  photoContainer: { width: "100%", aspectRatio: 0.8, position: "relative" },
  profilePhoto: { width: "100%", height: "100%", backgroundColor: "#334155" },
  photoIndicators: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 4,
  },
  indicator: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
  },
  indicatorActive: { backgroundColor: "#fff" },
  photoNavLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "40%",
  },
  photoNavRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "40%",
  },
  noPhotoContainer: {
    width: "100%",
    aspectRatio: 1.2,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: { padding: 20 },
  sideBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  sideBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  profileName: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 4 },
  profileDetails: { fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 8 },
  profileBio: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 21,
    marginTop: 4,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  editButtonText: { fontSize: 15, fontWeight: "600", color: GOLD },

  // Actions
  actionsSection: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  actionText: { fontSize: 16, fontWeight: "500", color: "#fff" },
});
