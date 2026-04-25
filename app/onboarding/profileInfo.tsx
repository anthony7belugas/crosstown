// app/onboarding/profileInfo.tsx
// Onboarding final step — major + grad year only. Bio removed for v1.
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { accentBg, accentColor } from "../../utils/colors";

const MAJORS = [
  "Business", "CS", "CSBA", "Econ", "Film", "Comm", "Bio", "Psych",
  "Engineering", "Poli Sci", "IR", "Neuro", "Architecture", "Math",
  "Music", "Design", "Pre-Med", "Pre-Law", "Nursing", "Kinesiology",
  "Sociology", "English", "History", "Philosophy", "Other", "Undecided",
];

const YEARS = ["2026", "2027", "2028", "2029", "2030", "2031", "Graduate"];

export default function ProfileInfoScreen() {
  const { side: paramSide } = useLocalSearchParams<{ side: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [major, setMajor] = useState<string | null>(null);
  const [gradYear, setGradYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [side, setSide] = useState(paramSide || "usc");

  useEffect(() => {
    if (!auth.currentUser) return;
    let cancelled = false;
    getDoc(doc(db, "users", auth.currentUser.uid))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.data();
        if (!data) return;
        if (!paramSide && data.side) setSide(data.side);
        if (data.major) setMajor((prev) => prev ?? data.major);
        if (data.gradYear) setGradYear((prev) => prev ?? data.gradYear);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isValid = major !== null && gradYear !== null;
  const styles = useMemo(() => createStyles(side), [side]);

  const handleFinish = async () => {
    if (!major || !gradYear) {
      Alert.alert("Required", "Please select your major and graduation year.");
      return;
    }
    if (!auth.currentUser) {
      Alert.alert("Error", "Not authenticated.");
      return;
    }

    setLoading(true);
    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          major,
          gradYear,
          dailyChallengeCount: 0,
          dailyChallengeDate: "",
          blockedUsers: [],
          blockedByUsers: [],
          profileCompleted: true,
        },
        { merge: true }
      );

      router.replace({
        pathname: "/enableNotifications",
        params: { side },
      });
    } catch (error) {
      console.error("Error creating profile:", error);
      Alert.alert("Error", "Failed to create your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome
            name="arrow-left"
            size={20}
            color="rgba(255,255,255,0.6)"
          />
        </Pressable>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "100%" }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Almost There</Text>
        <Text style={styles.subtitle}>A little more about you</Text>

        <Text style={styles.sectionLabel}>Major</Text>
        <View style={styles.tagsContainer}>
          {MAJORS.map((m) => (
            <Pressable
              key={m}
              style={[styles.tag, major === m && styles.tagSelected]}
              onPress={() => setMajor(m)}
            >
              <Text
                style={[
                  styles.tagText,
                  major === m && styles.tagTextSelected,
                ]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Year</Text>
        <View style={styles.tagsContainer}>
          {YEARS.map((y) => (
            <Pressable
              key={y}
              style={[styles.tag, gradYear === y && styles.tagSelected]}
              onPress={() => setGradYear(y)}
            >
              <Text
                style={[
                  styles.tagText,
                  gradYear === y && styles.tagTextSelected,
                ]}
              >
                {y}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={handleFinish}
          disabled={!isValid || loading}
          style={[
            styles.finishButton,
            (!isValid || loading) && styles.disabled,
          ]}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#1E293B" />
              <Text style={styles.finishText}>Creating Profile...</Text>
            </>
          ) : (
            <>
              <Text style={styles.finishText}>Enter the Rivalry</Text>
              <FontAwesome name="trophy" size={18} color="#1E293B" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (_s: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F172A" },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.08)",
      justifyContent: "center",
      alignItems: "center",
    },
    progressBar: {
      flex: 1,
      height: 4,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: 2,
    },
    progressFill: {
      height: "100%",
      backgroundColor: accentColor(_s),
      borderRadius: 2,
    },
    scrollContent: { paddingHorizontal: 24, paddingTop: 30 },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: "#fff",
      marginBottom: 8,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 15,
      color: "rgba(255,255,255,0.5)",
      textAlign: "center",
      marginBottom: 28,
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: "rgba(255,255,255,0.7)",
      marginBottom: 12,
    },
    tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tag: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.12)",
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    tagSelected: {
      borderColor: accentColor(_s),
      backgroundColor: accentBg(_s, 0.12),
    },
    tagText: {
      fontSize: 14,
      fontWeight: "600",
      color: "rgba(255,255,255,0.4)",
    },
    tagTextSelected: { color: accentColor(_s) },
    footer: { paddingHorizontal: 24, paddingTop: 16 },
    finishButton: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: accentColor(_s),
      borderRadius: 16,
      paddingVertical: 18,
      gap: 10,
      ...Platform.select({
        ios: {
          shadowColor: accentColor(_s),
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        },
        android: { elevation: 8 },
      }),
    },
    disabled: { opacity: 0.4 },
    finishText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  });
