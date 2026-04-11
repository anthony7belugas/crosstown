// app/game/cup-pong/[gameId].tsx
// Cup Pong — swipe upward to throw, parabolic arc animation, 6 cups per side
// Turn-based: players alternate shots. First to sink all 6 opponent cups wins.
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc, getDoc, onSnapshot, updateDoc, serverTimestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing, PanResponder,
  Pressable, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebaseConfig";
import {
  Game, CUP_LAYOUT, getCupCenter, INITIAL_CUPS, computeHit,
} from "../../../utils/gameUtils";
import {
  accentColor, accentBg, rivalColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
  USC_RED, UCLA_BLUE,
} from "../../../utils/colors";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Constants ───────────────────────────────────────────────
const CUP_AREA_H = 200;   // pixel height for each cup zone
const CUP_AREA_W = SW - 48;
const CUP_RADIUS = 26;
const BALL_RADIUS = 14;
const THROW_ZONE_Y = SH * 0.75; // y-center of throw zone

// ─── Cup rendering ───────────────────────────────────────────
function CupView({
  index,
  standing,
  highlighted,
  side,
  flipped = false,
  areaW,
  areaH,
}: {
  index: number;
  standing: boolean;
  highlighted: boolean;
  side: string;
  flipped?: boolean;
  areaW: number;
  areaH: number;
}) {
  const pos = getCupCenter(index, areaW, areaH, flipped);
  const color = side === "usc" ? USC_RED : UCLA_BLUE;

  return (
    <View
      style={{
        position: "absolute",
        left: pos.x - CUP_RADIUS,
        top: pos.y - CUP_RADIUS,
        width: CUP_RADIUS * 2,
        height: CUP_RADIUS * 2,
        borderRadius: CUP_RADIUS,
        backgroundColor: standing
          ? highlighted
            ? color
            : `${color}55`
          : "transparent",
        borderWidth: standing ? 2 : 1,
        borderColor: standing ? color : `${color}33`,
        alignItems: "center",
        justifyContent: "center",
        opacity: standing ? 1 : 0.3,
      }}
    >
      {standing && (
        <Text style={{ fontSize: 16 }}>🥤</Text>
      )}
      {!standing && (
        <Text style={{ fontSize: 14, opacity: 0.4 }}>✗</Text>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function CupPongScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<Game | null>(null);
  const [mySide, setMySide] = useState("usc");
  const [myUid] = useState(auth.currentUser?.uid ?? "");
  const [opponentName, setOpponentName] = useState("Rival");
  const [opponentSide, setOpponentSide] = useState("ucla");

  // Gesture / animation state
  const [isDragging, setIsDragging] = useState(false);
  const [dragAngle, setDragAngle] = useState(0); // radians from vertical
  const [dragPower, setDragPower] = useState(0);  // 0–1
  const [targetCupIndex, setTargetCupIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Animated ball
  const ballX = useRef(new Animated.Value(SW / 2)).current;
  const ballY = useRef(new Animated.Value(THROW_ZONE_Y)).current;
  const ballOpacity = useRef(new Animated.Value(0)).current;

  // Trajectory dots
  const [trajDots, setTrajDots] = useState<{ x: number; y: number }[]>([]);

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

      // Load opponent name if not loaded yet
      const opUid = g.players.find((p) => p !== myUid);
      if (opUid && opponentName === "Rival") {
        const opSnap = await getDoc(doc(db, "users", opUid));
        if (opSnap.exists()) {
          setOpponentName(opSnap.data().name?.split(" ")[0] || "Rival");
          setOpponentSide(opSnap.data().side || "ucla");
        }
      }

      // Navigate to result when game completes
      if (g.status === "complete") {
        router.replace(`/game/result/${gameId}` as any);
      }
    });
    return () => unsub();
  }, [gameId, myUid]);

  const isMyTurn = game?.currentTurn === myUid;
  const myCups = (game?.cups?.[myUid] ?? INITIAL_CUPS());
  const opCups = (game?.cups?.[game?.players?.find((p) => p !== myUid) ?? ""] ?? INITIAL_CUPS());
  const opUid = game?.players?.find((p) => p !== myUid) ?? "";

  // ─── Compute trajectory from drag delta ──────────────────
  const computeTrajectory = useCallback((dx: number, dy: number) => {
    if (dy >= 0) { setTrajDots([]); setTargetCupIndex(null); return; }

    const startX = SW / 2;
    const startY = THROW_ZONE_Y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) / 160, 1);
    const angle = Math.atan2(dx, -dy); // angle from straight up

    // Find which cup the trajectory points toward
    const opponentCupAreaTop = insets.top + 60;
    const dots: { x: number; y: number }[] = [];
    const STEPS = 10;

    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const x = startX + Math.sin(angle) * power * 200 * t;
      const arc = -200 * 4 * t * (1 - t); // parabola peak
      const y = startY + (opponentCupAreaTop + CUP_AREA_H / 2 - startY) * t + arc;
      dots.push({ x, y });
    }
    setTrajDots(dots);

    // Determine target cup: find closest cup to trajectory endpoint
    const endX = dots[STEPS - 1]?.x ?? startX;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < 6; i++) {
      const pos = getCupCenter(i, CUP_AREA_W, CUP_AREA_H, true);
      const absX = pos.x + 24; // offset for padding
      const dist = Math.abs(absX - endX);
      if (dist < minDist && opCups[i]) {
        minDist = dist;
        closest = i;
      }
    }
    setTargetCupIndex(closest);
    setDragPower(power);
    setDragAngle(angle);
  }, [opCups, insets.top]);

  // ─── Execute throw ────────────────────────────────────────
  const executeThrow = useCallback(async () => {
    if (!isMyTurn || isAnimating || targetCupIndex === null || !game) return;
    if (!opCups[targetCupIndex]) return; // cup already sunk

    setIsAnimating(true);
    setTrajDots([]);

    const opponentCupAreaTop = insets.top + 60;
    const cupPos = getCupCenter(targetCupIndex, CUP_AREA_W, CUP_AREA_H, true);
    const endX = cupPos.x + 24;
    const endY = opponentCupAreaTop + cupPos.y;
    const startX = SW / 2;
    const startY = THROW_ZONE_Y;

    // Determine hit before animation (gives ~60% success at full power)
    const accuracy = 1 - (Math.abs(dragAngle) > 0.3 ? 0.4 : 0) - (1 - dragPower) * 0.3;
    const hit = computeHit(Math.max(0, accuracy));

    // Animate ball along parabolic arc
    ballX.setValue(startX);
    ballY.setValue(startY);
    ballOpacity.setValue(1);

    const duration = 600;
    Animated.parallel([
      Animated.timing(ballX, {
        toValue: endX,
        duration,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(ballY, {
          toValue: Math.min(startY, endY) - 160,
          duration: duration * 0.45,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(ballY, {
          toValue: endY,
          duration: duration * 0.55,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    ]).start(async () => {
      // Fade ball out
      Animated.timing(ballOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();

      setLastResult(hit ? "🎯 Splash!" : "💨 Miss");
      setTimeout(() => setLastResult(null), 1500);

      // Update Firestore
      try {
        const newOpCups = [...opCups];
        if (hit) newOpCups[targetCupIndex] = false;

        const opWon = newOpCups.every((c) => !c); // all sunk = my win
        const nextTurn = opUid;

        const updateData: any = {
          [`cups.${opUid}`]: newOpCups,
          currentTurn: nextTurn,
        };
        if (opWon) {
          updateData.status = "complete";
          updateData.winner = myUid;
        }
        await updateDoc(doc(db, "games", gameId as string), updateData);
      } catch (e) {
        console.error("Failed to update game:", e);
      }

      setIsAnimating(false);
      setTargetCupIndex(null);
    });
  }, [isMyTurn, isAnimating, targetCupIndex, game, opCups, opUid, dragAngle, dragPower, insets.top]);

  // ─── PanResponder for throw gesture ──────────────────────
  const panRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
      },
      onPanResponderMove: (_, g) => {
        computeTrajectory(g.dx, g.dy);
      },
      onPanResponderRelease: (_, g) => {
        setIsDragging(false);
        if (g.dy < -30) {
          executeThrow();
        } else {
          setTrajDots([]);
          setTargetCupIndex(null);
        }
      },
    })
  ).current;

  // ─── Render ───────────────────────────────────────────────
  if (!game) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: TEXT_SECONDARY }}>Loading game…</Text>
      </View>
    );
  }

  const accent = accentColor(mySide);
  const opponentAccent = rivalColor(mySide);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: TEXT_SECONDARY, fontSize: 14 }}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Cup Pong</Text>
        <Text style={styles.turnLabel}>
          {isMyTurn ? (
            <Text style={{ color: accent }}>Your turn</Text>
          ) : (
            <Text style={{ color: TEXT_SECONDARY }}>{opponentName}'s turn</Text>
          )}
        </Text>
      </View>

      {/* ── Score strip ── */}
      <View style={styles.scoreStrip}>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: opponentAccent }]}>
            {opCups.filter(Boolean).length}
          </Text>
          <Text style={styles.scoreLabel}>{opponentName}'s cups</Text>
        </View>
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: accent }]}>
            {myCups.filter(Boolean).length}
          </Text>
          <Text style={styles.scoreLabel}>Your cups</Text>
        </View>
      </View>

      {/* ── Opponent cups (top, triangle pointing toward player) ── */}
      <View style={styles.cupZone}>
        <Text style={[styles.zoneLabel, { color: opponentAccent }]}>
          {opponentName}'s cups
        </Text>
        <View style={{ width: CUP_AREA_W, height: CUP_AREA_H, position: "relative" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CupView
              key={i}
              index={i}
              standing={opCups[i]}
              highlighted={targetCupIndex === i && isDragging}
              side={opponentSide}
              flipped
              areaW={CUP_AREA_W}
              areaH={CUP_AREA_H}
            />
          ))}
        </View>
      </View>

      {/* ── Trajectory dots ── */}
      {trajDots.map((d, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: d.x - 4,
            top: d.y - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: `${accent}${Math.round((i / trajDots.length) * 200).toString(16).padStart(2, "0")}`,
          }}
        />
      ))}

      {/* ── Animated ball ── */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: BALL_RADIUS * 2,
          height: BALL_RADIUS * 2,
          borderRadius: BALL_RADIUS,
          backgroundColor: "#fff",
          opacity: ballOpacity,
          transform: [
            { translateX: Animated.add(ballX, new Animated.Value(-BALL_RADIUS)) },
            { translateY: Animated.add(ballY, new Animated.Value(-BALL_RADIUS)) },
          ],
          shadowColor: "#fff",
          shadowOpacity: 0.6,
          shadowRadius: 8,
        }}
      />

      {/* ── Result flash ── */}
      {lastResult && (
        <View style={styles.resultFlash}>
          <Text style={styles.resultFlashText}>{lastResult}</Text>
        </View>
      )}

      {/* ── Middle divider ── */}
      <View style={styles.divider} />

      {/* ── My cups (bottom) ── */}
      <View style={[styles.cupZone, { marginTop: 16 }]}>
        <View style={{ width: CUP_AREA_W, height: CUP_AREA_H, position: "relative" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CupView
              key={i}
              index={i}
              standing={myCups[i]}
              highlighted={false}
              side={mySide}
              flipped={false}
              areaW={CUP_AREA_W}
              areaH={CUP_AREA_H}
            />
          ))}
        </View>
        <Text style={[styles.zoneLabel, { color: accent }]}>Your cups</Text>
      </View>

      {/* ── Throw zone ── */}
      <View style={styles.throwArea}>
        {isMyTurn && !isAnimating ? (
          <View
            {...panRef.panHandlers}
            style={[styles.throwZone, {
              borderColor: isDragging ? accent : `${accent}55`,
              backgroundColor: isDragging ? accentBg(mySide, 0.15) : accentBg(mySide, 0.07),
            }]}
          >
            <Text style={{ fontSize: 24 }}>⚾</Text>
            <Text style={[styles.throwHint, { color: accent }]}>
              {isDragging ? "Release to throw!" : "Drag up to throw"}
            </Text>
          </View>
        ) : (
          <View style={[styles.throwZone, { borderColor: `${TEXT_SECONDARY}33` }]}>
            <Text style={{ fontSize: 24, opacity: 0.4 }}>⚾</Text>
            <Text style={[styles.throwHint, { color: TEXT_SECONDARY }]}>
              {isAnimating ? "Flying…" : `Waiting for ${opponentName}…`}
            </Text>
          </View>
        )}
      </View>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
    alignItems: "center",
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { width: 60 },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
  },
  turnLabel: { width: 100, textAlign: "right", fontSize: 13 },
  scoreStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 8,
    width: "100%",
    justifyContent: "space-between",
  },
  scoreBlock: { alignItems: "center", width: 80 },
  scoreNum: { fontSize: 32, fontWeight: "800" },
  scoreLabel: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  vsText: { color: TEXT_SECONDARY, fontSize: 16, fontWeight: "700" },
  cupZone: {
    width: "100%",
    paddingHorizontal: 24,
    alignItems: "center",
  },
  zoneLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  divider: {
    width: SW - 48,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 8,
  },
  throwArea: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  throwZone: {
    width: "100%",
    height: 100,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  throwHint: {
    fontSize: 13,
    fontWeight: "600",
  },
  resultFlash: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    zIndex: 99,
  },
  resultFlashText: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "800",
  },
});
