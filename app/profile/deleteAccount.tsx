// app/profile/deleteAccount.tsx
// Soft-delete account screen — adapted from Besties with CrossTown dark theme
import { FontAwesome } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { removePushToken } from "../../utils/pushNotifications";

const DELETION_REASONS = [
  { id: "not_useful", label: "App isn't useful to me" },
  { id: "no_rivals", label: "Not enough active rivals" },
  { id: "privacy", label: "Privacy concerns" },
  { id: "too_many_notifications", label: "Too many notifications" },
  { id: "found_alternative", label: "Using a different app" },
  { id: "bad_experience", label: "Had a negative experience" },
  { id: "temporary_break", label: "Taking a break" },
  { id: "graduating", label: "Graduating / leaving school" },
  { id: "technical_issues", label: "App has too many bugs" },
  { id: "other", label: "Other reason" },
];

export default function DeleteAccount() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [showReasons, setShowReasons] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText.toUpperCase() === "DELETE";

  const handleDelete = async () => {
    if (!canDelete) return;

    Alert.alert(
      "Final Confirmation",
      "This will permanently delete your account. Are you absolutely sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              const userId = auth.currentUser?.uid;
              if (!userId) {
                Alert.alert("Error", "No user found. Please try again.");
                setDeleting(false);
                return;
              }

              // Soft delete: mark as deleted, anonymize profile, clear push token
              await updateDoc(doc(db, "users", userId), {
                accountStatus: "deleted",
                deletedAt: serverTimestamp(),
                deletionReason: selectedReason || "not_provided",
                expoPushToken: null,
                name: "Deleted User",
                photos: [],
                bio: "",
              });

              // Clear push token (belt-and-suspenders — also nulled above)
              try {
                await removePushToken();
              } catch (e) {
                console.error("[DeleteAccount] Failed to remove push token:", e);
              }

              // Sign out — _layout.tsx blocks re-entry for deleted accounts
              await signOut(auth);
              router.replace("/");
            } catch (error) {
              console.error("[DeleteAccount] Error:", error);
              Alert.alert("Error", "Failed to delete account. Please try again.");
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const getSelectedReasonLabel = () => {
    if (!selectedReason) return "Select a reason (optional)";
    return DELETION_REASONS.find((r) => r.id === selectedReason)?.label ?? "";
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sad header */}
          <View style={styles.sadHeader}>
            <Text style={styles.sadEmoji}>😢</Text>
            <Text style={styles.sadTitle}>We're sorry to see you go</Text>
            <Text style={styles.sadSubtitle}>
              Before you leave, please let us know why
            </Text>
          </View>

          {/* Reason picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why are you leaving?</Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => setShowReasons(!showReasons)}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !selectedReason && styles.dropdownPlaceholder,
                ]}
              >
                {getSelectedReasonLabel()}
              </Text>
              <FontAwesome
                name={showReasons ? "chevron-up" : "chevron-down"}
                size={14}
                color="#94A3B8"
              />
            </Pressable>

            {showReasons && (
              <View style={styles.reasonsList}>
                {DELETION_REASONS.map((reason) => (
                  <Pressable
                    key={reason.id}
                    style={[
                      styles.reasonItem,
                      selectedReason === reason.id && styles.reasonItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedReason(reason.id);
                      setShowReasons(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        selectedReason === reason.id && styles.reasonTextSelected,
                      ]}
                    >
                      {reason.label}
                    </Text>
                    {selectedReason === reason.id && (
                      <FontAwesome name="check" size={14} color="#EF4444" />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Warning */}
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <FontAwesome name="exclamation-triangle" size={18} color="#F59E0B" />
              <Text style={styles.warningTitle}>What happens when you delete:</Text>
            </View>
            <Text style={styles.warningItem}>
              • Your profile will be hidden from all rivals
            </Text>
            <Text style={styles.warningItem}>
              • Your showdown history will be removed
            </Text>
            <Text style={styles.warningItem}>
              • Your name and photos will be wiped
            </Text>
            <Text style={styles.warningItem}>
              • You will be signed out immediately
            </Text>
            <Text style={styles.warningItem}>
              • You will stop receiving all notifications
            </Text>
            <Text style={styles.warningItemBold}>• This action cannot be undone</Text>
          </View>

          {/* Type DELETE confirmation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirm Deletion</Text>
            <Text style={styles.confirmLabel}>
              Type <Text style={styles.deleteWord}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Type DELETE here"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonSection}>
            <Pressable
              style={[
                styles.deleteButton,
                !canDelete && styles.deleteButtonDisabled,
              ]}
              onPress={handleDelete}
              disabled={!canDelete || deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <FontAwesome
                    name="trash"
                    size={18}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.deleteButtonText}>Delete My Account</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={deleting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // ─── Sad header ────────────────────────────────────────────
  sadHeader: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  sadEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  sadTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#E2E8F0",
    marginBottom: 8,
  },
  sadSubtitle: {
    fontSize: 15,
    color: "#94A3B8",
    textAlign: "center",
  },
  // ─── Sections ──────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#E2E8F0",
    marginBottom: 12,
  },
  // ─── Dropdown ──────────────────────────────────────────────
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dropdownText: {
    fontSize: 16,
    color: "#E2E8F0",
  },
  dropdownPlaceholder: {
    color: "#64748B",
  },
  reasonsList: {
    marginTop: 8,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  reasonItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  reasonItemSelected: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  reasonText: {
    fontSize: 15,
    color: "#CBD5E1",
  },
  reasonTextSelected: {
    color: "#EF4444",
    fontWeight: "500",
  },
  // ─── Warning card ──────────────────────────────────────────
  warningCard: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F59E0B",
    marginLeft: 10,
  },
  warningItem: {
    fontSize: 14,
    color: "#CBD5E1",
    marginBottom: 6,
    lineHeight: 20,
  },
  warningItemBold: {
    fontSize: 14,
    color: "#E2E8F0",
    fontWeight: "700",
    marginTop: 4,
  },
  // ─── Confirmation input ────────────────────────────────────
  confirmLabel: {
    fontSize: 15,
    color: "#94A3B8",
    marginBottom: 10,
  },
  deleteWord: {
    fontWeight: "700",
    color: "#EF4444",
  },
  confirmInput: {
    padding: 15,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    fontSize: 16,
    color: "#E2E8F0",
    textAlign: "center",
    letterSpacing: 2,
  },
  // ─── Buttons ───────────────────────────────────────────────
  buttonSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  deleteButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    backgroundColor: "rgba(239, 68, 68, 0.3)",
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: "500",
    color: "#94A3B8",
  },
});
