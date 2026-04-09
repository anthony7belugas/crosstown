// app/onboarding/pickSide.tsx
// Screen 2 — Pick your side (USC or UCLA)
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

const CARDINAL = "#9B1B30";
const BRUIN_BLUE = "#2774AE";
const GOLD = "#FFD100";

export default function PickSideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<"usc" | "ucla" | null>(null);

  // Animations
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(cardTranslate, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // Show continue button when a side is selected
  useEffect(() => {
    if (selected) {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [selected]);

  const handleContinue = () => {
    if (!selected) return;
    router.push({
      pathname: "/onboarding/emailVerify",
      params: { side: selected },
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View style={[styles.titleSection, { opacity: titleOpacity }]}>
          <Text style={styles.title}>Pick Your Side</Text>
          <Text style={styles.subtitle}>Which school are you repping?</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.cardsContainer,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslate }],
            },
          ]}
        >
          {/* USC Card */}
          <Pressable
            style={[
              styles.sideCard,
              { borderColor: CARDINAL },
              selected === "usc" && styles.sideCardSelected,
              selected === "usc" && { borderColor: CARDINAL, backgroundColor: "rgba(155, 27, 48, 0.15)" },
            ]}
            onPress={() => setSelected("usc")}
          >
            <View style={[styles.colorStripe, { backgroundColor: CARDINAL }]} />
            <View style={styles.cardContent}>
              <Text style={styles.schoolName}>USC</Text>
              <Text style={styles.schoolMascot}>Trojans</Text>
              <Text style={styles.schoolEmail}>@usc.edu</Text>
            </View>
            {selected === "usc" && (
              <View style={[styles.checkCircle, { backgroundColor: CARDINAL }]}>
                <FontAwesome name="check" size={16} color="#fff" />
              </View>
            )}
          </Pressable>

          {/* VS divider */}
          <View style={styles.vsDivider}>
            <View style={styles.vsLine} />
            <Text style={styles.vsSmall}>VS</Text>
            <View style={styles.vsLine} />
          </View>

          {/* UCLA Card */}
          <Pressable
            style={[
              styles.sideCard,
              { borderColor: BRUIN_BLUE },
              selected === "ucla" && styles.sideCardSelected,
              selected === "ucla" && { borderColor: BRUIN_BLUE, backgroundColor: "rgba(39, 116, 174, 0.15)" },
            ]}
            onPress={() => setSelected("ucla")}
          >
            <View style={[styles.colorStripe, { backgroundColor: BRUIN_BLUE }]} />
            <View style={styles.cardContent}>
              <Text style={styles.schoolName}>UCLA</Text>
              <Text style={styles.schoolMascot}>Bruins</Text>
              <Text style={styles.schoolEmail}>@ucla.edu</Text>
            </View>
            {selected === "ucla" && (
              <View style={[styles.checkCircle, { backgroundColor: BRUIN_BLUE }]}>
                <FontAwesome name="check" size={16} color="#fff" />
              </View>
            )}
          </Pressable>
        </Animated.View>
      </View>

      {/* Continue Button */}
      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 20, opacity: buttonOpacity },
        ]}
      >
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
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
          style={[styles.continueButton, !selected && styles.continueButtonDisabled]}
        >
          <Animated.View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              transform: [{ scale: buttonScale }],
            }}
          >
            <Text style={styles.continueText}>Continue</Text>
            <FontAwesome name="arrow-right" size={18} color="#1E293B" />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
  },
  cardsContainer: {
    gap: 0,
  },
  sideCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    height: 100,
  },
  sideCardSelected: {
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
    }),
  },
  colorStripe: {
    width: 6,
    height: "100%",
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  schoolName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  schoolMascot: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  schoolEmail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    marginTop: 4,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  vsDivider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 12,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 209, 0, 0.15)",
  },
  vsSmall: {
    fontSize: 16,
    fontWeight: "800",
    color: GOLD,
    letterSpacing: 3,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  continueButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 18,
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    letterSpacing: 0.3,
  },
});
