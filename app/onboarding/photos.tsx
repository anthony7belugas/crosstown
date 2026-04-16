// app/onboarding/photos.tsx
// FIX #3: Falls back to reading side from Firestore if route param is lost
import { FontAwesome } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../firebaseConfig";
import { accentColor, BG_PRIMARY, TEXT_SECONDARY } from "../../utils/colors";

const { width } = Dimensions.get("window");
const GRID_PADDING = 24;
const GAP = 10;
const SMALL_SIZE = (width - GRID_PADDING * 2 - GAP * 2) / 3;
const MAIN_SIZE = width - GRID_PADDING * 2;

export default function PhotosScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── Restore cached data + resolve side fallback on mount ──
  const paramSide = params.side as string | undefined;
  const [side, setSide] = useState(paramSide || "usc");
  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
      const data = snap.data();
      if (!data) return;
      if (!paramSide && data.side) setSide(data.side);
      if (data.photos?.length && photos.length === 0) setPhotos(data.photos);
    }).catch(() => {});
  }, []);

  const accent = accentColor(side);

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 720 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch {
      return uri;
    }
  };

  const handleAddPhoto = async (index: number) => {
    if (photos.length >= 6) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow photo access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: index === 0 ? [3, 4] : [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      const compressed = await compressImage(result.assets[0].uri);
      const updated = [...photos];
      if (index < photos.length) {
        updated[index] = compressed;
      } else {
        updated.push(compressed);
      }
      setPhotos(updated);
      setUploading(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (uris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      const response = await fetch(uris[i]);
      const blob = await response.blob();
      const filename = `${Date.now()}_${i}.jpg`;
      const storageRef = ref(
        storage,
        `photos/${auth.currentUser!.uid}/${filename}`
      );
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }
    return urls;
  };

  const handleContinue = async () => {
    if (photos.length === 0) {
      Alert.alert("Photo Required", "Add at least 1 photo to continue.");
      return;
    }
    if (!auth.currentUser) {
      Alert.alert("Error", "Not authenticated.");
      return;
    }

    setUploading(true);
    try {
      // Separate already-uploaded URLs from new local picks
      const finalUrls: string[] = [];
      const toUpload: string[] = [];
      const uploadIndexMap: number[] = []; // tracks position in finalUrls

      photos.forEach((uri, i) => {
        if (uri.startsWith("https://")) {
          finalUrls[i] = uri; // already in Storage
        } else {
          toUpload.push(uri);
          uploadIndexMap.push(i);
        }
      });

      // Only upload new local photos
      if (toUpload.length > 0) {
        const newUrls = await uploadPhotos(toUpload);
        newUrls.forEach((url, j) => {
          finalUrls[uploadIndexMap[j]] = url;
        });
      }

      // Progressive save — merge:true so we don't overwrite name/side
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { photos: finalUrls },
        { merge: true }
      );

      router.push({
        pathname: "/onboarding/profileInfo",
        params: { side },
      });
    } catch (error) {
      console.error("Error uploading photos:", error);
      Alert.alert("Error", "Failed to upload photos. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Renders one slot — filled or empty
  const renderSlot = (index: number, isMain: boolean) => {
    const filled = index < photos.length;
    const isNextEmpty = index === photos.length;
    const h = isMain ? MAIN_SIZE * 1.2 : SMALL_SIZE * 1.25;
    const w = isMain ? MAIN_SIZE : SMALL_SIZE;

    if (filled) {
      return (
        <View key={index} style={[styles.slot, { width: w, height: h }]}>
          <Image source={{ uri: photos[index] }} style={styles.slotImage} />
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemovePhoto(index)}
          >
            <FontAwesome name="times" size={12} color="#fff" />
          </TouchableOpacity>
          {isMain && (
            <View style={[styles.mainBadge, { backgroundColor: accent }]}>
              <Text style={styles.mainBadgeText}>MAIN</Text>
            </View>
          )}
        </View>
      );
    }

    // Empty slot — only tappable if it's the next one to fill
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.slot,
          styles.emptySlot,
          { width: w, height: h },
          isNextEmpty && styles.emptySlotActive,
          isNextEmpty && uploading && { opacity: 0.5 },
        ]}
        onPress={() => isNextEmpty && handleAddPhoto(index)}
        disabled={!isNextEmpty || uploading}
        activeOpacity={isNextEmpty ? 0.7 : 1}
      >
        {isNextEmpty && uploading ? (
          <ActivityIndicator color={accent} />
        ) : (
          <>
            <View
              style={[
                styles.plusCircle,
                isNextEmpty && { backgroundColor: `${accent}22` },
              ]}
            >
              <FontAwesome
                name="plus"
                size={isMain ? 24 : 16}
                color={isNextEmpty ? accent : "rgba(255,255,255,0.12)"}
              />
            </View>
            {isMain && (
              <Text style={[styles.addMainText, { color: accent }]}>
                Add main photo
              </Text>
            )}
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "66%", backgroundColor: accent }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Add Photos</Text>
        <Text style={styles.subtitle}>
          Your main photo is what rivals see first
        </Text>

        {/* Main photo — full width */}
        <View style={styles.mainSlotWrapper}>
          {renderSlot(0, true)}
        </View>

        {/* Secondary slots — 3 columns */}
        <View style={styles.secondaryGrid}>
          {[1, 2, 3, 4, 5].map((i) => renderSlot(i, false))}
        </View>

        {/* Counter + hint */}
        <View style={styles.footer}>
          <Text style={styles.photoCount}>
            {photos.length} / 6 photos
          </Text>
          <Text style={styles.hint}>
            You can always add or remove photos in settings
          </Text>
        </View>
      </ScrollView>

      {/* Continue button */}
      <View
        style={[styles.buttonWrapper, { paddingBottom: insets.bottom + 20 }]}
      >
        <Pressable
          onPress={handleContinue}
          disabled={photos.length === 0 || uploading}
          style={[
            styles.continueButton,
            { backgroundColor: accent },
            (photos.length === 0 || uploading) && styles.disabled,
            Platform.OS === "ios" && {
              shadowColor: accent,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
            },
          ]}
        >
          {uploading ? (
            <>
              <ActivityIndicator color="#1E293B" />
              <Text style={styles.continueText}>Uploading...</Text>
            </>
          ) : (
            <>
              <Text style={styles.continueText}>Continue</Text>
              <FontAwesome name="arrow-right" size={18} color="#1E293B" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
  },
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
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  mainSlotWrapper: {
    marginBottom: GAP,
  },
  secondaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  slot: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  slotImage: {
    width: "100%",
    height: "100%",
  },
  emptySlot: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  emptySlotActive: {
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  plusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  addMainText: {
    fontSize: 15,
    fontWeight: "600",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  mainBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mainBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: 0.8,
  },
  footer: {
    alignItems: "center",
    marginTop: 16,
    gap: 6,
  },
  photoCount: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
  },
  buttonWrapper: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  continueButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    ...(Platform.OS === "android" && { elevation: 8 }),
  },
  disabled: {
    opacity: 0.35,
  },
  continueText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
});
