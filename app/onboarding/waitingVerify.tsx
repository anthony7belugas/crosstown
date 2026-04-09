// app/onboarding/waitingVerify.tsx
// Polls Firebase Auth until email is verified, then continues onboarding
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../firebaseConfig";

const GOLD = "#FFD100";

export default function WaitingVerifyScreen() {
  const { side } = useLocalSearchParams<{ side: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [resendCooldown, setResendCooldown] = useState(0);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Spin animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  // Poll for verification every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) {
          clearInterval(interval);
          router.replace({ pathname: "/onboarding/nameAndDob", params: { side } });
        }
      } catch (e) {
        // ignore reload errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || !auth.currentUser) return;
    try {
      const functions = getFunctions();
      const sendVerification = httpsCallable(functions, "sendVerificationEmail");
      await sendVerification();
      setResendCooldown(60);
      Alert.alert("Email Sent", "Check your inbox (and spam folder).");
    } catch {
      Alert.alert("Error", "Could not resend. Try again in a minute.");
    }
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.spinnerContainer, { transform: [{ rotate: spin }] }]}>
          <FontAwesome name="circle-o-notch" size={50} color={GOLD} />
        </Animated.View>
        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to{"\n"}
          <Text style={styles.emailText}>{auth.currentUser?.email}</Text>
        </Text>
        <Text style={styles.hint}>Click the link in the email, then come back here. We'll detect it automatically.</Text>
        <Pressable onPress={handleResend} disabled={resendCooldown > 0} style={[styles.resendButton, resendCooldown > 0 && styles.resendDisabled]}>
          <Text style={styles.resendText}>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Email"}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => { auth.signOut(); router.replace("/"); }} style={styles.cancelButton}>
        <Text style={styles.cancelText}>Cancel & Start Over</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 32 },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  spinnerContainer: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 12 },
  subtitle: { fontSize: 16, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 24 },
  emailText: { color: GOLD, fontWeight: "600" },
  hint: { fontSize: 14, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 20, lineHeight: 20 },
  resendButton: { marginTop: 32, paddingVertical: 14, paddingHorizontal: 28, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  resendDisabled: { opacity: 0.4 },
  resendText: { fontSize: 16, fontWeight: "600", color: GOLD },
  cancelButton: { paddingVertical: 16 },
  cancelText: { fontSize: 15, color: "rgba(255,255,255,0.3)" },
});
