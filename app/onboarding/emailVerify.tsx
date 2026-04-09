// app/onboarding/emailVerify.tsx
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../firebaseConfig";
import { ACCENT, USC_RED, UCLA_BLUE } from "../../utils/colors";


export default function EmailVerifyScreen() {
  const { side } = useLocalSearchParams<{ side: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const sideColor = side === "usc" ? USC_RED : UCLA_BLUE;
  const emailDomain = side === "usc" ? "@usc.edu" : "@ucla.edu";
  const sideName = side === "usc" ? "USC" : "UCLA";
  const isValidEmail = email.toLowerCase().endsWith(emailDomain);
  const passwordsMatch = password === confirmPassword;
  const isValid = isValidEmail && password.length >= 6 && passwordsMatch && confirmPassword.length > 0;

  const handleSignup = async () => {
    Keyboard.dismiss();
    if (!isValidEmail) { Alert.alert("Invalid Email", `Please use your ${emailDomain} email.`); return; }
    if (password.length < 6) { Alert.alert("Weak Password", "Password must be at least 6 characters."); return; }
    if (!passwordsMatch) { Alert.alert("Password Mismatch", "Passwords don't match."); return; }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
      // Send verification email via Resend Cloud Function
      try {
        const functions = getFunctions();
        const sendVerification = httpsCallable(functions, "sendVerificationEmail");
        await sendVerification();
      } catch (emailError) {
        console.warn("[Signup] Verification email error:", emailError);
      }
      router.replace({ pathname: "/onboarding/waitingVerify", params: { side } });
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("Account Exists", "This email is already registered. Try logging in.");
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
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
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: "28%" }]} /></View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.titleSection}>
            <View style={[styles.sideBadge, { backgroundColor: sideColor }]}><Text style={styles.sideBadgeText}>{sideName}</Text></View>
            <Text style={styles.title}>Verify Your School</Text>
            <Text style={styles.subtitle}>Enter your {emailDomain} email to prove you're a {side === "usc" ? "Trojan" : "Bruin"}</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>School Email</Text>
            <View style={styles.inputContainer}>
              <FontAwesome name="envelope" size={16} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder={`you${emailDomain}`} placeholderTextColor="rgba(255,255,255,0.2)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
              {email.length > 0 && <FontAwesome name={isValidEmail ? "check-circle" : "times-circle"} size={18} color={isValidEmail ? "#10B981" : "#EF4444"} />}
            </View>
            {email.length > 0 && !isValidEmail && <Text style={styles.errorText}>Must be a {emailDomain} email</Text>}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputContainer}>
              <FontAwesome name="lock" size={16} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
              <TextInput ref={passwordRef} style={styles.input} placeholder="At least 6 characters" placeholderTextColor="rgba(255,255,255,0.2)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><FontAwesome name={showPassword ? "eye-slash" : "eye"} size={18} color="rgba(255,255,255,0.3)" /></TouchableOpacity>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <FontAwesome name="lock" size={16} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
              <TextInput ref={confirmRef} style={styles.input} placeholder="Re-enter password" placeholderTextColor="rgba(255,255,255,0.2)" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoCapitalize="none" returnKeyType="done" onSubmitEditing={handleSignup} />
              {confirmPassword.length > 0 && <FontAwesome name={passwordsMatch ? "check-circle" : "times-circle"} size={18} color={passwordsMatch ? "#10B981" : "#EF4444"} />}
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable onPress={handleSignup} disabled={!isValid || loading} style={[styles.continueButton, (!isValid || loading) && styles.disabled]}>
            {loading ? <ActivityIndicator color="#1E293B" /> : <><Text style={styles.continueText}>Create Account</Text><FontAwesome name="arrow-right" size={18} color="#1E293B" /></>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  progressBar: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 },
  progressFill: { height: "100%", backgroundColor: ACCENT, borderRadius: 2 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
  titleSection: { alignItems: "center", marginBottom: 32 },
  sideBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, marginBottom: 16 },
  sideBadgeText: { fontSize: 14, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 22 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: "#fff" },
  errorText: { fontSize: 13, color: "#EF4444", marginTop: 6, marginLeft: 4 },
  footer: { paddingHorizontal: 24, paddingTop: 16 },
  continueButton: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 18, gap: 10, ...Platform.select({ ios: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12 }, android: { elevation: 8 } }) },
  disabled: { opacity: 0.4 },
  continueText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
});
