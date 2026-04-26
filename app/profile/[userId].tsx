// app/profile/[userId].tsx
// View another user's profile — read-only with block/report
// Adapted from Besties [userId].tsx for CrossTown rivalry framing

import { FontAwesome } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlockModal } from "../../components/BlockModal";
import { MoreOptionsMenu } from "../../components/MoreOptionsMenu";
import { ReportModal } from "../../components/ReportModal";
import { auth, db } from "../../firebaseConfig";
import {
  blockUser,
  reportUser,
  ReportReason,
} from "../../utils/blockUtils";
import {
  accentBg,
  accentColor,
  schoolColor,
  BG_PRIMARY,
  BG_SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../../utils/colors";
import { setCachedProfile } from "../../utils/userProfileCache";

interface UserProfile {
  uid: string;
  name: string;
  side: "usc" | "ucla";
  photos: string[];
  major: string;
  gradYear: string;
}

export default function UserProfilePage() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAccountDeleted, setIsAccountDeleted] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Showdown check — if they share one, show a "Message" button
  const [showdownId, setShowdownId] = useState<string | null>(null);

  // Block / Report state
  const [showOptions, setShowOptions] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const isOwnProfile = auth.currentUser?.uid === userId;
  const side = profile?.side || "usc";

  useEffect(() => {
    if (userId) {
      loadProfile();
      checkSharedShowdown();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId as string));
      if (userDoc.exists()) {
        const data = userDoc.data();

        if (data.accountStatus === "deleted") {
          setIsAccountDeleted(true);
          setLoading(false);
          return;
        }

        setProfile({
          uid: userId as string,
          name: data.name || "Unknown",
          side: data.side || "usc",
          photos: data.photos || [],
          major: data.major || "",
          gradYear: data.gradYear || "",
        });

        // Cache for use elsewhere
        setCachedProfile(userId as string, {
          name: data.name || "Unknown",
          photo: data.photos?.[0],
          major: data.major,
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkSharedShowdown = async () => {
    try {
      if (!auth.currentUser) return;
      const uid = auth.currentUser.uid;

      const q = query(
        collection(db, "showdowns"),
        where("users", "array-contains", uid)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data();
        if (data.users && data.users.includes(userId as string)) {
          setShowdownId(d.id);
          return;
        }
      }
    } catch (error) {
      console.error("Error checking showdowns:", error);
    }
  };

  // ── Photo navigation ──
  const nextPhoto = () => {
    if (profile && currentPhotoIndex < profile.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };
  const prevPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  // ── Block / Report handlers ──
  const handleBlock = async () => {
    if (!userId) return;
    setBlockLoading(true);
    try {
      await blockUser(userId as string);
      setShowBlockModal(false);
      router.back();
    } catch (error) {
      console.error("Error blocking user:", error);
      Alert.alert("Error", "Failed to block user. Please try again.");
    } finally {
      setBlockLoading(false);
    }
  };

  const handleReport = async (reason: ReportReason, description?: string) => {
    if (!userId) return;
    setReportLoading(true);
    try {
      await reportUser({ reportedId: userId as string, reason, description });
      setShowReportModal(false);
      Alert.alert("Report Submitted", "Thanks for helping keep CrossTown safe.");
    } catch (error) {
      console.error("Error reporting user:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={TEXT_SECONDARY} />
      </View>
    );
  }

  if (isAccountDeleted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={20} color={TEXT_PRIMARY} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.emptyState}>
          <FontAwesome name="user-times" size={48} color={TEXT_SECONDARY} />
          <Text style={styles.emptyTitle}>Account Deleted</Text>
          <Text style={styles.emptyMessage}>This account is no longer available.</Text>
          <Pressable style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>User not found</Text>
          <Pressable style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const sColor = schoolColor(side);
  const sideName = side === "usc" ? "USC" : "UCLA";

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color={TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        {!isOwnProfile ? (
          <Pressable style={styles.headerBtn} onPress={() => setShowOptions(true)}>
            <FontAwesome name="ellipsis-v" size={20} color={TEXT_PRIMARY} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile card — matches CrossTown's own profile card design */}
        <View style={styles.profileCard}>
          {/* Photo gallery */}
          {profile.photos.length > 0 ? (
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: profile.photos[currentPhotoIndex] }}
                style={styles.profilePhoto}
              />
              {profile.photos.length > 1 && (
                <View style={styles.photoIndicators}>
                  {profile.photos.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.indicator, i === currentPhotoIndex && styles.indicatorActive]}
                    />
                  ))}
                </View>
              )}
              {profile.photos.length > 1 && (
                <>
                  <Pressable style={styles.photoNavLeft} onPress={prevPhoto} />
                  <Pressable style={styles.photoNavRight} onPress={nextPhoto} />
                </>
              )}
            </View>
          ) : (
            <View style={styles.noPhotoContainer}>
              <FontAwesome name="user" size={60} color="rgba(255,255,255,0.15)" />
            </View>
          )}

          {/* Info */}
          <View style={styles.profileInfo}>
            <View style={[styles.sideBadge, { backgroundColor: sColor }]}>
              <Text style={styles.sideBadgeText}>{sideName}</Text>
            </View>
            <Text style={styles.profileName}>
              {profile.name}
            </Text>
            <Text style={styles.profileDetails}>
              {profile.major}{profile.gradYear ? ` • ${profile.gradYear === "Graduate" ? "Graduate" : `Class of ${profile.gradYear}`}` : ""}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        {!isOwnProfile && (
          <View style={styles.actions}>
            {showdownId ? (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: accentColor(side) }]}
                onPress={() => router.push(`/chat/${showdownId}` as any)}
              >
                <FontAwesome name="comment" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Message Rival</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Block / Report modals */}
      <MoreOptionsMenu
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        onBlock={() => setShowBlockModal(true)}
        onReport={() => setShowReportModal(true)}
      />
      <BlockModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onBlock={handleBlock}
        userName={profile.name}
        loading={blockLoading}
      />
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        userName={profile.name}
        loading={reportLoading}
      />
    </View>
  );
}

// ══════════════════════════════════════════
//  STYLES — matches CrossTown dark theme
// ══════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PRIMARY },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG_PRIMARY },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 14,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: TEXT_PRIMARY },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },

  // Profile card — reuses CrossTown profile.tsx design
  profileCard: {
    backgroundColor: BG_SURFACE,
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
  photoNavLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "40%" },
  photoNavRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "40%" },
  noPhotoContainer: {
    width: "100%",
    aspectRatio: 1.2,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },

  // Profile info
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

  // Action buttons
  actions: { gap: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  // Empty / error states
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  goBackBtn: {
    backgroundColor: BG_SURFACE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goBackText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: "600" },
});
