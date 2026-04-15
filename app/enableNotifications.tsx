// app/enableNotifications.tsx
// FIX #3: Falls back to reading side from Firestore instead of hardcoded "usc"
//         (the old `side || "usc"` was wrong for every UCLA user whose param dropped)
import { FontAwesome } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";
import { registerForPushNotifications } from "../utils/pushNotifications";
import { accentColor, accentBg } from "../utils/colors";

export default function EnableNotificationsScreen() {
  const { side: paramSide } = useLocalSearchParams<{ side: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const bellScale = new Animated.Value(1);

  // ── FIX #3: Resolve side from param, then Firestore fallback ──
  const [side, setSide] = useState(paramSide || "usc");
  useEffect(() => {
    if (!paramSide && auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
        const s = snap.data()?.side;
        if (s) setSide(s);
      }).catch(() => {});
    }
  }, []);

  // If permissions already granted on mount, mark shown and skip straight through
  React.useEffect(() => {
    async function checkExisting() {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        await markShownAndNavigate();
      }
    }
    checkExisting();
  }, []);

  // Pulse animation for bell
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bellScale, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(bellScale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Shared exit — always writes notificationPromptShown before leaving
  const markShownAndNavigate = async () => {
    if (auth.currentUser) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        notificationPromptShown: true,
      });
    }
    router.replace("/(tabs)/duels");
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      await registerForPushNotifications();
    } catch (e) {
      console.error("Error enabling notifications:", e);
    } finally {
      setLoading(false);
      await markShownAndNavigate();
    }
  };

  const handleSkip = async () => {
    await markShownAndNavigate();
  };

  const styles = createStyles(side);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: bellScale }] }]}>
          <FontAwesome name="bell" size={48} color={accentColor(side)} />
        </Animated.View>

        <Text style={styles.title}>Stay in the Game</Text>
        <Text style={styles.subtitle}>
          Get notified when a rival challenges you, when they accept your
          challenge, and when they message you.
        </Text>

        <View style={styles.previewList}>
          <View style={styles.previewItem}>
            <Text style={styles.previewEmoji}>⚔️</Text>
            <Text style={styles.previewText}>"A Bruin just challenged you"</Text>
          </View>
          <View style={styles.previewItem}>
            <Text style={styles.previewEmoji}>🏆</Text>
            <Text style={styles.previewText}>"Your rival played their turn"</Text>
          </View>
          <View style={styles.previewItem}>
            <Text style={styles.previewEmoji}>💬</Text>
            <Text style={styles.previewText}>New message from your rival</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <Pressable style={styles.enableButton} onPress={handleEnable} disabled={loading}>
          <FontAwesome name="bell" size={18} color="#1E293B" />
          <Text style={styles.enableText}>{loading ? "Setting up..." : "Enable Notifications"}</Text>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Maybe Later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (_s: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "space-between",
    paddingHorizontal: 32,
  },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: accentBg(_s, 0.08),
    borderWidth: 2,
    borderColor: accentBg(_s, 0.2),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  title: { fontSize: 28, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 12 },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 36,
  },
  previewList: { width: "100%", gap: 14 },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  previewEmoji: { fontSize: 22 },
  previewText: { fontSize: 14, color: "rgba(255,255,255,0.6)", flex: 1 },
  bottomSection: { width: "100%", alignItems: "center" },
  enableButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accentColor(_s),
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
  },
  enableText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  skipButton: { paddingVertical: 16 },
  skipText: { fontSize: 15, color: "rgba(255,255,255,0.35)" },
});
