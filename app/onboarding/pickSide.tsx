// app/onboarding/pickSide.tsx
// Screen 2 — Pick your side (USC or UCLA)
// Arena energy carried from welcome screen — this is the first real decision
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
import {
  BG_PRIMARY,
  USC_RED,
  UCLA_BLUE,
  NEUTRAL_ACCENT,
  schoolColor,
} from "../../utils/colors";

export default function PickSideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<"usc" | "ucla" | null>(null);

  /* ── entrance animations ── */
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(12)).current;
  const uscOp = useRef(new Animated.Value(0)).current;
  const uscX = useRef(new Animated.Value(-30)).current;
  const uclaOp = useRef(new Animated.Value(0)).current;
  const uclaX = useRef(new Animated.Value(30)).current;
  const vsOp = useRef(new Animated.Value(0)).current;
  const vsScale = useRef(new Animated.Value(0.6)).current;
  const progressOp = useRef(new Animated.Value(0)).current;

  /* ── selection animations ── */
  const uscScale = useRef(new Animated.Value(1)).current;
  const uclaScale = useRef(new Animated.Value(1)).current;
  const uscDim = useRef(new Animated.Value(1)).current; // dims when UCLA selected
  const uclaDim = useRef(new Animated.Value(1)).current; // dims when USC selected
  const buttonOp = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(16)).current;
  const buttonPress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(120, [
      // progress bar
      Animated.timing(progressOp, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // title
      Animated.parallel([
        Animated.timing(titleOp, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // USC card slides in from left
      Animated.parallel([
        Animated.timing(uscOp, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(uscX, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // VS slams in
      Animated.parallel([
        Animated.timing(vsOp, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(vsScale, {
          toValue: 1,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
      // UCLA card slides in from right
      Animated.parallel([
        Animated.timing(uclaOp, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(uclaX, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  /* ── selection handler ── */
  const handleSelect = (side: "usc" | "ucla") => {
    setSelected(side);

    const isUSC = side === "usc";

    // Pop the selected card
    Animated.spring(isUSC ? uscScale : uclaScale, {
      toValue: 1.03,
      tension: 200,
      friction: 8,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(isUSC ? uscScale : uclaScale, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }).start();
    });

    // Reset the other card scale in case it was previously selected
    Animated.spring(isUSC ? uclaScale : uscScale, {
      toValue: 1,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Dim the unselected card, brighten the selected
    Animated.parallel([
      Animated.timing(isUSC ? uscDim : uclaDim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(isUSC ? uclaDim : uscDim, {
        toValue: 0.5,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Show continue button
    Animated.parallel([
      Animated.timing(buttonOp, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(buttonY, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleContinue = () => {
    if (!selected) return;
    router.push({
      pathname: "/onboarding/emailVerify",
      params: { side: selected },
    });
  };

  const accent = selected ? schoolColor(selected) : NEUTRAL_ACCENT;

  return (
    <View style={st.container}>
      {/* ── Header — back button only (no progress bar pre-signup) ── */}
      <Animated.View
        style={[
          st.header,
          { paddingTop: insets.top + 10, opacity: progressOp },
        ]}
      >
        <Pressable style={st.backButton} onPress={() => router.back()}>
          <FontAwesome
            name="arrow-left"
            size={20}
            color="rgba(255,255,255,0.6)"
          />
        </Pressable>
      </Animated.View>

      {/* ── Content ── */}
      <View style={st.content}>
        {/* Title */}
        <Animated.View
          style={[
            st.titleSection,
            {
              opacity: titleOp,
              transform: [{ translateY: titleY }],
            },
          ]}
        >
          <Text style={st.title}>Pick Your Side</Text>
          <Text style={st.subtitle}>
            This decides everything — your color, your rivals, your team.
          </Text>
        </Animated.View>

        {/* Cards */}
        <View style={st.cardsContainer}>
          {/* ── USC Card ── */}
          <Animated.View
            style={{
              opacity: Animated.multiply(uscOp, uscDim),
              transform: [{ translateX: uscX }, { scale: uscScale }],
            }}
          >
            <Pressable
              style={[
                st.sideCard,
                selected === "usc" && st.sideCardSelectedUSC,
              ]}
              onPress={() => handleSelect("usc")}
            >
              {/* Left color edge */}
              <View style={[st.colorEdge, { backgroundColor: USC_RED }]} />

              <View style={st.cardInner}>
                <View style={st.cardTextGroup}>
                  <Text
                    allowFontScaling={false}
                    style={[
                      st.schoolName,
                      selected === "usc" && { color: USC_RED },
                    ]}
                  >
                    USC
                  </Text>
                  <Text style={st.schoolDetail}>
                    Trojans · University Park
                  </Text>
                </View>

                {selected === "usc" ? (
                  <View
                    style={[st.checkCircle, { backgroundColor: USC_RED }]}
                  >
                    <FontAwesome name="check" size={14} color="#fff" />
                  </View>
                ) : (
                  <View style={st.emptyCircle} />
                )}
              </View>
            </Pressable>
          </Animated.View>

          {/* ── VS Divider ── */}
          <Animated.View
            style={[
              st.vsDivider,
              {
                opacity: vsOp,
                transform: [{ scale: vsScale }],
              },
            ]}
          >
            <View style={[st.vsLine, { backgroundColor: USC_RED }]} />
            <Text
              allowFontScaling={false}
              style={[st.vsText, selected && { color: accent }]}
            >
              VS
            </Text>
            <View style={[st.vsLine, { backgroundColor: UCLA_BLUE }]} />
          </Animated.View>

          {/* ── UCLA Card ── */}
          <Animated.View
            style={{
              opacity: Animated.multiply(uclaOp, uclaDim),
              transform: [{ translateX: uclaX }, { scale: uclaScale }],
            }}
          >
            <Pressable
              style={[
                st.sideCard,
                selected === "ucla" && st.sideCardSelectedUCLA,
              ]}
              onPress={() => handleSelect("ucla")}
            >
              {/* Left color edge */}
              <View style={[st.colorEdge, { backgroundColor: UCLA_BLUE }]} />

              <View style={st.cardInner}>
                <View style={st.cardTextGroup}>
                  <Text
                    allowFontScaling={false}
                    style={[
                      st.schoolName,
                      selected === "ucla" && { color: UCLA_BLUE },
                    ]}
                  >
                    UCLA
                  </Text>
                  <Text style={st.schoolDetail}>
                    Bruins · Westwood
                  </Text>
                </View>

                {selected === "ucla" ? (
                  <View
                    style={[st.checkCircle, { backgroundColor: UCLA_BLUE }]}
                  >
                    <FontAwesome name="check" size={14} color="#fff" />
                  </View>
                ) : (
                  <View style={st.emptyCircle} />
                )}
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* ── Continue Button ── */}
      <Animated.View
        style={[
          st.footer,
          {
            paddingBottom: insets.bottom + 20,
            opacity: buttonOp,
            transform: [{ translateY: buttonY }],
          },
        ]}
      >
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          onPressIn={() =>
            Animated.spring(buttonPress, {
              toValue: 0.96,
              tension: 300,
              friction: 10,
              useNativeDriver: true,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(buttonPress, {
              toValue: 1,
              tension: 300,
              friction: 10,
              useNativeDriver: true,
            }).start()
          }
          style={[
            st.continueButton,
            {
              backgroundColor: accent,
              ...Platform.select({
                ios: {
                  shadowColor: accent,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                },
                android: { elevation: 8 },
              }),
            },
          ]}
        >
          <Animated.View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              transform: [{ scale: buttonPress }],
            }}
          >
            <Text allowFontScaling={false} style={st.continueText}>
              Continue
            </Text>
            <FontAwesome name="arrow-right" size={18} color="#1E293B" />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════ */
const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
  },

  /* ── Header ── */
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

  /* ── Content ── */
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 44,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  /* ── Cards ── */
  cardsContainer: {
    gap: 0,
  },
  sideCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    height: 88,
  },
  sideCardSelectedUSC: {
    borderColor: USC_RED,
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    ...Platform.select({
      ios: {
        shadowColor: USC_RED,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
    }),
  },
  sideCardSelectedUCLA: {
    borderColor: UCLA_BLUE,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    ...Platform.select({
      ios: {
        shadowColor: UCLA_BLUE,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
    }),
  },
  colorEdge: {
    width: 5,
    height: "100%",
  },
  cardInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cardTextGroup: {
    flex: 1,
  },
  schoolName: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1.5,
  },
  schoolDetail: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.35)",
    marginTop: 3,
    letterSpacing: 0.3,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },

  /* ── VS Divider ── */
  vsDivider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 14,
  },
  vsLine: {
    flex: 1,
    height: 1,
    opacity: 0.25,
  },
  vsText: {
    fontSize: 24,
    fontWeight: "900",
    color: "rgba(226, 232, 240, 0.5)",
    letterSpacing: 5,
  },

  /* ── Footer ── */
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  continueButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 18,
  },
  continueText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    letterSpacing: 0.3,
  },
});
