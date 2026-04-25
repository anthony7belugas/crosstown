// components/ScoreboardBanner.tsx
// Slim sticky banner above the Duels list showing live USC vs UCLA tally.
// Tap → navigates to the Scoreboard tab.
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { db } from "../firebaseConfig";
import {
  BG_SURFACE,
  TEXT_SECONDARY,
  UCLA_BLUE,
  USC_RED,
} from "../utils/colors";

interface TallyData {
  usc_weekly: number;
  ucla_weekly: number;
}

export function ScoreboardBanner() {
  const router = useRouter();
  const isMounted = useRef(true);
  const [tally, setTally] = useState<TallyData>({
    usc_weekly: 0,
    ucla_weekly: 0,
  });

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(
      doc(db, "scoreboard", "tallies"),
      (snap) => {
        if (!isMounted.current) return;
        if (snap.exists()) {
          const d = snap.data();
          setTally({
            usc_weekly: d.usc_weekly || 0,
            ucla_weekly: d.ucla_weekly || 0,
          });
        }
      },
      (err) => {
        console.warn("[ScoreboardBanner] snapshot error:", err);
      }
    );
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  const handlePress = () => {
    // Match the navigation convention used elsewhere in the app
    router.push("/(tabs)/scoreboard" as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Scoreboard: USC ${tally.usc_weekly}, UCLA ${tally.ucla_weekly} this week`}
    >
      <View style={styles.scoreBlock}>
        <Text style={[styles.school, { color: USC_RED }]}>USC</Text>
        <Text style={[styles.score, { color: USC_RED }]}>
          {tally.usc_weekly}
        </Text>
      </View>

      <Text style={styles.dash}>—</Text>

      <View style={styles.scoreBlock}>
        <Text style={[styles.score, { color: UCLA_BLUE }]}>
          {tally.ucla_weekly}
        </Text>
        <Text style={[styles.school, { color: UCLA_BLUE }]}>UCLA</Text>
      </View>

      <View style={{ flex: 1 }} />

      <Text style={styles.hint}>This week</Text>
      <FontAwesome
        name="chevron-right"
        size={11}
        color={TEXT_SECONDARY}
        style={{ marginLeft: 6 }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG_SURFACE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    gap: 8,
  },
  scoreBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  school: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  score: {
    fontSize: 18,
    fontWeight: "800",
  },
  dash: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: "600",
    marginHorizontal: 4,
  },
  hint: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
