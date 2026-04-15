// app/index.tsx
// Welcome screen — arena entry (dark theme, consistent with app)
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
import {
  BG_PRIMARY,
  USC_RED,
  UCLA_BLUE,
  NEUTRAL_ACCENT,
} from "../utils/colors";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /* ── entrance animations ── */
  const heroOp = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.8)).current;
  const dividerOp = useRef(new Animated.Value(0)).current;
  const dividerScaleX = useRef(new Animated.Value(0)).current;
  const faceoffOp = useRef(new Animated.Value(0)).current;
  const faceoffY = useRef(new Animated.Value(14)).current;
  const bracketOp = useRef(new Animated.Value(0)).current;
  const btnOp = useRef(new Animated.Value(0)).current;
  const btnY = useRef(new Animated.Value(24)).current;
  const loginOp = useRef(new Animated.Value(0)).current;

  /* ── looping pulses ── */
  const vsGlow = useRef(new Animated.Value(1)).current;
  const bracketPulse = useRef(new Animated.Value(0.25)).current;

  /* ── button press ── */
  const btnPress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = (v: Animated.Value, lo: number, hi: number, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: hi,
            duration: ms,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: lo,
            duration: ms,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

    /* ── entrance ── */
    Animated.stagger(100, [
      // hero
      Animated.parallel([
        Animated.timing(heroOp, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(heroScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      // divider expands from center
      Animated.parallel([
        Animated.timing(dividerOp, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(dividerScaleX, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // face-off row
      Animated.parallel([
        Animated.timing(faceoffOp, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(faceoffY, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // brackets
      Animated.timing(bracketOp, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // button
      Animated.parallel([
        Animated.timing(btnOp, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(btnY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // login
      Animated.timing(loginOp, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    /* ── pulses (content only, never background) ── */
    const t1 = setTimeout(() => loop(vsGlow, 0.9, 1.1, 2400).start(), 1000);
    const t2 = setTimeout(
      () => loop(bracketPulse, 0.15, 0.45, 3200).start(),
      1200
    );

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const bracketFinal = Animated.multiply(bracketOp, bracketPulse);

  return (
    <View style={st.container}>
      {/* ═══ BACKGROUND — static, never animated ═══ */}

      {/* Color split — school colors at low opacity */}
      <View style={st.splitBg}>
        <View style={[st.splitHalf, { backgroundColor: USC_RED }]} />
        <View style={[st.splitHalf, { backgroundColor: UCLA_BLUE }]} />
      </View>

      {/* Dark overlay to mute the colors */}
      <View style={st.overlay} />

      {/* Diagonal line across the split */}
      <View style={st.diagWrap}>
        <View style={st.diagLine} />
      </View>

      {/* Edge accent bars */}
      <View style={[st.edgeBar, st.edgeL]} />
      <View style={[st.edgeBar, st.edgeR]} />

      {/* Corner brackets */}
      <Animated.View style={[st.brk, st.brkTL, { opacity: bracketFinal }]} />
      <Animated.View style={[st.brk, st.brkTR, { opacity: bracketFinal }]} />
      <Animated.View style={[st.brk, st.brkBL, { opacity: bracketFinal }]} />
      <Animated.View style={[st.brk, st.brkBR, { opacity: bracketFinal }]} />

      {/* ═══ CONTENT ═══ */}
      <View
        style={[
          st.content,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 32,
          },
        ]}
      >
        <View style={st.center}>
          {/* Hero — CrossTown */}
          <Animated.Text
            style={[
              st.hero,
              {
                opacity: heroOp,
                transform: [{ scale: heroScale }],
              },
            ]}
          >
            CrossTown
          </Animated.Text>

          {/* Accent divider: red line ◆ blue line */}
          <Animated.View
            style={[
              st.divider,
              {
                opacity: dividerOp,
                transform: [{ scaleX: dividerScaleX }],
              },
            ]}
          >
            <View style={[st.divLine, { backgroundColor: USC_RED }]} />
            <View style={st.divDot} />
            <View style={[st.divLine, { backgroundColor: UCLA_BLUE }]} />
          </Animated.View>

          {/* Face-off — USC  VS  UCLA */}
          <Animated.View
            style={[
              st.faceoff,
              {
                opacity: faceoffOp,
                transform: [{ translateY: faceoffY }, { scale: vsGlow }],
              },
            ]}
          >
            <Text style={[st.schoolName, { color: USC_RED }]}>USC</Text>
            <Text style={st.vsText}>VS</Text>
            <Text style={[st.schoolName, { color: UCLA_BLUE }]}>UCLA</Text>
          </Animated.View>
        </View>

        {/* ── Bottom ── */}
        <View style={st.bottom}>
          <Animated.View
            style={{
              opacity: btnOp,
              transform: [{ translateY: btnY }, { scale: btnPress }],
              width: "100%",
            }}
          >
            <Pressable
              onPress={() => router.push("/onboarding/pickSide")}
              onPressIn={() =>
                Animated.spring(btnPress, {
                  toValue: 0.96,
                  tension: 300,
                  friction: 10,
                  useNativeDriver: true,
                }).start()
              }
              onPressOut={() =>
                Animated.spring(btnPress, {
                  toValue: 1,
                  tension: 300,
                  friction: 10,
                  useNativeDriver: true,
                }).start()
              }
              style={st.btn}
            >
              <Text style={st.btnText}>Enter the Rivalry</Text>
              <FontAwesome name="arrow-right" size={17} color="#0F172A" />
            </Pressable>
          </Animated.View>

          <Animated.View style={{ opacity: loginOp }}>
            <Pressable
              onPress={() => router.push("/auth/login")}
              style={st.loginWrap}
            >
              <Text style={st.loginText}>
                Already have an account?{" "}
                <Text style={st.loginBold}>Log In</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES — all background elements use STATIC opacity
   only content elements are animated
   ═══════════════════════════════════════════════════ */
const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY, // #0F172A — consistent with entire app
  },

  /* ── Background split (static, low opacity + overlay) ── */
  splitBg: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  splitHalf: {
    flex: 1,
    opacity: 0.25, // muted by overlay below
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.55)", // darkens the color halves
  },

  /* ── Diagonal line ── */
  diagWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  diagLine: {
    width: 1.5,
    height: "130%",
    backgroundColor: "rgba(226, 232, 240, 0.10)",
    transform: [{ rotate: "12deg" }],
  },

  /* ── Edge bars ── */
  edgeBar: {
    position: "absolute",
    top: 0,
    width: 3,
    height: "100%",
  },
  edgeL: {
    left: 0,
    backgroundColor: USC_RED,
    opacity: 0.35,
  },
  edgeR: {
    right: 0,
    backgroundColor: UCLA_BLUE,
    opacity: 0.35,
  },

  /* ── Corner brackets ── */
  brk: {
    position: "absolute",
    width: 26,
    height: 26,
  },
  brkTL: {
    top: 54,
    left: 16,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: USC_RED,
  },
  brkBL: {
    bottom: 54,
    left: 16,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: USC_RED,
  },
  brkTR: {
    top: 54,
    right: 16,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: UCLA_BLUE,
  },
  brkBR: {
    bottom: 54,
    right: 16,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: UCLA_BLUE,
  },

  /* ── Content ── */
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    zIndex: 10,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Hero text ── */
  hero: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: NEUTRAL_ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
    }),
  },

  /* ── Accent divider ── */
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  divLine: {
    width: 36,
    height: 1.5,
    opacity: 0.5,
  },
  divDot: {
    width: 5,
    height: 5,
    backgroundColor: NEUTRAL_ACCENT,
    opacity: 0.3,
    transform: [{ rotate: "45deg" }],
  },

  /* ── Face-off row ── */
  faceoff: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  schoolName: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 3,
  },
  vsText: {
    fontSize: 15,
    fontWeight: "700",
    color: NEUTRAL_ACCENT,
    opacity: 0.4,
    letterSpacing: 4,
  },

  /* ── Bottom ── */
  bottom: {
    width: "100%",
    alignItems: "center",
  },
  btn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEUTRAL_ACCENT, // #E2E8F0 — matches pre-side-pick accent
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: NEUTRAL_ACCENT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  btnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    letterSpacing: 0.3,
  },
  loginWrap: {
    paddingVertical: 16,
  },
  loginText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.5)",
  },
  loginBold: {
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.8)",
  },
});
