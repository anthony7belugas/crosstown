// app/profile/edit.tsx
// Edit profile — adapted from Besties editProfile.tsx
import { FontAwesome } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db, storage } from "../../firebaseConfig";
import { accentColor, accentBg } from "../../utils/colors";


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

const YEARS = ["2025", "2026", "2027", "2028", "2029", "2030"];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [major, setMajor] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userSide, setUserSide] = useState<string>("usc");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const styles = createStyles(userSide);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setMajor(data.major || "");
        setGradYear(data.gradYear || "");
        setPhotos(data.photos || []);
        setUserSide(data.side || "usc");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pickPhoto = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);

    try {
      // Compress
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 720 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Upload to Firebase Storage
      const response = await fetch(manipulated.uri);
      const blob = await response.blob();
      const storageRef = ref(
        storage,
        `profiles/${auth.currentUser!.uid}/photo_${index}_${Date.now()}.jpg`
      );
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      // Update local state
      const updated = [...photos];
      if (index < updated.length) {
        updated[index] = url;
      } else {
        updated.push(url);
      }
      setPhotos(updated);
    } catch (e) {
      console.error("Error uploading photo:", e);
      Alert.alert("Error", "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    if (photos.length <= 1) {
      Alert.alert("Minimum 1 Photo", "You need at least one profile photo.");
      return;
    }
    const updated = photos.filter((_, i) => i !== index);
    setPhotos(updated);
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your first name.");
      return;
    }
    if (photos.length === 0) {
      Alert.alert("Photo Required", "Please add at least one photo.");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: name.trim(),
        bio: bio.trim(),
        major,
        gradYear,
        photos,
      });
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(_s)} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveText, saving && { opacity: 0.4 }]}>
            {saving ? "Saving..." : "Save"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Photos */}
        <Text style={styles.sectionLabel}>Photos</Text>
        <View style={styles.photosGrid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Pressable
              key={i}
              style={styles.photoSlot}
              onPress={() => pickPhoto(i)}
              disabled={uploadingPhoto}
            >
              {photos[i] ? (
                <>
                  <Image source={{ uri: photos[i] }} style={styles.photoImage} />
                  <Pressable
                    style={styles.removePhotoBtn}
                    onPress={() => removePhoto(i)}
                  >
                    <FontAwesome name="times" size={10} color="#fff" />
                  </Pressable>
                </>
              ) : (
                <View style={styles.addPhotoPlaceholder}>
                  {uploadingPhoto && i === photos.length ? (
                    <ActivityIndicator size="small" color={accentColor(_s)} />
                  ) : (
                    <FontAwesome name="plus" size={20} color="rgba(255,255,255,0.2)" />
                  )}
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Name */}
        <Text style={styles.sectionLabel}>First Name</Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder="Your first name"
          placeholderTextColor="rgba(255,255,255,0.2)"
          maxLength={30}
        />

        {/* Bio */}
        <Text style={styles.sectionLabel}>Bio</Text>
        <TextInput
          style={[styles.textInput, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell your rivals about yourself..."
          placeholderTextColor="rgba(255,255,255,0.2)"
          multiline
          maxLength={300}
        />
        <Text style={styles.charCount}>{bio.length}/300</Text>

        {/* Major */}
        <Text style={styles.sectionLabel}>Major</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContainer}
        >
          {MAJORS.map((m) => (
            <Pressable
              key={m}
              style={[styles.chip, major === m && styles.chipSelected]}
              onPress={() => setMajor(m)}
            >
              <Text
                style={[
                  styles.chipText,
                  major === m && styles.chipTextSelected,
                ]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Grad Year */}
        <Text style={styles.sectionLabel}>Graduation Year</Text>
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
      </ScrollView>
    </View>
  );
}

const createStyles = (_s: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  cancelText: { fontSize: 16, color: "rgba(255,255,255,0.5)" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  saveText: { fontSize: 16, fontWeight: "700", color: accentColor(_s) },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoSlot: {
    width: "30%",
    aspectRatio: 0.75,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1E293B",
    position: "relative",
  },
  photoImage: { width: "100%", height: "100%" },
  removePhotoBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderStyle: "dashed",
    borderRadius: 12,
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
    backgroundColor: accentBg(_s, 0.12),
    borderColor: accentColor(_s),
  },
  chipText: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
  chipTextSelected: { color: accentColor(_s), fontWeight: "600" },
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
    backgroundColor: accentBg(_s, 0.12),
    borderColor: accentColor(_s),
  },
  yearText: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.4)" },
  yearTextSelected: { color: accentColor(_s) },
});
