// app/onboarding/nameAndDob.tsx
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { accentColor } from "../../utils/colors";


export default function NameAndDobScreen() {
  const { side } = useLocalSearchParams<{ side: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");

  const getAge = (): number | null => {
    const m = parseInt(month); const d = parseInt(day); const y = parseInt(year);
  const styles = createStyles(side);

    if (!m || !d || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2010) return null;
    const today = new Date();
    const birth = new Date(y, m - 1, d);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const age = getAge();
  const isValid = name.trim().length >= 2 && age !== null && age >= 18;

  const handleContinue = () => {
    Keyboard.dismiss();
    if (name.trim().length < 2) { Alert.alert("Name Required", "Enter at least 2 characters."); return; }
    if (age === null) { Alert.alert("Invalid Date", "Please enter a valid date of birth."); return; }
    if (age < 18) { Alert.alert("Age Requirement", "You must be 18 or older to use CrossTown."); return; }

    router.push({
      pathname: "/onboarding/genderPrefs",
      params: { side, name: name.trim(), dob: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, age: age.toString() },
    });
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={20} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: "42%" }]} /></View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>About You</Text>
          <Text style={styles.subtitle}>Just the basics — keep it quick</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <View style={styles.inputContainer}>
              <TextInput style={styles.input} placeholder="Your first name" placeholderTextColor="rgba(255,255,255,0.2)" value={name} onChangeText={(t) => setName(t.replace(/\b\w/g, c => c.toUpperCase()))} maxLength={30} autoCapitalize="words" autoCorrect={false} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <View style={styles.dobRow}>
              <View style={[styles.inputContainer, styles.dobInput]}>
                <TextInput style={styles.input} placeholder="MM" placeholderTextColor="rgba(255,255,255,0.2)" value={month} onChangeText={(t) => setMonth(t.replace(/[^0-9]/g, ""))} maxLength={2} keyboardType="number-pad" />
              </View>
              <Text style={styles.dobSlash}>/</Text>
              <View style={[styles.inputContainer, styles.dobInput]}>
                <TextInput style={styles.input} placeholder="DD" placeholderTextColor="rgba(255,255,255,0.2)" value={day} onChangeText={(t) => setDay(t.replace(/[^0-9]/g, ""))} maxLength={2} keyboardType="number-pad" />
              </View>
              <Text style={styles.dobSlash}>/</Text>
              <View style={[styles.inputContainer, styles.dobInputYear]}>
                <TextInput style={styles.input} placeholder="YYYY" placeholderTextColor="rgba(255,255,255,0.2)" value={year} onChangeText={(t) => setYear(t.replace(/[^0-9]/g, ""))} maxLength={4} keyboardType="number-pad" />
              </View>
            </View>
            {age !== null && age < 18 && <Text style={styles.errorText}>You must be 18 or older</Text>}
            {age !== null && age >= 18 && <Text style={styles.ageText}>Age: {age}</Text>}
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable onPress={handleContinue} disabled={!isValid} style={[styles.continueButton, !isValid && styles.disabled]}>
            <Text style={styles.continueText}>Continue</Text>
            <FontAwesome name="arrow-right" size={18} color="#1E293B" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (_s: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  progressBar: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 },
  progressFill: { height: "100%", backgroundColor: accentColor(_s), borderRadius: 2 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 30 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 32 },
  inputGroup: { marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, height: 56 },
  input: { flex: 1, fontSize: 18, color: "#fff", textAlign: "center" },
  dobRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dobInput: { flex: 1 },
  dobInputYear: { flex: 1.5 },
  dobSlash: { fontSize: 24, color: "rgba(255,255,255,0.2)", fontWeight: "300" },
  errorText: { fontSize: 13, color: "#EF4444", marginTop: 8, marginLeft: 4 },
  ageText: { fontSize: 13, color: "#10B981", marginTop: 8, marginLeft: 4 },
  footer: { paddingHorizontal: 24, paddingTop: 16 },
  continueButton: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: accentColor(_s), borderRadius: 16, paddingVertical: 18, gap: 10, ...Platform.select({ ios: { shadowColor: accentColor(_s), shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12 }, android: { elevation: 8 } }) },
  disabled: { opacity: 0.4 },
  continueText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
});
