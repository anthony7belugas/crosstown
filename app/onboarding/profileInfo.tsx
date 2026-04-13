// app/onboarding/profileInfo.tsx
// Final onboarding screen — creates Firestore user doc with all collected data, uploads photos
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db, storage } from "../../firebaseConfig";
import { accentColor, accentBg } from "../../utils/colors";


const MAJORS = [
  "Business", "CS", "CSBA", "Econ", "Film", "Comm", "Bio", "Psych",
  "Engineering", "Poli Sci", "IR", "Neuro", "Architecture", "Math",
  "Music", "Design", "Pre-Med", "Pre-Law", "Nursing", "Kinesiology",
  "Sociology", "English", "History", "Philosophy", "Other", "Undecided",
];

const YEARS = ["2026", "2027", "2028", "2029", "2030", "2031"];

export default function ProfileInfoScreen() {
  const params = useLocalSearchParams<{
    side: string; name: string; dob: string; age: string; photoUris: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [major, setMajor] = useState<string | null>(null);
  const [gradYear, setGradYear] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = major !== null && gradYear !== null;
  const styles = createStyles(params.side);

  const uploadPhotos = async (uris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      const response = await fetch(uris[i]);
      const blob = await response.blob();
      const filename = `${Date.now()}_${i}.jpg`;
      const storageRef = ref(storage, `photos/${auth.currentUser!.uid}/${filename}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }
    return urls;
  };

  const handleFinish = async () => {
    Keyboard.dismiss();
    if (!major || !gradYear) { Alert.alert("Required", "Please select your major and graduation year."); return; }
    if (!auth.currentUser) { Alert.alert("Error", "Not authenticated."); return; }

    setLoading(true);
    try {
      // Upload photos to Firebase Storage
      const photoUris: string[] = JSON.parse(params.photoUris || "[]");
      const photoUrls = await uploadPhotos(photoUris);

      // Create user document
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        side: params.side,
        email: auth.currentUser.email,
        name: params.name,
        dateOfBirth: params.dob,
        age: parseInt(params.age),
        photos: photoUrls,
        major,
        gradYear,
        bio: bio.trim() || "",
        dailySwipeCount: 0,
        dailySwipeDate: "",
        blockedUsers: [],
        blockedByUsers: [],
        profileCompleted: true,
        createdAt: serverTimestamp(),
      });

      // Navigate to main app
      router.replace({ pathname: "/enableNotifications", params: { side: params.side } });
    } catch (error) {
      console.error("Error creating profile:", error);
      Alert.alert("Error", "Failed to create your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={20} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: "85%" }]} /></View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Almost There</Text>
          <Text style={styles.subtitle}>A little more about you</Text>

          {/* Major */}
          <Text style={styles.sectionLabel}>Major</Text>
          <View style={styles.tagsContainer}>
            {MAJORS.map((m) => (
              <Pressable key={m} style={[styles.tag, major === m && styles.tagSelected]} onPress={() => setMajor(m)}>
                <Text style={[styles.tagText, major === m && styles.tagTextSelected]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          {/* Grad Year */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Graduation Year</Text>
          <View style={styles.tagsContainer}>
            {YEARS.map((y) => (
              <Pressable key={y} style={[styles.tag, gradYear === y && styles.tagSelected]} onPress={() => setGradYear(y)}>
                <Text style={[styles.tagText, gradYear === y && styles.tagTextSelected]}>{y}</Text>
              </Pressable>
            ))}
          </View>

          {/* Bio */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Bio <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.bioContainer}>
            <TextInput
              style={styles.bioInput}
              placeholder="Something witty about yourself..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={bio}
              onChangeText={setBio}
              maxLength={300}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/300</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable onPress={handleFinish} disabled={!isValid || loading} style={[styles.finishButton, (!isValid || loading) && styles.disabled]}>
            {loading ? (
              <><ActivityIndicator color="#1E293B" /><Text style={styles.finishText}>Creating Profile...</Text></>
            ) : (
              <><Text style={styles.finishText}>Enter the Rivalry</Text><FontAwesome name="trophy" size={18} color="#1E293B" /></>
            )}
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
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 28 },
  sectionLabel: { fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.7)", marginBottom: 12 },
  optional: { fontWeight: "400", color: "rgba(255,255,255,0.3)" },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" },
  tagSelected: { borderColor: accentColor(_s), backgroundColor: accentBg(_s, 0.12) },
  tagText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.4)" },
  tagTextSelected: { color: accentColor(_s) },
  bioContainer: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 16 },
  bioInput: { fontSize: 16, color: "#fff", minHeight: 80 },
  charCount: { fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "right", marginTop: 8 },
  footer: { paddingHorizontal: 24, paddingTop: 16 },
  finishButton: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: accentColor(_s), borderRadius: 16, paddingVertical: 18, gap: 10, ...Platform.select({ ios: { shadowColor: accentColor(_s), shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12 }, android: { elevation: 8 } }) },
  disabled: { opacity: 0.4 },
  finishText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
});
