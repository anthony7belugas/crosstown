// app/game/word-hunt/[gameId].tsx
// Word Hunt — 4x4 grid, trace adjacent letters, 90s timer.
// Fixes: server-side turn timer, board hidden until Start, reliable auto-submit.
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc, getDoc, onSnapshot, serverTimestamp, Timestamp, updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions, PanResponder, Pressable, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebaseConfig";
import { Game, isAdjacent, wordScore } from "../../../utils/gameUtils";
import { isValidWord } from "../../../utils/wordList";
import {
  accentColor, accentBg, rivalColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
} from "../../../utils/colors";

const { width: SW } = Dimensions.get("window");
const GRID_PAD = 24;
const CELL_GAP = 8;
const GRID_SIZE = SW - GRID_PAD * 2;
const CELL_SIZE = (GRID_SIZE - CELL_GAP * 3) / 4;
const TURN_SECONDS = 90;

export default function WordHuntScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<Game | null>(null);
  const [mySide, setMySide] = useState("usc");
  const myUid = auth.currentUser?.uid ?? "";
  const [opName, setOpName] = useState("Rival");
  const [opSide, setOpSide] = useState("ucla");

  // Gameplay
  const [board, setBoard] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [lastWord, setLastWord] = useState<{ text: string; valid: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [turnActive, setTurnActive] = useState(false);
  const [waitingForOp, setWaitingForOp] = useState(false);

  // Whether the player has tapped "Start" — board is hidden until then
  const [hasStarted, setHasStarted] = useState(false);

  // ALL refs — these are the source of truth inside callbacks/intervals
  const boardRef = useRef<string[]>([]);
  const foundWordsRef = useRef<string[]>([]);
  const scoreRef = useRef(0);
  const turnActiveRef = useRef(false);
  const submittedRef = useRef(false); // ref, not state — survives closures
  const gameRef = useRef<Game | null>(null);
  const pathRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cell layout
  const cellLayouts = useRef<{ x: number; y: number; w: number; h: number }[]>(
    new Array(16).fill({ x: 0, y: 0, w: 0, h: 0 })
  );
  const gridRef = useRef<View>(null);
  const gridPageOffset = useRef({ x: 0, y: 0 });

  // Keep refs in sync with state
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { foundWordsRef.current = foundWords; }, [foundWords]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { turnActiveRef.current = turnActive; }, [turnActive]);
  useEffect(() => { gameRef.current = game; }, [game]);

  // Load my side
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

      if (g.board && board.length === 0) setBoard(g.board);

      // Load opponent name once
      const oUid = g.players.find((p) => p !== myUid);
      if (oUid && opName === "Rival") {
        const opSnap = await getDoc(doc(db, "users", oUid));
        if (opSnap.exists()) {
          setOpName(opSnap.data().name?.split(" ")[0] || "Rival");
          setOpSide(opSnap.data().side || "ucla");
        }
      }

      // If I already submitted (Firestore confirms), mark submitted
      const myDone = g.turnDone?.[myUid] ?? false;
      if (myDone) {
        submittedRef.current = true;
        setTurnActive(false);
        stopTimer();
      }

      // Waiting for opponent
      if (myDone && !(g.turnDone?.[oUid ?? ""] ?? false)) {
        setWaitingForOp(true);
      }

      // Game over → result screen
      if (g.status === "complete") {
        stopTimer();
        router.replace(`/game/result/${gameId}` as any);
      }
    });
    return () => { unsub(); stopTimer(); };
  }, [gameId, myUid]);

  // ── Player taps "Start" → write turnStartedAt, begin timer ──
  const handleStart = async () => {
    if (!gameId || submittedRef.current) return;
    setHasStarted(true);

    // Write start time to Firestore so it persists across remounts
    await updateDoc(doc(db, "games", gameId), {
      [`turnStartedAt.${myUid}`]: serverTimestamp(),
    });

    // Start local timer at full 90s — the interval tick will sync below
    beginTimer(TURN_SECONDS);
  };

  // ── Resume timer on remount if turn was already started ──
  useEffect(() => {
    if (!game || !myUid) return;
    const myDone = game.turnDone?.[myUid] ?? false;
    if (myDone) return; // already submitted

    const isMyTurn = game.currentTurn === myUid;
    if (!isMyTurn) return;

    // Check if there's a turnStartedAt for me (meaning I already tapped Start)
    const startedAt = (game as any).turnStartedAt?.[myUid];
    if (!startedAt) return; // haven't tapped Start yet

    // Calculate remaining time from server timestamp
    const startTime = startedAt.toDate ? startedAt.toDate() : new Date(startedAt.seconds * 1000);
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const remaining = Math.max(0, TURN_SECONDS - elapsed);

    if (remaining <= 0) {
      // Time already ran out while we were away — auto-submit
      if (!submittedRef.current) {
        submitTurn();
      }
      return;
    }

    // Resume with remaining time
    setHasStarted(true);
    if (!turnActiveRef.current && !submittedRef.current) {
      beginTimer(remaining);
    }
  }, [game, myUid]);

  // ── Timer logic ──
  const beginTimer = (startSeconds: number) => {
    stopTimer();
    setTurnActive(true);
    setTimeLeft(startSeconds);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopTimer();
          // Use setTimeout to escape the setState callback
          setTimeout(() => submitTurn(), 0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ── Submit turn — uses ONLY refs, no stale closures ──
  const submitTurn = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    stopTimer();
    setTurnActive(false);

    const g = gameRef.current;
    if (!g) return;

    const oUid = g.players.find((p) => p !== myUid) ?? "";
    const opDone = g.turnDone?.[oUid] ?? false;
    const myFinalScore = scoreRef.current;
    const myFinalWords = [...foundWordsRef.current];

    const update: any = {
      [`scores.${myUid}`]: myFinalScore,
      [`wordsFound.${myUid}`]: myFinalWords,
      [`turnDone.${myUid}`]: true,
      currentTurn: oUid,
    };

    if (opDone) {
      const opScore = g.scores?.[oUid] ?? 0;
      const winner = myFinalScore > opScore ? myUid
        : myFinalScore < opScore ? oUid : "draw";
      update.status = "complete";
      update.winner = winner;
    }

    try {
      await updateDoc(doc(db, "games", gameId as string), update);
    } catch (e) {
      console.error("Failed to submit turn:", e);
    }
  };

  // ── Cell hit detection — distance to center, not bounds ──
  // This makes diagonal tracing much easier because the diagonal
  // cell's center is closer than the vertical/horizontal neighbor
  const getCellAtPoint = useCallback((pageX: number, pageY: number): number => {
    const relX = pageX - gridPageOffset.current.x;
    const relY = pageY - gridPageOffset.current.y;
    let closest = -1;
    let closestDist = Infinity;

    for (let i = 0; i < 16; i++) {
      const c = cellLayouts.current[i];
      if (!c || c.w === 0) continue;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const dist = Math.sqrt((relX - cx) ** 2 + (relY - cy) ** 2);
      // Only consider cells within a reasonable radius (cell size)
      if (dist < c.w * 0.75 && dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    return closest;
  }, []);

  // ── PanResponder — rebuilt when getCellAtPoint changes ──
  const panResponder = useRef(buildPan());

  function buildPan() {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => turnActiveRef.current && !submittedRef.current,
      onMoveShouldSetPanResponder: () => turnActiveRef.current && !submittedRef.current,
      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const cell = getCellAtPoint(pageX, pageY);
        if (cell >= 0) {
          pathRef.current = [cell];
          setSelectedPath([cell]);
          setCurrentWord(boardRef.current[cell] ?? "");
        }
      },
      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const cell = getCellAtPoint(pageX, pageY);
        if (cell < 0) return;
        const path = pathRef.current;
        if (path.includes(cell)) return;
        if (!isAdjacent(path[path.length - 1], cell)) return;
        pathRef.current = [...path, cell];
        setSelectedPath([...pathRef.current]);
        setCurrentWord(pathRef.current.map((i) => boardRef.current[i]).join(""));
      },
      onPanResponderRelease: () => {
        const word = pathRef.current.map((i) => boardRef.current[i]).join("").toUpperCase();
        pathRef.current = [];
        setSelectedPath([]);
        setCurrentWord("");
        if (word.length < 3) return;
        if (foundWordsRef.current.includes(word)) {
          setLastWord({ text: "Already found", valid: false });
          setTimeout(() => setLastWord(null), 800);
          return;
        }
        if (isValidWord(word)) {
          const pts = wordScore(word);
          const nw = [...foundWordsRef.current, word];
          foundWordsRef.current = nw;
          setFoundWords(nw);
          const ns = scoreRef.current + pts;
          scoreRef.current = ns;
          setScore(ns);
          setLastWord({ text: `+${pts} ${word}`, valid: true });
        } else {
          setLastWord({ text: word, valid: false });
        }
        setTimeout(() => setLastWord(null), 900);
      },
    });
  }

  useEffect(() => {
    panResponder.current = buildPan();
  }, [getCellAtPoint]);

  // Grid measurement
  const onGridLayout = () => {
    setTimeout(() => {
      gridRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        if (pageX != null && pageY != null) {
          gridPageOffset.current = { x: pageX, y: pageY };
        }
      });
    }, 150);
  };

  // ── Render ────────────────────────────────────────────────
  if (!game || board.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={{ color: TEXT_SECONDARY }}>Loading…</Text>
        </View>
      </View>
    );
  }

  const accent = accentColor(mySide);
  const isMyTurn = game.currentTurn === myUid;
  const myDone = game.turnDone?.[myUid] ?? false;
  const opUid = game.players.find((p) => p !== myUid) ?? "";
  const opScore = game.scores?.[opUid] ?? 0;
  const timerColor = timeLeft <= 15 ? "#EF4444" : timeLeft <= 30 ? "#F59E0B" : TEXT_PRIMARY;

  // ── Not my turn yet — waiting for opponent ──
  if (!isMyTurn && !myDone) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: TEXT_SECONDARY, fontSize: 14 }}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Word Hunt</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ fontSize: 36, marginBottom: 16 }}>⏳</Text>
          <Text style={{ color: TEXT_PRIMARY, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>
            {opName} is playing
          </Text>
          <Text style={{ color: TEXT_SECONDARY, fontSize: 14, textAlign: "center", paddingHorizontal: 40 }}>
            You'll play on the same board after them. The board is hidden until your turn.
          </Text>
        </View>
      </View>
    );
  }

  // ── My turn but haven't tapped Start yet — hide the board ──
  if (isMyTurn && !myDone && !hasStarted && !submittedRef.current) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: TEXT_SECONDARY, fontSize: 14 }}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Word Hunt</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ fontSize: 36, marginBottom: 16 }}>🔤</Text>
          <Text style={{ color: TEXT_PRIMARY, fontSize: 22, fontWeight: "800", marginBottom: 8 }}>
            Ready?
          </Text>
          <Text style={{ color: TEXT_SECONDARY, fontSize: 14, textAlign: "center", paddingHorizontal: 40, marginBottom: 28, lineHeight: 21 }}>
            Find as many words as you can in 90 seconds.{"\n"}Trace through adjacent letters.{"\n"}The timer starts when you tap Start.
          </Text>
          <Pressable
            style={[styles.startBtn, { backgroundColor: accent }]}
            onPress={handleStart}
          >
            <Text style={styles.startBtnText}>Start</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Already submitted, waiting for opponent ──
  if (myDone && waitingForOp) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: TEXT_SECONDARY, fontSize: 14 }}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Word Hunt</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.centered, { paddingHorizontal: 24 }]}>
          <View style={[styles.waitCard, { borderColor: `${accent}33` }]}>
            <Text style={styles.waitTitle}>You scored {score || game.scores?.[myUid] || 0} pts 🎯</Text>
            <Text style={styles.waitSub}>Waiting for {opName} to play…</Text>
            <View style={styles.wordTags}>
              {(foundWords.length > 0 ? foundWords : game.wordsFound?.[myUid] ?? []).slice(0, 10).map((w: string) => (
                <View key={w} style={[styles.tag, { backgroundColor: accentBg(mySide, 0.15) }]}>
                  <Text style={[styles.tagText, { color: accent }]}>{w} +{wordScore(w)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ── Active gameplay — board visible, timer running ──
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: TEXT_SECONDARY, fontSize: 14 }}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Word Hunt</Text>
        <Text style={[styles.timer, { color: timerColor }]}>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
        </Text>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: accentColor(opSide) }]}>{opScore}</Text>
          <Text style={styles.scoreName}>{opName}</Text>
        </View>
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: accent }]}>{score}</Text>
          <Text style={styles.scoreName}>You</Text>
        </View>
      </View>

      <View style={styles.wordDisplay}>
        <Text style={[styles.wordText, {
          color: currentWord.length >= 3 ? accent : TEXT_SECONDARY,
        }]}>
          {currentWord || "Trace letters to form words"}
        </Text>
        {lastWord && (
          <Text style={[styles.wordFeedback, {
            color: lastWord.valid ? accent : "#EF4444",
          }]}>
            {lastWord.valid ? lastWord.text : `✗ ${lastWord.text}`}
          </Text>
        )}
      </View>

      <View
        ref={gridRef} onLayout={onGridLayout}
        style={styles.grid}
        {...panResponder.current.panHandlers}
      >
        {board.map((letter, i) => {
          const pathIdx = selectedPath.indexOf(i);
          const isSelected = pathIdx >= 0;
          const isStart = pathIdx === 0;
          return (
            <View
              key={i}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                cellLayouts.current[i] = { x, y, w: width, h: height };
              }}
              style={[styles.cell, {
                backgroundColor: isSelected
                  ? isStart ? accent : accentBg(mySide, 0.55)
                  : BG_SURFACE,
                borderColor: isSelected ? accent : "rgba(255,255,255,0.06)",
                transform: isSelected ? [{ scale: 1.06 }] : [],
              }]}
            >
              <Text style={[styles.cellLetter, {
                color: isSelected ? "#fff" : TEXT_PRIMARY,
              }]}>{letter}</Text>
              {isSelected && (
                <Text style={styles.cellOrder}>{pathIdx + 1}</Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.bottom}>
        <Text style={styles.wordCount}>
          {foundWords.length} word{foundWords.length !== 1 ? "s" : ""} found
        </Text>
        <Pressable
          style={[styles.submitBtn, { backgroundColor: accent }]}
          onPress={() => submitTurn()}
        >
          <Text style={styles.submitText}>Done — Submit {score} pts</Text>
        </Pressable>
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
  headerTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700" },
  timer: { fontSize: 20, fontWeight: "800", width: 60, textAlign: "right" },
  scoreRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", width: "100%",
    paddingHorizontal: 40, paddingVertical: 6,
  },
  scoreBlock: { alignItems: "center", minWidth: 80 },
  scoreNum: { fontSize: 28, fontWeight: "800" },
  scoreName: { color: TEXT_SECONDARY, fontSize: 12 },
  vsText: { color: TEXT_SECONDARY, fontSize: 16, fontWeight: "700" },
  wordDisplay: { height: 48, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  wordText: { fontSize: 20, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase" },
  wordFeedback: { position: "absolute", bottom: -16, fontSize: 13, fontWeight: "600" },
  grid: { width: GRID_SIZE, flexDirection: "row", flexWrap: "wrap", gap: CELL_GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: 14,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  cellLetter: { fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  cellOrder: {
    position: "absolute", top: 4, right: 6,
    fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "700",
  },
  bottom: {
    flex: 1, width: "100%", paddingHorizontal: 24, paddingTop: 16, alignItems: "center",
  },
  wordCount: { color: TEXT_SECONDARY, fontSize: 13, marginBottom: 10 },
  submitBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  startBtn: { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 14 },
  startBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  waitCard: {
    width: "100%", backgroundColor: BG_SURFACE,
    borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center",
  },
  waitTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  waitSub: { color: TEXT_SECONDARY, fontSize: 14, marginBottom: 14 },
  wordTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
});
