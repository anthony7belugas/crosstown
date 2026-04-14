// app/onboarding/name.tsx
// Name entry — saves progressively to Firestore with merge:true
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { accentColor } from "../../utils/colors";

export default function NameScreen() {
  const { side } = useLocalSearchParams<{ side: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = createStyles(side);
  const isValid = name.trim().length >= 2;

  const handleContinue = async () => {
    Keyboard.dismiss();
    if (name.trim().length < 2) {
      Alert.alert("Name Required", "Enter at least 2 characters.");
      return;
    }
    if (!auth.currentUser) {
      Alert.alert("Error", "Not authenticated.");
      return;
    }

    setLoading(true);
    try {
      // Progressive save — merge:true so we don't overwrite anything
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          side,
          name: name.trim(),
          email: auth.currentUser.email,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.push({
        pathname: "/onboarding/photos",
        params: { side },
      });
    } catch (error) {
      console.error("Error saving name:", error);
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: "42%" }]} />
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>What's Your Name?</Text>
          <Text style={styles.subtitle}>This is how rivals will see you</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Your first name"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={name}
                onChangeText={(t) =>
                  setName(t.replace(/\b\w/g, (c) => c.toUpperCase()))
                }
                maxLength={30}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            </View>
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={handleContinue}
            disabled={!isValid || loading}
            style={[
              styles.continueButton,
              (!isValid || loading) && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#1E293B" />
            ) : (
              <>
                <Text style={styles.continueText}>Continue</Text>
                <FontAwesome name="arrow-right" size={18} color="#1E293B" />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (_s: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F172A" },
    header: { paddingHorizontal: 20, paddingBottom: 10 },
    progressBar: {
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
      marginBottom: 32,
    },
    inputGroup: { marginBottom: 24 },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: "rgba(255,255,255,0.6)",
      marginBottom: 8,
      marginLeft: 4,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      paddingHorizontal: 16,
      height: 56,
    },
    input: { flex: 1, fontSize: 18, color: "#fff" },
    footer: { paddingHorizontal: 24, paddingTop: 16 },
    continueButton: {
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
    continueText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  });
