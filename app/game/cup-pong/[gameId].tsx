// app/game/cup-pong/[gameId].tsx
// Cup Pong — flick upward to throw. No guides, no preview.
// Swipe angle = left/right aim. Swipe speed = how far the ball reaches.
// Hit detection checks if the ball lands near a standing cup.
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing, PanResponder,
  Pressable, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebaseConfig";
import {
  Game, CUPS_PER_SIDE, INITIAL_CUPS,
  getCupCenter, getCupPosition, checkCupHit,
} from "../../../utils/gameUtils";
import {
  accentColor, accentBg, rivalColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
  USC_RED, UCLA_BLUE,
} from "../../../utils/colors";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Layout ──────────────────────────────────────────────────
const CUP_AREA_W = SW - 48;
const CUP_AREA_H = 190;
const CUP_R = 24;        // cup circle radius in pixels
const BALL_SIZE = 18;
const MIN_THROW_SPEED = 500;  // min velocity to register a throw

// ─── Cup component ───────────────────────────────────────────
function Cup({ index, standing, side, flipped, areaW, areaH }: {
  index: number; standing: boolean; side: string;
  flipped: boolean; areaW: number; areaH: number;
}) {
  const pos = getCupCenter(index, areaW, areaH, flipped);
  const color = side === "usc" ? USC_RED : UCLA_BLUE;
  return (
    <View style={{
      position: "absolute",
      left: pos.x - CUP_R, top: pos.y - CUP_R,
      width: CUP_R * 2, height: CUP_R * 2, borderRadius: CUP_R,
      backgroundColor: standing ? `${color}55` : "transparent",
      borderWidth: standing ? 2 : 1,
      borderColor: standing ? color : `${color}22`,
      alignItems: "center", justifyContent: "center",
      opacity: standing ? 1 : 0.2,
    }}>
      {standing ? <Text style={{ fontSize: 17 }}>🥤</Text>
        : <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>✗</Text>}
    </View>
  );
}

// ─── Main ────────────────────────────────────────────────────
export default function CupPongScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<Game | null>(null);
  const [mySide, setMySide] = useState("usc");
  const myUid = auth.currentUser?.uid ?? "";
  const [opName, setOpName] = useState("Rival");
  const [opSide, setOpSide] = useState("ucla");
  const [isAnimating, setIsAnimating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Refs for fresh state inside PanResponder
  const gameRef = useRef<Game | null>(null);
  const animRef = useRef(false);

  // Ball animation
  const ballX = useRef(new Animated.Value(0)).current;
  const ballY = useRef(new Animated.Value(0)).current;
  const ballOpacity = useRef(new Animated.Value(0)).current;
  const ballStartX = SW / 2 - BALL_SIZE / 2;

  // Derived
  const opUid = game?.players?.find((p) => p !== myUid) ?? "";
  const isMyTurn = game?.currentTurn === myUid && game?.status === "active";
  const myCups = game?.cups?.[myUid] ?? INITIAL_CUPS();
  const opCups = game?.cups?.[opUid] ?? INITIAL_CUPS();

  // Keep refs current
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { animRef.current = isAnimating; }, [isAnimating]);

  // Layout positions
  const opCupAreaTop = insets.top + 95;
  const throwZoneY = SH - insets.bottom - 130;

  // Load side
  useEffect(() => {
    if (!myUid) return;
    getDoc(doc(db, "users", myUid)).then((s) => {
      if (s.exists()) setMySide(s.data().side || "usc");
    });
  }, [myUid]);

  // Real-time game listener
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, "games", gameId), async (snap) => {
      if (!snap.exists()) return;
      const g = { id: snap.id, ...snap.data() } as Game;
      setGame(g);
      const oUid = g.players.find((p) => p !== myUid);
      if (oUid && opName === "Rival") {
        const opSnap = await getDoc(doc(db, "users", oUid));
        if (opSnap.exists()) {
          setOpName(opSnap.data().name?.split(" ")[0] || "Rival");
          setOpSide(opSnap.data().side || "ucla");
        }
      }
      if (g.status === "complete") {
        setTimeout(() => router.replace(`/game/result/${gameId}` as any), 700);
      }
    });
    return () => unsub();
  }, [gameId, myUid]);

  // ── The throw ──────────────────────────────────────────────
  const doThrow = useCallback((vx: number, vy: number) => {
    const g = gameRef.current;
    if (!g || animRef.current) return;
    if (g.currentTurn !== myUid || g.status !== "active") return;

    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < MIN_THROW_SPEED || vy > -200) return; // not a real upward flick

    setIsAnimating(true);

    // ── Map swipe to landing position (normalized 0-1) ──
    // Angle from straight up: positive = right, negative = left
    const angle = Math.atan2(vx, -vy);

    // Horizontal: angle determines left/right, clamped to cup area
    const rawNx = 0.5 + Math.sin(angle) * 0.5;
    const landNx = Math.max(0.12, Math.min(0.88, rawNx));

    // Vertical: speed determines depth into cup area
    // Fast = reaches back row (ny ~0.25), slow = front cup (ny ~0.75)
    const maxSpeed = 2200;
    const normSpeed = Math.min(speed / maxSpeed, 1);
    const landNy = 0.72 - normSpeed * 0.50;

    // ── Hit detection — opponent cups use flipped=false ──
    // (3-cup row at top = farthest, single cup at bottom = closest)
    const oUid = g.players.find((p) => p !== myUid) ?? "";
    const oCups = [...(g.cups?.[oUid] ?? INITIAL_CUPS())];
    const hitIdx = checkCupHit(landNx, landNy, oCups, false);

    // ── Animate ball ──
    // Landing position in pixels relative to the cup area
    const endPixelX = 24 + landNx * CUP_AREA_W - ballStartX;
    const endPixelY = opCupAreaTop + landNy * CUP_AREA_H - throwZoneY;
    const arcPeak = endPixelY - 100 - normSpeed * 60;

    ballX.setValue(0);
    ballY.setValue(0);
    ballOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(ballX, {
        toValue: endPixelX, duration: 500,
        easing: Easing.linear, useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(ballY, {
          toValue: arcPeak, duration: 200,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(ballY, {
          toValue: endPixelY, duration: 300,
          easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
      ]),
    ]).start(async () => {
      // Fade ball
      Animated.timing(ballOpacity, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }).start();

      // Feedback
      if (hitIdx >= 0) {
        oCups[hitIdx] = false;
        setFeedback("🎯 Splash!");
      } else {
        setFeedback("💨 Miss!");
      }
      setTimeout(() => setFeedback(null), 1200);

      // Update Firestore
      try {
        const allSunk = oCups.every((c) => !c);
        const update: any = { [`cups.${oUid}`]: oCups, currentTurn: oUid };
        if (allSunk) { update.status = "complete"; update.winner = myUid; }
        await updateDoc(doc(db, "games", gameId as string), update);
      } catch (e) { console.error("Game update failed:", e); }

      setIsAnimating(false);
    });
  }, [myUid, gameId, opCupAreaTop, throwZoneY, ballStartX, ballX, ballY, ballOpacity]);

  // ── PanResponder — rebuilt when doThrow changes ──
  const panRef = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, g) => doThrow(g.vx, g.vy),
  }));

  useEffect(() => {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
      onPanResponderRelease: (_, g) => doThrow(g.vx, g.vy),
    });
  }, [doThrow]);

  // ── Render ────────────────────────────────────────────────
  if (!game) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={{ color: TEXT_SECONDARY }}>Loading…</Text>
        </View>
      </View>
    );
  }

  const accent = accentColor(mySide);
  const opAccent = rivalColor(mySide);
  const mySunk = myCups.filter((c) => !c).length;
  const opSunk = opCups.filter((c) => !c).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <FontAwesome name="chevron-left" size={18} color={TEXT_SECONDARY} />
        </Pressable>
        <Text style={styles.title}>Cup Pong</Text>
        <Text style={[styles.turnText, { color: isMyTurn ? accent : TEXT_SECONDARY }]}>
          {isMyTurn ? "Your throw" : `${opName}'s turn`}
        </Text>
      </View>

      {/* Score */}
      <View style={styles.scoreRow}>
        <View style={styles.scoreCol}>
          <Text style={[styles.scoreNum, { color: accent }]}>{opSunk}</Text>
          <Text style={styles.scoreLabel}>You sunk</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.scoreCol}>
          <Text style={[styles.scoreNum, { color: opAccent }]}>{mySunk}</Text>
          <Text style={styles.scoreLabel}>{opName} sunk</Text>
        </View>
      </View>

      {/* Opponent cups — flipped=false: 3-row at top, single cup at bottom */}
      <View style={styles.cupZone}>
        <Text style={[styles.zoneLabel, { color: opAccent }]}>{opName.toUpperCase()}</Text>
        <View style={{ width: CUP_AREA_W, height: CUP_AREA_H, position: "relative" }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Cup key={i} index={i} standing={opCups[i]}
              side={opSide} flipped={false}
              areaW={CUP_AREA_W} areaH={CUP_AREA_H} />
          ))}
        </View>
      </View>

      {/* Ball */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", left: ballStartX, top: throwZoneY - BALL_SIZE / 2,
        width: BALL_SIZE, height: BALL_SIZE, borderRadius: BALL_SIZE / 2,
        backgroundColor: "#fff", opacity: ballOpacity,
        transform: [{ translateX: ballX }, { translateY: ballY }],
        shadowColor: "#fff", shadowOpacity: 0.6, shadowRadius: 8, elevation: 4,
      }} />

      {/* Feedback */}
      {feedback && (
        <View style={styles.fbBox}>
          <Text style={styles.fbText}>{feedback}</Text>
        </View>
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {/* My cups — flipped=true: single cup at top, 3-row at bottom */}
      <View style={styles.cupZone}>
        <View style={{ width: CUP_AREA_W, height: CUP_AREA_H, position: "relative" }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Cup key={i} index={i} standing={myCups[i]}
              side={mySide} flipped={true}
              areaW={CUP_AREA_W} areaH={CUP_AREA_H} />
          ))}
        </View>
        <Text style={[styles.zoneLabel, { color: accent }]}>YOU</Text>
      </View>

      {/* Throw zone */}
      <View style={styles.throwArea}>
        {isMyTurn && !isAnimating ? (
          <View {...panRef.current.panHandlers}
            style={[styles.throwZone, { borderColor: `${accent}55`,
              backgroundColor: accentBg(mySide, 0.06) }]}>
            <Text style={{ fontSize: 22 }}>🏓</Text>
            <Text style={[styles.throwHint, { color: accent }]}>Flick up to throw</Text>
          </View>
        ) : (
          <View style={[styles.throwZone, { borderColor: `${TEXT_SECONDARY}22` }]}>
            <Text style={{ fontSize: 22, opacity: 0.3 }}>🏓</Text>
            <Text style={[styles.throwHint, { color: TEXT_SECONDARY }]}>
              {isAnimating ? "Throwing…" : `Waiting for ${opName}…`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_PRIMARY, alignItems: "center" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10,
  },
  title: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700" },
  turnText: { fontSize: 13, fontWeight: "600", width: 100, textAlign: "right" },
  scoreRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", width: "100%",
    paddingHorizontal: 36, paddingVertical: 4,
  },
  scoreCol: { alignItems: "center", width: 80 },
  scoreNum: { fontSize: 30, fontWeight: "900" },
  scoreLabel: { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  vs: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: "700" },
  cupZone: { width: "100%", paddingHorizontal: 24, alignItems: "center" },
  zoneLabel: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1.5,
    marginBottom: 4, marginTop: 2,
  },
  divider: {
    width: SW - 48, height: 1,
    backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 4,
  },
  throwArea: {
    flex: 1, width: "100%", paddingHorizontal: 24,
    paddingTop: 4, alignItems: "center", justifyContent: "center",
  },
  throwZone: {
    width: "100%", height: 85, borderRadius: 20,
    borderWidth: 2, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  throwHint: { fontSize: 13, fontWeight: "600" },
  fbBox: {
    position: "absolute", top: "40%", alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 18, zIndex: 99,
  },
  fbText: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: "800" },
});
