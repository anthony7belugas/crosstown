// app/index.tsx
// Welcome screen — "Date Your Rival"
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ACCENT, USC_RED, UCLA_BLUE, ACCENT_LIGHT, ACCENT_MEDIUM, ACCENT_GLOW } from "../utils/colors";
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(15)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.8)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslate = useRef(new Animated.Value(25)).current;
  const loginOpacity = useRef(new Animated.Value(0)).current;
  const vsGlow = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered animations
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 500,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslate, {
          toValue: 0,
          duration: 500,
          delay: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(badgeOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(buttonTranslate, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(loginOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // VS glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(vsGlow, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(vsGlow, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const vsGlowScale = vsGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <View style={styles.container}>
      {/* Background rivalry split */}
      <View style={styles.splitBackground}>
        <View style={[styles.splitHalf, { backgroundColor: USC_RED }]} />
        <View style={[styles.splitHalf, { backgroundColor: UCLA_BLUE }]} />
      </View>

      {/* Dark overlay for readability */}
      <View style={styles.overlay} />

      {/* Decorative diagonal line */}
      <View style={styles.diagonalContainer}>
        <View style={styles.diagonal} />
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
        {/* Logo section */}
        <View style={styles.logoSection}>
          <Animated.View
            style={[
              styles.vsContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }, { scale: vsGlowScale }],
              },
            ]}
          >
            <Text style={styles.vsText}>VS</Text>
          </Animated.View>

          <Animated.Text
            style={[
              styles.title,
              {
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslate }],
              },
            ]}
          >
            CrossTown
          </Animated.Text>

          <Animated.Text
            style={[
              styles.tagline,
              {
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslate }],
              },
            ]}
          >
            Date Your Rival
          </Animated.Text>

          <Animated.View
            style={[
              styles.badge,
              {
                opacity: badgeOpacity,
                transform: [{ scale: badgeScale }],
              },
            ]}
          >
            <FontAwesome name="lock" size={12} color={ACCENT} />
            <Text style={styles.badgeText}>USC & UCLA Students Only</Text>
          </Animated.View>
        </View>

        {/* Bottom section */}
        <View style={styles.bottomSection}>
          <Animated.View
            style={{
              opacity: buttonOpacity,
              transform: [
                { translateY: buttonTranslate },
                { scale: buttonScale },
              ],
              width: "100%",
            }}
          >
            <Pressable
              onPress={() => router.push("/onboarding/pickSide")}
              onPressIn={() => {
                Animated.spring(buttonScale, {
                  toValue: 0.97,
                  tension: 300,
                  friction: 10,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(buttonScale, {
                  toValue: 1,
                  tension: 300,
                  friction: 10,
                  useNativeDriver: true,
                }).start();
              }}
              style={styles.getStartedButton}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
              <FontAwesome name="arrow-right" size={18} color="#1E293B" />
            </Pressable>
          </Animated.View>

          <Animated.View style={{ opacity: loginOpacity }}>
            <Pressable
              onPress={() => router.push("/auth/login")}
              style={styles.loginButton}
            >
              <Text style={styles.loginText}>
                Already have an account?{" "}
                <Text style={styles.loginTextBold}>Log In</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  splitBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  splitHalf: {
    flex: 1,
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  diagonalContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  diagonal: {
    width: 2,
    height: "120%",
    backgroundColor: ACCENT_MEDIUM,
    transform: [{ rotate: "15deg" }],
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logoSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  vsContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 2,
    borderColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
    }),
  },
  vsText: {
    fontSize: 36,
    fontWeight: "900",
    color: ACCENT,
    letterSpacing: 4,
  },
  title: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 20,
    fontWeight: "600",
    color: ACCENT,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 24,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ACCENT_GLOW,
    gap: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
    letterSpacing: 0.5,
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
  },
  getStartedButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    letterSpacing: 0.3,
  },
  loginButton: {
    paddingVertical: 16,
  },
  loginText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.5)",
  },
  loginTextBold: {
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.8)",
  },
});
