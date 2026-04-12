// app/game/cup-pong/[gameId].tsx
// Cup Pong — drag to aim, release to throw. Pure skill — no RNG.
// The drag vector determines exactly where the ball lands.
// If the landing overlaps a cup's hit zone, it sinks.
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc, getDoc, onSnapshot, updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing, PanResponder,
  Pressable, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebaseConfig";
import {
  Game, CUPS_PER_SIDE, INITIAL_CUPS,
  getCupCenter, checkCupHit, getCupPosition, CUP_HIT_RADIUS,
} from "../../../utils/gameUtils";
import {
  accentColor, accentBg, rivalColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
  USC_RED, UCLA_BLUE,
} from "../../../utils/colors";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Layout constants ────────────────────────────────────────
const CUP_AREA_W = SW - 48;
const CUP_AREA_H = 180;
const CUP_RADIUS = 26;
const BALL_SIZE = 20;
const THROW_SENSITIVITY = 1.8; // how much dx maps to horizontal offset
const MIN_THROW_DY = -40;      // minimum upward drag to register throw
const MIN_POWER = 0.35;        // minimum power to reach cups

// ─── Cup component ───────────────────────────────────────────
function Cup({
  index, standing, targeted, side, flipped, areaW, areaH,
}: {
  index: number; standing: boolean; targeted: boolean;
  side: string; flipped: boolean; areaW: number; areaH: number;
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
          ? targeted ? color : `${color}44`
          : "transparent",
        borderWidth: standing ? 2.5 : 1,
        borderColor: standing
          ? targeted ? "#fff" : color
          : `${color}22`,
        alignItems: "center",
        justifyContent: "center",
        opacity: standing ? 1 : 0.25,
      }}
    >
      {standing && <Text style={{ fontSize: 18 }}>🥤</Text>}
      {!standing && <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>✗</Text>}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function CupPongScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── State ──
  const [game, setGame] = useState<Game | null>(null);
  const [mySide, setMySide] = useState("usc");
  const myUid = auth.currentUser?.uid ?? "";
  const [opName, setOpName] = useState("Rival");
  const [opSide, setOpSide] = useState("ucla");
  const [isAnimating, setIsAnimating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // ── Refs for PanResponder access (avoids stale closures) ──
  const gameRef = useRef<Game | null>(null);
  const animatingRef = useRef(false);

  // ── Drag state (kept in refs for PanResponder) ──
  const [isDragging, setIsDragging] = useState(false);
  const [landingPreview, setLandingPreview] = useState<{ nx: number; ny: number } | null>(null);
  const [trajDots, setTrajDots] = useState<{ x: number; y: number }[]>([]);
  const [targetedCup, setTargetedCup] = useState(-1);

  // ── Ball animation ──
  const ballTransX = useRef(new Animated.Value(0)).current;
  const ballTransY = useRef(new Animated.Value(0)).current;
  const ballOpacity = useRef(new Animated.Value(0)).current;
  const ballBaseX = SW / 2 - BALL_SIZE / 2;

  // ── Derived values ──
  const opUid = game?.players?.find((p) => p !== myUid) ?? "";
  const isMyTurn = game?.currentTurn === myUid && game?.status === "active";
  const myCups = game?.cups?.[myUid] ?? INITIAL_CUPS();
  const opCups = game?.cups?.[opUid] ?? INITIAL_CUPS();
  const mySunk = myCups.filter((c) => !c).length;
  const opSunk = opCups.filter((c) => !c).length;

  // Keep refs in sync
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { animatingRef.current = isAnimating; }, [isAnimating]);

  // ── Layout measurements ──
  const cupZoneTopY = insets.top + 100; // top of opponent cup area
  const throwZoneY = SH - insets.bottom - 140; // center of throw zone

  // ── Load my side ──
  useEffect(() => {
    if (!myUid) return;
    getDoc(doc(db, "users", myUid)).then((s) => {
      if (s.exists()) setMySide(s.data().side || "usc");
    });
  }, [myUid]);

  // ── Real-time game listener ──
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
        setTimeout(() => router.replace(`/game/result/${gameId}` as any), 600);
      }
    });
    return () => unsub();
  }, [gameId, myUid]);

  // ── Calculate landing from drag vector ──
  const calcLanding = useCallback((dx: number, dy: number) => {
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) / 150, 1);
    if (power < MIN_POWER) return null;

    // Horizontal: dx maps to normalized X offset from center
    const nx = 0.5 + (dx / CUP_AREA_W) * THROW_SENSITIVITY;
    // Vertical: always lands in cup zone when power is sufficient
    const ny = 0.5; // center of cup area (normalized)
    return { nx: Math.max(0.05, Math.min(0.95, nx)), ny, power };
  }, []);

  // ── Build trajectory dots for preview ──
  const buildTrajectory = useCallback((dx: number, dy: number) => {
    const landing = calcLanding(dx, dy);
    if (!landing) {
      setTrajDots([]);
      setLandingPreview(null);
      setTargetedCup(-1);
      return;
    }

    setLandingPreview(landing);

    // Check which cup would be hit
    const g = gameRef.current;
    const oUid = g?.players?.find((p) => p !== myUid) ?? "";
    const oCups = g?.cups?.[oUid] ?? INITIAL_CUPS();
    const hitIdx = checkCupHit(landing.nx, landing.ny, oCups, true);
    setTargetedCup(hitIdx);

    // Generate arc dots from throw zone to landing point
    const startX = SW / 2;
    const startY = throwZoneY;
    const endX = 24 + landing.nx * CUP_AREA_W;
    const endY = cupZoneTopY + landing.ny * CUP_AREA_H;
    const STEPS = 8;
    const dots: { x: number; y: number }[] = [];

    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const x = startX + (endX - startX) * t;
      const arc = -140 * 4 * t * (1 - t) * landing.power;
      const y = startY + (endY - startY) * t + arc;
      dots.push({ x, y });
    }
    setTrajDots(dots);
  }, [calcLanding, cupZoneTopY, throwZoneY, myUid]);

  // ── Execute throw ──
  const executeThrow = useCallback(async (dx: number, dy: number) => {
    const g = gameRef.current;
    if (!g || animatingRef.current) return;
    if (g.currentTurn !== myUid || g.status !== "active") return;

    const landing = calcLanding(dx, dy);
    if (!landing) return;

    const oUid = g.players.find((p) => p !== myUid) ?? "";
    const oCups = [...(g.cups?.[oUid] ?? INITIAL_CUPS())];

    // Determine hit by position — NO randomness
    const hitIdx = checkCupHit(landing.nx, landing.ny, oCups, true);

    setIsAnimating(true);
    setTrajDots([]);
    setLandingPreview(null);
    setTargetedCup(-1);

    // Animate ball from throw zone to landing point
    const endPixelX = 24 + landing.nx * CUP_AREA_W - SW / 2 + BALL_SIZE / 2;
    const endPixelY = cupZoneTopY + landing.ny * CUP_AREA_H - throwZoneY;
    const peakY = endPixelY - 140 * landing.power; // arc peak

    ballTransX.setValue(0);
    ballTransY.setValue(0);
    ballOpacity.setValue(1);

    const duration = 550;

    Animated.parallel([
      Animated.timing(ballTransX, {
        toValue: endPixelX,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(ballTransY, {
          toValue: peakY,
          duration: duration * 0.4,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ballTransY, {
          toValue: endPixelY,
          duration: duration * 0.6,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(async () => {
      // Fade ball
      Animated.timing(ballOpacity, {
        toValue: 0, duration: 250, useNativeDriver: true,
      }).start();

      // Show feedback
      if (hitIdx >= 0) {
        oCups[hitIdx] = false;
        setFeedback("🎯 Splash!");
      } else {
        setFeedback("💨 Miss");
      }
      setTimeout(() => setFeedback(null), 1400);

      // Update Firestore
      try {
        const allSunk = oCups.every((c) => !c);
        const update: any = {
          [`cups.${oUid}`]: oCups,
          currentTurn: oUid,
        };
        if (allSunk) {
          update.status = "complete";
          update.winner = myUid;
        }
        await updateDoc(doc(db, "games", gameId as string), update);
      } catch (e) {
        console.error("Failed to update game:", e);
      }

      setIsAnimating(false);
    });
  }, [myUid, calcLanding, cupZoneTopY, throwZoneY, gameId, ballTransX, ballTransY, ballOpacity]);

  // ── PanResponder (uses refs for fresh state) ──
  const panRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
      },
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) { // only preview when dragging upward
          buildTrajectory(g.dx, g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        setIsDragging(false);
        if (g.dy < MIN_THROW_DY) {
          executeThrow(g.dx, g.dy);
        } else {
          setTrajDots([]);
          setLandingPreview(null);
          setTargetedCup(-1);
        }
      },
    })
  );

  // Rebuild PanResponder when callbacks change
  useEffect(() => {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setIsDragging(true),
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) buildTrajectory(g.dx, g.dy);
      },
      onPanResponderRelease: (_, g) => {
        setIsDragging(false);
        if (g.dy < MIN_THROW_DY) {
          executeThrow(g.dx, g.dy);
        } else {
          setTrajDots([]);
          setLandingPreview(null);
          setTargetedCup(-1);
        }
      },
    });
  }, [buildTrajectory, executeThrow]);

  // ── Render ────────────────────────────────────────────────
  if (!game) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={{ color: TEXT_SECONDARY }}>Loading game…</Text>
        </View>
      </View>
    );
  }

  const accent = accentColor(mySide);
  const opAccent = rivalColor(mySide);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <FontAwesome name="chevron-left" size={18} color={TEXT_SECONDARY} />
        </Pressable>
        <Text style={styles.headerTitle}>Cup Pong</Text>
        <Text style={[styles.turnLabel, { color: isMyTurn ? accent : TEXT_SECONDARY }]}>
          {isMyTurn ? "Your throw" : `${opName}'s turn`}
        </Text>
      </View>

      {/* ── Score strip ── */}
      <View style={styles.scoreStrip}>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: opAccent }]}>{opSunk}</Text>
          <Text style={styles.scoreLabel}>{opName} sunk</Text>
        </View>
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: accent }]}>{mySunk}</Text>
          <Text style={styles.scoreLabel}>You sunk</Text>
        </View>
      </View>

      {/* ── Opponent cups (flipped — front cup at bottom) ── */}
      <View style={styles.cupZone}>
        <Text style={[styles.zoneLabel, { color: opAccent }]}>
          {opName.toUpperCase()}'S CUPS
        </Text>
        <View style={{ width: CUP_AREA_W, height: CUP_AREA_H, position: "relative" }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Cup
              key={i} index={i} standing={opCups[i]}
              targeted={targetedCup === i && isDragging}
              side={opSide} flipped areaW={CUP_AREA_W} areaH={CUP_AREA_H}
            />
          ))}
          {/* Landing zone preview circle */}
          {landingPreview && isDragging && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: landingPreview.nx * CUP_AREA_W - 20,
                top: landingPreview.ny * CUP_AREA_H - 20,
                width: 40, height: 40, borderRadius: 20,
                borderWidth: 2, borderStyle: "dashed",
                borderColor: targetedCup >= 0 ? accent : `${TEXT_SECONDARY}44`,
              }}
            />
          )}
        </View>
      </View>

      {/* ── Trajectory dots ── */}
      {trajDots.map((d, i) => (
        <View
          key={i} pointerEvents="none"
          style={{
            position: "absolute",
            left: d.x - 3, top: d.y - 3,
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: accent,
            opacity: 0.15 + (i / trajDots.length) * 0.6,
          }}
        />
      ))}

      {/* ── Animated ball ── */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: ballBaseX,
          top: throwZoneY - BALL_SIZE / 2,
          width: BALL_SIZE, height: BALL_SIZE, borderRadius: BALL_SIZE / 2,
          backgroundColor: "#fff",
          opacity: ballOpacity,
          transform: [{ translateX: ballTransX }, { translateY: ballTransY }],
          shadowColor: "#fff", shadowOpacity: 0.5, shadowRadius: 6,
          elevation: 4,
        }}
      />

      {/* ── Feedback flash ── */}
      {feedback && (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── My cups (not flipped — front cup at top) ── */}
      <View style={styles.cupZone}>
        <View style={{ width: CUP_AREA_W, height: CUP_AREA_H, position: "relative" }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Cup
              key={i} index={i} standing={myCups[i]}
              targeted={false} side={mySide}
              flipped={false} areaW={CUP_AREA_W} areaH={CUP_AREA_H}
            />
          ))}
        </View>
        <Text style={[styles.zoneLabel, { color: accent }]}>YOUR CUPS</Text>
      </View>

      {/* ── Throw zone ── */}
      <View style={styles.throwArea}>
        {isMyTurn && !isAnimating ? (
          <View
            {...panRef.current.panHandlers}
            style={[styles.throwZone, {
              borderColor: isDragging ? accent : `${accent}44`,
              backgroundColor: isDragging ? accentBg(mySide, 0.15) : accentBg(mySide, 0.06),
            }]}
          >
            <Text style={{ fontSize: 22 }}>🏓</Text>
            <Text style={[styles.throwHint, { color: accent }]}>
              {isDragging ? "Aim & release!" : "Drag up to throw"}
            </Text>
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

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_PRIMARY, alignItems: "center" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10,
  },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700" },
  turnLabel: { fontSize: 13, fontWeight: "600", width: 100, textAlign: "right" },
  scoreStrip: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", width: "100%",
    paddingHorizontal: 32, paddingVertical: 6,
  },
  scoreBlock: { alignItems: "center", width: 80 },
  scoreNum: { fontSize: 30, fontWeight: "900" },
  scoreLabel: { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  vsText: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: "700" },
  cupZone: { width: "100%", paddingHorizontal: 24, alignItems: "center" },
  zoneLabel: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1.5,
    marginBottom: 6, marginTop: 4,
  },
  divider: {
    width: SW - 48, height: 1,
    backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 6,
  },
  throwArea: {
    flex: 1, width: "100%", paddingHorizontal: 24,
    paddingTop: 6, alignItems: "center", justifyContent: "center",
  },
  throwZone: {
    width: "100%", height: 90, borderRadius: 20,
    borderWidth: 2, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  throwHint: { fontSize: 13, fontWeight: "600" },
  feedback: {
    position: "absolute", top: "42%", alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, zIndex: 99,
  },
  feedbackText: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: "800" },
});
