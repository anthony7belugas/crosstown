// app/auth/login.tsx
import { FontAwesome } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { NEUTRAL_ACCENT } from "../../utils/colors";


export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password) { Alert.alert("Missing Fields", "Enter your email and password."); return; }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);

      // Determine side from email
      const userEmail = cred.user.email || "";
      const side = userEmail.endsWith("@usc.edu") ? "usc" : "ucla";

      // Check if email is verified
      if (!cred.user.emailVerified) {
        router.replace({ pathname: "/onboarding/waitingVerify", params: { side } });
        return;
      }

      // Check profile completion — route to correct onboarding step
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      const data = userDoc.exists() ? userDoc.data() : null;

      if (!data || !data.name) {
        router.replace({ pathname: "/onboarding/name", params: { side } });
      } else if (!data.photos || data.photos.length === 0) {
        router.replace({ pathname: "/onboarding/photos", params: { side } });
      } else if (data.profileCompleted !== true) {
        router.replace({ pathname: "/onboarding/profileInfo", params: { side } });
      } else {
        router.replace("/(tabs)/duels");
      }
    } catch (error: any) {
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        Alert.alert("Login Failed", "Invalid email or password.");
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={20} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to keep playing</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputContainer}>
              <FontAwesome name="envelope" size={16} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="you@usc.edu or @ucla.edu" placeholderTextColor="rgba(255,255,255,0.2)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputContainer}>
              <FontAwesome name="lock" size={16} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
              <TextInput ref={passwordRef} style={styles.input} placeholder="Your password" placeholderTextColor="rgba(255,255,255,0.2)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" returnKeyType="done" onSubmitEditing={handleLogin} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><FontAwesome name={showPassword ? "eye-slash" : "eye"} size={18} color="rgba(255,255,255,0.3)" /></TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable onPress={handleLogin} disabled={loading || !email.trim() || !password} style={[styles.loginButton, (loading || !email.trim() || !password) && styles.disabled]}>
            {loading ? <ActivityIndicator color="#1E293B" /> : <><Text style={styles.loginButtonText}>Log In</Text><FontAwesome name="arrow-right" size={18} color="#1E293B" /></>}
          </Pressable>
          <View style={styles.legalContainer}>
            <Text style={styles.legalText}>By logging in, you agree to our </Text>
            <Link href="/legal/terms" asChild>
              <TouchableOpacity><Text style={styles.legalLink}>Terms</Text></TouchableOpacity>
            </Link>
            <Text style={styles.legalText}> & </Text>
            <Link href="/legal/privacy" asChild>
              <TouchableOpacity><Text style={styles.legalLink}>Privacy Policy</Text></TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40 },
  title: { fontSize: 32, fontWeight: "800", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 32 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: "#fff" },
  footer: { paddingHorizontal: 24, paddingTop: 16 },
  loginButton: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL_ACCENT, borderRadius: 16, paddingVertical: 18, gap: 10, ...Platform.select({ ios: { shadowColor: NEUTRAL_ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12 }, android: { elevation: 8 } }) },
  disabled: { opacity: 0.4 },
  loginButtonText: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  legalContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 16, paddingHorizontal: 10 },
  legalText: { fontSize: 12, color: "rgba(255,255,255,0.55)" },
  legalLink: { fontSize: 12, fontWeight: "600", color: NEUTRAL_ACCENT },
});
