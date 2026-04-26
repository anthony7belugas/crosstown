// app/profile/preview.tsx
// Preview — shows the user's own profile exactly as rivals see it in Duels.
// The Challenge button is grayed (non-tappable) because it's a preview,
// and it's rendered in the RIVAL's school color (simulating how it would
// appear on the other side's screen).
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Dimensions, Image, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { rivalColor, schoolColor } from "../../utils/colors";

const { width, height } = Dimensions.get("window");

interface UserData {
  name: string;
  side: "usc" | "ucla";
  photos: string[];
  major: string;
  gradYear: string;
}

export default function PreviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        return;
      }
      const data = snap.data();
      setUser({
        name: data.name || "",
        side: data.side || "usc",
        photos: data.photos || [],
        major: data.major || "",
        gradYear: data.gradYear || "",
      });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading || !user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="chevron-left" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#94A3B8" />
        </View>
      </View>
    );
  }

  const mySideColor = schoolColor(user.side);
  const rivalSideColor = rivalColor(user.side);
  const sideName = user.side === "usc" ? "USC" : "UCLA";

  const handlePhotoTap = (direction: "left" | "right") => {
    if (user.photos.length <= 1) return;
    if (direction === "left") {
      setPhotoIndex((i) => Math.max(0, i - 1));
    } else {
      setPhotoIndex((i) => Math.min(user.photos.length - 1, i + 1));
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Preview</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.subtitle}>
        This is how rivals see you in Duels.
      </Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* The card — pixel-identical to the Duels card */}
        <View style={styles.card}>
          {/* Photo */}
          {user.photos.length > 0 ? (
            <Image
              source={{ uri: user.photos[photoIndex] }}
              style={styles.cardImage}
            />
          ) : (
            <View style={[styles.cardImage, styles.emptyPhoto]}>
              <FontAwesome name="camera" size={40} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyPhotoText}>No photos yet</Text>
            </View>
          )}
          <Pressable
            style={styles.photoTapLeft}
            onPress={() => handlePhotoTap("left")}
          />
          <Pressable
            style={styles.photoTapRight}
            onPress={() => handlePhotoTap("right")}
          />

          {/* Photo indicators */}
          {user.photos.length > 1 && (
            <View style={styles.photoIndicators}>
              {user.photos.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.indicator,
                    i === photoIndex && styles.indicatorActive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Info overlay on photo */}
          <View style={styles.cardOverlay}>
            <View style={styles.cardInfoRow}>
              <Text style={styles.cardName}>{user.name}.</Text>
              <View style={[styles.sideBadge, { backgroundColor: mySideColor }]}>
                <Text style={styles.sideBadgeText}>{sideName}</Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {user.major}
              {user.gradYear
                ? ` · ${user.gradYear === "Graduate" ? "Graduate" : `Class of ${user.gradYear}`}`
                : ""}
            </Text>
          </View>

          {/* Disabled Challenge button (below photo) */}
          <View style={styles.cardBottom}>
            {/* Grayed Challenge button — rival's color, non-tappable */}
            <View
              style={[
                styles.challengeButton,
                { backgroundColor: rivalSideColor, opacity: 0.5 },
              ]}
            >
              <Text style={styles.challengeButtonText}>⚔ Challenge</Text>
            </View>
          </View>
        </View>

        {/* Dot indicators below card */}
        {user.photos.length > 1 && (
          <View style={styles.dotsBelow}>
            {user.photos.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dotBelow,
                  {
                    backgroundColor:
                      i === photoIndex ? mySideColor : "rgba(255,255,255,0.25)",
                  },
                ]}
              />
            ))}
          </View>
        )}

        <Text style={styles.previewNote}>
          Preview only — the Challenge button is disabled because this is
          your own card.
        </Text>

        {/* Edit Profile shortcut */}
        <Pressable
          style={styles.editButton}
          onPress={() => router.replace("/profile/edit" as any)}
        >
          <FontAwesome name="pencil" size={14} color={mySideColor} />
          <Text style={[styles.editButtonText, { color: mySideColor }]}>
            Edit Profile
          </Text>
        </Pressable>
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
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    alignItems: "center",
  },

  // Card (matches Duels card)
  card: {
    width: width - 32,
    maxHeight: height * 0.68,
    minHeight: 500,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1E293B",
  },
  cardImage: {
    width: "100%",
    height: "70%",
    backgroundColor: "#334155",
  },
  emptyPhoto: {
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyPhotoText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
  },
  photoTapLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "40%",
    height: "60%",
  },
  photoTapRight: {
    position: "absolute",
    right: 0,
    top: 0,
    width: "40%",
    height: "60%",
  },
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
  cardOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "30%",
    padding: 20,
    paddingTop: 50,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  cardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  cardName: { fontSize: 26, fontWeight: "800", color: "#fff" },
  sideBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sideBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  cardMeta: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  cardBottom: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: "center",
  },
  cardBio: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 20,
    marginBottom: 14,
    fontStyle: "italic",
  },
  challengeButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  challengeButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },

  // Dots below card (matches Duels)
  dotsBelow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    justifyContent: "center",
  },
  dotBelow: { width: 6, height: 6, borderRadius: 3 },

  previewNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    marginTop: 22,
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  editButton: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
