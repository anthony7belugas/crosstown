// app/onboarding/genderPrefs.tsx
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { accentColor, accentBg } from "../../utils/colors";


type Gender = "man" | "woman" | "nonbinary";
type ShowMe = "men" | "women" | "everyone";

export default function GenderPrefsScreen() {
  const params = useLocalSearchParams<{ side: string; name: string; dob: string; age: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gender, setGender] = useState<Gender | null>(null);
  const [showMe, setShowMe] = useState<ShowMe | null>(null);

  const isValid = gender !== null && showMe !== null;

  const handleContinue = () => {
  const styles = createStyles(params.side as string);

    if (!isValid) return;
    router.push({
      pathname: "/onboarding/photos",
      params: { ...params, gender, showMe },
    });
  };

  const GenderButton = ({ value, label, icon }: { value: Gender; label: string; icon: string }) => (
    <Pressable style={[styles.optionButton, gender === value && styles.optionSelected]} onPress={() => setGender(value)}>
      <FontAwesome name={icon as any} size={22} color={gender === value ? accentColor(_s) : "rgba(255,255,255,0.4)"} />
      <Text style={[styles.optionText, gender === value && styles.optionTextSelected]}>{label}</Text>
      {gender === value && <View style={styles.checkDot}><FontAwesome name="check" size={12} color="#1E293B" /></View>}
    </Pressable>
  );

  const ShowMeButton = ({ value, label }: { value: ShowMe; label: string }) => (
    <Pressable style={[styles.optionButton, showMe === value && styles.optionSelected]} onPress={() => setShowMe(value)}>
      <Text style={[styles.optionText, showMe === value && styles.optionTextSelected]}>{label}</Text>
      {showMe === value && <View style={styles.checkDot}><FontAwesome name="check" size={12} color="#1E293B" /></View>}
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <View style={styles.progressBar}><View style={[styles.progressFill, { width: "57%" }]} /></View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>I am a...</Text>
        <View style={styles.optionsGroup}>
          <GenderButton value="man" label="Man" icon="male" />
          <GenderButton value="woman" label="Woman" icon="female" />
          <GenderButton value="nonbinary" label="Non-binary" icon="genderless" />
        </View>

        <Text style={[styles.title, { marginTop: 36 }]}>Show me...</Text>
        <View style={styles.optionsGroup}>
          <ShowMeButton value="men" label="Men" />
          <ShowMeButton value="women" label="Women" />
          <ShowMeButton value="everyone" label="Everyone" />
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={handleContinue} disabled={!isValid} style={[styles.continueButton, !isValid && styles.disabled]}>
          <Text style={styles.continueText}>Continue</Text>
          <FontAwesome name="arrow-right" size={18} color="#1E293B" />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (_s: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  progressBar: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 },
  progressFill: { height: "100%", backgroundColor: accentColor(_s), borderRadius: 2 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 30 },
  title: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 16 },
  optionsGroup: { gap: 10 },
  optionButton: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)", paddingVertical: 18, paddingHorizontal: 20, gap: 14 },
  optionSelected: { borderColor: accentColor(_s), backgroundColor: accentBg(_s, 0.08) },
  optionText: { flex: 1, fontSize: 18, fontWeight: "600", color: "rgba(255,255,255,0.5)" },
  optionTextSelected: { color: "#fff" },
  checkDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: accentColor(_s), justifyContent: "center", alignItems: "center" },
  footer: { paddingHorizontal: 24 },
  continueButton: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: accentColor(_s), borderRadius: 16, paddingVertical: 18, gap: 10, ...Platform.select({ ios: { shadowColor: accentColor(_s), shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12 }, android: { elevation: 8 } }) },
  disabled: { opacity: 0.4 },
  continueText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
});
