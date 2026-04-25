// app/profile/photos.tsx
// Photo management — 2x2 grid, add/remove/set-as-main.
// Min 1 photo, max 4. Slot 0 = main photo rivals see in Duels.
// Changes save automatically as you add/remove/reorder (no separate Save button).
import { FontAwesome } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Dimensions, Image, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db, storage } from "../../firebaseConfig";
import { accentBg, accentColor } from "../../utils/colors";
import { clearCachedProfile } from "../../utils/userProfileCache";

const MAX_PHOTOS = 2;
const MIN_PHOTOS = 1;
const { width } = Dimensions.get("window");
const GRID_GAP = 12;
const SLOT_SIZE = (width - 40 - GRID_GAP) / 2; // 20px padding each side, 12px gap

export default function PhotosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [userSide, setUserSide] = useState<string>("usc");
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<number | null>(null);

  // Live listener so adds/removes reflect immediately
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        return;
      }
      const data = snap.data();
      setPhotos(data.photos || []);
      setUserSide(data.side || "usc");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const persistPhotos = async (next: string[]) => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { photos: next });
    clearCachedProfile(auth.currentUser.uid);
  };

  const handleAdd = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Maximum Photos", `You can have up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow photo access to add photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const targetSlot = photos.length;
    setBusySlot(targetSlot);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 720 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      const response = await fetch(compressed.uri);
      const blob = await response.blob();
      const filename = `photo_${Date.now()}.jpg`;
      const storageRef = ref(
        storage,
        `profiles/${auth.currentUser!.uid}/${filename}`
      );
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      const next = [...photos, url];
      await persistPhotos(next);
    } catch (e) {
      console.error("[Photos] Upload failed:", e);
      Alert.alert("Error", "Failed to upload photo. Try again.");
    } finally {
      setBusySlot(null);
    }
  };

  const handleRemove = (index: number) => {
    if (photos.length <= MIN_PHOTOS) {
      Alert.alert(
        "Photo Required",
        "You need at least one photo so rivals can see who you are."
      );
      return;
    }

    Alert.alert("Remove Photo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusySlot(index);
          try {
            const photoUrl = photos[index];
            // Best-effort delete from storage (ignore errors — URL may be stale)
            try {
              await deleteObject(ref(storage, photoUrl));
            } catch {}

            const next = photos.filter((_, i) => i !== index);
            await persistPhotos(next);
          } catch (e) {
            console.error("[Photos] Remove failed:", e);
            Alert.alert("Error", "Failed to remove photo.");
          } finally {
            setBusySlot(null);
          }
        },
      },
    ]);
  };

  const handleSetAsMain = async (index: number) => {
    if (index === 0) return;
    setBusySlot(index);
    try {
      const next = [...photos];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      await persistPhotos(next);
    } catch (e) {
      console.error("[Photos] Set main failed:", e);
    } finally {
      setBusySlot(null);
    }
  };

  const accent = accentColor(userSide);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="chevron-left" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Photos</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </View>
    );
  }

  // Build 4 slot entries — filled or empty
  const slots = Array.from({ length: MAX_PHOTOS }, (_, i) => ({
    index: i,
    url: photos[i] || null,
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Photos</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.helper}>
          Your rivals see these photos before they decide whether to accept
          your challenge.
        </Text>

        {/* 2x2 grid */}
        <View style={styles.grid}>
          {slots.map(({ index, url }) => {
            const isMain = index === 0 && url;
            const isBusy = busySlot === index;
            const nextEmptyIndex = photos.length;
            const isNextEmpty = !url && index === nextEmptyIndex;

            if (url) {
              return (
                <View key={index} style={styles.slot}>
                  <Image source={{ uri: url }} style={styles.slotImage} />

                  {isMain && (
                    <View
                      style={[styles.mainPill, { backgroundColor: accent }]}
                    >
                      <Text style={styles.mainPillText}>MAIN</Text>
                    </View>
                  )}

                  {/* Trash button */}
                  <Pressable
                    style={styles.trashButton}
                    onPress={() => handleRemove(index)}
                    disabled={isBusy}
                  >
                    <FontAwesome name="trash" size={14} color="#fff" />
                  </Pressable>

                  {/* Set as main button (only on non-main filled slots) */}
                  {!isMain && (
                    <Pressable
                      style={[
                        styles.setMainButton,
                        { backgroundColor: accentBg(userSide, 0.85) },
                      ]}
                      onPress={() => handleSetAsMain(index)}
                      disabled={isBusy}
                    >
                      <FontAwesome name="star" size={11} color="#fff" />
                      <Text style={styles.setMainButtonText}>Make main</Text>
                    </Pressable>
                  )}

                  {isBusy && (
                    <View style={styles.busyOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                </View>
              );
            }

            // Empty slot — only the next-in-sequence is tappable
            return (
              <Pressable
                key={index}
                style={[
                  styles.slotEmpty,
                  !isNextEmpty && styles.slotEmptyDisabled,
                ]}
                onPress={isNextEmpty ? handleAdd : undefined}
                disabled={!isNextEmpty || isBusy}
              >
                {isBusy ? (
                  <ActivityIndicator color="rgba(255,255,255,0.5)" />
                ) : (
                  <>
                    <FontAwesome
                      name="plus"
                      size={26}
                      color={
                        isNextEmpty
                          ? "rgba(255,255,255,0.5)"
                          : "rgba(255,255,255,0.15)"
                      }
                    />
                    {isNextEmpty && (
                      <Text style={styles.slotEmptyText}>Add photo</Text>
                    )}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.footerNote}>
          Tap "Make main" on any photo to promote it to your card photo in Duels.
          {"\n"}
          You need at least {MIN_PHOTOS} photo to keep your profile active.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
  helper: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 20,
    marginBottom: 20,
    marginTop: 4,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    justifyContent: "flex-start",
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE * 1.25,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1E293B",
    position: "relative",
  },
  slotImage: { width: "100%", height: "100%" },
  slotEmpty: {
    width: SLOT_SIZE,
    height: SLOT_SIZE * 1.25,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.02)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  slotEmptyDisabled: { opacity: 0.5 },
  slotEmptyText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
  },
  mainPill: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mainPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  trashButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  setMainButton: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  setMainButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  footerNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    lineHeight: 18,
    textAlign: "center",
    marginTop: 28,
  },
});
