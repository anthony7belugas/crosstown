// app/index.tsx
// Welcome screen — arena entry (dark theme, consistent with app)
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
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
  const reduceMotion = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

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
  const vsGlowOp = useRef(new Animated.Value(1)).current;
  const bracketGlow = useRef(new Animated.Value(1)).current;

  /* ── button press ── */
  const btnPress = useRef(new Animated.Value(1)).current;

  /* ── jump everything to final state (for reduced motion) ── */
  const jumpToFinal = () => {
    heroOp.setValue(1);
    heroScale.setValue(1);
    dividerOp.setValue(1);
    dividerScaleX.setValue(1);
    faceoffOp.setValue(1);
    faceoffY.setValue(0);
    bracketOp.setValue(1);
    btnOp.setValue(1);
    btnY.setValue(0);
    loginOp.setValue(1);
    vsGlowOp.setValue(1);
    bracketGlow.setValue(1);
  };

  useEffect(() => {
    /* ── reduced motion: check + live listener ── */
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotion.current = enabled;
      if (enabled) {
        jumpToFinal();
        return;
      }
      cleanupRef.current = startAnimations();
    });

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        reduceMotion.current = enabled;
        if (enabled) {
          if (cleanupRef.current) cleanupRef.current();
          cleanupRef.current = null;
          jumpToFinal();
        }
      }
    );

    return () => {
      sub.remove();
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  /* ── animation orchestration ── */
  const startAnimations = (): (() => void) => {
    const mkLoop = (v: Animated.Value, lo: number, hi: number, ms: number) =>
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

    // pre-build loops (not started yet)
    const vsLoop = mkLoop(vsGlowOp, 0.78, 1, 2400);
    const brackLoop = mkLoop(bracketGlow, 0.45, 1, 3200);

    // entrance sequence — loops start in .start() callback
    // so they're guaranteed to fire only after entrance completes
    Animated.stagger(100, [
      // 1. hero
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
      // 2. divider expands from center
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
      // 3. face-off row
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
      // 4. brackets
      Animated.timing(bracketOp, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // 5. button
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
      // 6. login
      Animated.timing(loginOp, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // entrance done — safe to start loops with no timing conflict
      vsLoop.start();
      brackLoop.start();
    });

    return () => {
      vsLoop.stop();
      brackLoop.stop();
    };
  };

  /* ── button press (respects reduced motion) ── */
  const onPressIn = () => {
    if (reduceMotion.current) return;
    Animated.spring(btnPress, {
      toValue: 0.96,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    if (reduceMotion.current) return;
    Animated.spring(btnPress, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={st.container}>
      {/* ═══ BACKGROUND — all static, never animated ═══ */}

      <View style={st.splitBg}>
        <View style={[st.splitHalf, { backgroundColor: USC_RED }]} />
        <View style={[st.splitHalf, { backgroundColor: UCLA_BLUE }]} />
      </View>

      <View style={st.overlay} />

      <View style={st.diagWrap}>
        <View style={st.diagLine} />
      </View>

      <View style={[st.edgeBar, st.edgeL]} />
      <View style={[st.edgeBar, st.edgeR]} />

      <Animated.View
        style={[
          st.brk,
          st.brkTL,
          { opacity: Animated.multiply(bracketOp, bracketGlow) },
        ]}
      />
      <Animated.View
        style={[
          st.brk,
          st.brkTR,
          { opacity: Animated.multiply(bracketOp, bracketGlow) },
        ]}
      />
      <Animated.View
        style={[
          st.brk,
          st.brkBL,
          { opacity: Animated.multiply(bracketOp, bracketGlow) },
        ]}
      />
      <Animated.View
        style={[
          st.brk,
          st.brkBR,
          { opacity: Animated.multiply(bracketOp, bracketGlow) },
        ]}
      />

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
          <Animated.Text
            allowFontScaling={false}
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

          <Animated.View
            style={[
              st.faceoff,
              {
                opacity: faceoffOp,
                transform: [{ translateY: faceoffY }],
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[st.schoolName, { color: USC_RED }]}
            >
              USC
            </Text>
            <Animated.Text
              allowFontScaling={false}
              style={[st.vsText, { opacity: vsGlowOp }]}
            >
              VS
            </Animated.Text>
            <Text
              allowFontScaling={false}
              style={[st.schoolName, { color: UCLA_BLUE }]}
            >
              UCLA
            </Text>
          </Animated.View>
        </View>

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
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={st.btn}
            >
              <Text allowFontScaling={false} style={st.btnText}>
                Enter the Rivalry
              </Text>
              <FontAwesome name="arrow-right" size={17} color="#FFFFFF" />
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

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
  },

  splitBg: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  splitHalf: {
    flex: 1,
    opacity: 0.4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },

  diagWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  diagLine: {
    width: 2,
    height: "130%",
    backgroundColor: "rgba(226, 232, 240, 0.14)",
    transform: [{ rotate: "20deg" }],
  },

  edgeBar: {
    position: "absolute",
    top: 0,
    width: 3,
    height: "100%",
  },
  edgeL: {
    left: 0,
    backgroundColor: USC_RED,
    opacity: 0.45,
  },
  edgeR: {
    right: 0,
    backgroundColor: UCLA_BLUE,
    opacity: 0.45,
  },

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

  hero: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: NEUTRAL_ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
    }),
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  divLine: {
    width: 52,
    height: 1.5,
    opacity: 0.7,
  },
  divDot: {
    width: 5,
    height: 5,
    backgroundColor: NEUTRAL_ACCENT,
    opacity: 0.3,
    transform: [{ rotate: "45deg" }],
  },

  faceoff: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  schoolName: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 3,
  },
  vsText: {
    fontSize: 44,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 6,
  },

  bottom: {
    width: "100%",
    alignItems: "center",
  },
  btn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(226, 232, 240, 0.38)",
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
  },
  btnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
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
