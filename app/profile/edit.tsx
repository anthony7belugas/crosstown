// app/profile/edit.tsx
// Edit Profile — text fields only. Photos live on /profile/photos.
// Save in top-right header, bolded in school color when dirty.
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { accentBg, accentColor } from "../../utils/colors";
import { checkContentFilter } from "../../utils/contentFilter";
import { clearCachedProfile } from "../../utils/userProfileCache";

const MAJORS = [
  "Accounting", "Aerospace Engineering", "Anthropology", "Architecture",
  "Art", "Biology", "Biomedical Engineering", "Business Administration",
  "Chemical Engineering", "Chemistry", "Civil Engineering", "Communication",
  "Computer Engineering", "Computer Science", "Data Science", "Economics",
  "Education", "Electrical Engineering", "English", "Environmental Science",
  "Film", "Finance", "History", "International Relations", "Journalism",
  "Kinesiology", "Law", "Linguistics", "Marketing", "Mathematics",
  "Mechanical Engineering", "Music", "Neuroscience", "Nursing", "Philosophy",
  "Physics", "Political Science", "Pre-Med", "Psychology", "Public Health",
  "Sociology", "Theater", "Undecided", "Other",
];
const YEARS = ["2026", "2027", "2028", "2029", "2030", "2031", "Graduate"];
const ABOUT_MAX = 150;
const NAME_MAX = 40;

interface OriginalData {
  name: string;
  bio: string;
  major: string;
  gradYear: string;
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [major, setMajor] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [original, setOriginal] = useState<OriginalData | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userSide, setUserSide] = useState<string>("usc");

  const styles = useMemo(() => createStyles(userSide), [userSide]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const initial: OriginalData = {
          name: data.name || "",
          bio: data.bio || "",
          major: data.major || "",
          gradYear: data.gradYear || "",
        };
        setName(initial.name);
        setBio(initial.bio);
        setMajor(initial.major);
        setGradYear(initial.gradYear);
        setOriginal(initial);
        setUserSide(data.side || "usc");
      }
    } catch (e) {
      console.error("[EditProfile] Load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Dirty = current differs from original
  const isDirty = useMemo(() => {
    if (!original) return false;
    return (
      name.trim() !== original.name ||
      bio.trim() !== original.bio ||
      major !== original.major ||
      gradYear !== original.gradYear
    );
  }, [name, bio, major, gradYear, original]);

  const handleSave = async () => {
    if (!auth.currentUser || !isDirty || saving) return;
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your first name.");
      return;
    }
    if (!major) {
      Alert.alert("Major Required", "Please select your major.");
      return;
    }
    if (!gradYear) {
      Alert.alert("Class Year Required", "Please select your class year.");
      return;
    }
    if (bio.trim() && !checkContentFilter(bio.trim())) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: name.trim(),
        bio: bio.trim(),
        major,
        gradYear,
      });
      clearCachedProfile(auth.currentUser.uid);
      router.back();
    } catch (e) {
      console.error("[EditProfile] Save failed:", e);
      Alert.alert("Error", "Failed to save profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(userSide)} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <FontAwesome name="chevron-left" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable
          onPress={handleSave}
          disabled={!isDirty || saving}
          style={styles.saveButton}
          hitSlop={8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={accentColor(userSide)} />
          ) : (
            <Text
              style={[
                styles.saveText,
                !isDirty && styles.saveTextInactive,
              ]}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* NAME */}
        <Text style={styles.sectionLabel}>Name</Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder="Your first name"
          placeholderTextColor="rgba(255,255,255,0.25)"
          maxLength={NAME_MAX}
          returnKeyType="done"
        />

        {/* MAJOR */}
        <Text style={styles.sectionLabel}>Major</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContainer}
          style={styles.chipScroll}
        >
          {MAJORS.map((m) => (
            <Pressable
              key={m}
              style={[styles.chip, major === m && styles.chipSelected]}
              onPress={() => setMajor(m)}
            >
              <Text
                style={[styles.chipText, major === m && styles.chipTextSelected]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* CLASS YEAR */}
        <Text style={styles.sectionLabel}>Class Year</Text>
        <View style={styles.yearRow}>
          {YEARS.map((y) => (
            <Pressable
              key={y}
              style={[styles.yearChip, gradYear === y && styles.yearChipSelected]}
              onPress={() => setGradYear(y)}
            >
              <Text
                style={[
                  styles.yearText,
                  gradYear === y && styles.yearTextSelected,
                ]}
              >
                {y}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ABOUT */}
        <Text style={styles.sectionLabel}>About</Text>
        <TextInput
          style={[styles.textInput, styles.bioInput]}
          value={bio}
          onChangeText={(t) =>
            t.length <= ABOUT_MAX && setBio(t)
          }
          placeholder="Tell your rivals about yourself..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          multiline
          maxLength={ABOUT_MAX}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>
          {bio.length} / {ABOUT_MAX}
        </Text>
        <Text style={styles.helperText}>
          Tell your rivals about yourself.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (side: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F172A" },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.06)",
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
    saveButton: {
      minWidth: 56,
      height: 36,
      paddingHorizontal: 12,
      justifyContent: "center",
      alignItems: "flex-end",
    },
    saveText: {
      fontSize: 16,
      fontWeight: "800",
      color: accentColor(side),
    },
    saveTextInactive: {
      color: "rgba(255,255,255,0.25)",
      fontWeight: "600",
    },
    scrollContent: { padding: 20, paddingBottom: 80 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: "rgba(255,255,255,0.3)",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 10,
      marginTop: 20,
    },
    textInput: {
      backgroundColor: "#1E293B",
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: "#fff",
    },
    bioInput: { height: 100, textAlignVertical: "top" },
    charCount: {
      fontSize: 12,
      color: "rgba(255,255,255,0.2)",
      textAlign: "right",
      marginTop: 4,
    },
    helperText: {
      fontSize: 13,
      color: "rgba(255,255,255,0.35)",
      marginTop: 4,
    },
    chipScroll: { marginBottom: 8 },
    chipContainer: { gap: 8, paddingVertical: 4 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: "#1E293B",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.06)",
    },
    chipSelected: {
      backgroundColor: accentBg(side, 0.12),
      borderColor: accentColor(side),
    },
    chipText: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
    chipTextSelected: { color: accentColor(side), fontWeight: "600" },
    yearRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    yearChip: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: "#1E293B",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.06)",
    },
    yearChipSelected: {
      backgroundColor: accentBg(side, 0.12),
      borderColor: accentColor(side),
    },
    yearText: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.4)" },
    yearTextSelected: { color: accentColor(side) },
  });
