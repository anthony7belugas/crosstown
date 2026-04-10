// app/onboarding/photos.tsx
// Adapted from Besties photoUpload2.tsx — same compression pattern
import { FontAwesome } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { accentColor } from "../../utils/colors";

const { width } = Dimensions.get("window");
const PHOTO_SIZE = (width - 24 * 2 - 12) / 2; // 2 columns with gap

export default function PhotosScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const styles = createStyles(params.side as string);

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 720 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
      return result.uri;
    } catch { return uri; }
  };

  const handleAddPhoto = async () => {
    if (photos.length >= 6) { Alert.alert("Maximum Photos", "You can upload up to 6 photos."); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Required", "Please allow photo access."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [3, 4], quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      const compressed = await compressImage(result.assets[0].uri);
      setPhotos([...photos, compressed]);
      setUploading(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (photos.length === 0) { Alert.alert("Photo Required", "Add at least 1 photo to continue."); return; }
    // Pass photo URIs as JSON string since params are strings
    router.push({ pathname: "/onboarding/profileInfo", params: { ...params, photoUris: JSON.stringify(photos) } });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <View style={styles.progressBar}><View style={[styles.progressFill, { width: "71%" }]} /></View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Add Photos</Text>
        <Text style={styles.subtitle}>At least 1 required — profiles with 3+ get more matches</Text>

        <View style={styles.photoGrid}>
          {photos.map((uri, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.removeButton} onPress={() => handleRemovePhoto(index)}>
                <FontAwesome name="times" size={14} color="#fff" />
              </TouchableOpacity>
              {index === 0 && <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Main</Text></View>}
            </View>
          ))}
          {photos.length < 6 && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddPhoto} disabled={uploading}>
              {uploading ? <ActivityIndicator color="rgba(255,255,255,0.4)" /> : (
                <>
                  <FontAwesome name="plus" size={28} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.addText}>{photos.length === 0 ? "Add photo" : "Add more"}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.photoCount}>{photos.length}/6 photos</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleContinue} disabled={photos.length === 0} style={[styles.continueButton, photos.length === 0 && styles.disabled]}>
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 30 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 28, lineHeight: 22 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  photoContainer: { width: PHOTO_SIZE, height: PHOTO_SIZE * 1.3, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)" },
  photo: { width: "100%", height: "100%" },
  removeButton: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  mainBadge: { position: "absolute", bottom: 8, left: 8, backgroundColor: accentColor(_s), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  mainBadgeText: { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  addButton: { width: PHOTO_SIZE, height: PHOTO_SIZE * 1.3, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center", gap: 8 },
  addText: { fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: "500" },
  photoCount: { fontSize: 14, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 16 },
  footer: { paddingHorizontal: 24 },
  continueButton: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: accentColor(_s), borderRadius: 16, paddingVertical: 18, gap: 10, ...Platform.select({ ios: { shadowColor: accentColor(_s), shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12 }, android: { elevation: 8 } }) },
  disabled: { opacity: 0.4 },
  continueText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
});
