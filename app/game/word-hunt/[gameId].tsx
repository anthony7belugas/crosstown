// app/game/word-hunt/[gameId].tsx
// Word Hunt — 4x4 letter grid, trace adjacent letters to form words.
// Turn-based: Player 1 plays 90s, submits. Player 2 gets same board.
// Timer cannot be paused by leaving — once started, it runs to completion.
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc, getDoc, onSnapshot, updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions, PanResponder, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebaseConfig";
import { Game, isAdjacent, wordScore } from "../../../utils/gameUtils";
import { isValidWord } from "../../../utils/wordList";
import {
  accentColor, accentBg, rivalColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
  USC_RED, UCLA_BLUE,
} from "../../../utils/colors";

const { width: SW } = Dimensions.get("window");
const GRID_PAD = 24;
const CELL_GAP = 8;
const GRID_SIZE = SW - GRID_PAD * 2;
const CELL_SIZE = (GRID_SIZE - CELL_GAP * 3) / 4;
const TURN_SECONDS = 90;

// ─── Main Screen ─────────────────────────────────────────────
export default function WordHuntScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<Game | null>(null);
  const [mySide, setMySide] = useState("usc");
  const myUid = auth.currentUser?.uid ?? "";
  const [opName, setOpName] = useState("Rival");
  const [opSide, setOpSide] = useState("ucla");

  // Gameplay state
  const [board, setBoard] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [lastWord, setLastWord] = useState<{ text: string; valid: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [turnActive, setTurnActive] = useState(false);
  const [turnSubmitted, setTurnSubmitted] = useState(false);
  const [waitingForOp, setWaitingForOp] = useState(false);

  // Refs for PanResponder access (avoids stale closures)
  const boardRef = useRef<string[]>([]);
  const foundWordsRef = useRef<string[]>([]);
  const scoreRef = useRef(0);
  const turnActiveRef = useRef(false);
  const pathRef = useRef<number[]>([]);

  // Cell layout refs
  const cellLayouts = useRef<{ x: number; y: number; w: number; h: number }[]>(
    new Array(16).fill({ x: 0, y: 0, w: 0, h: 0 })
  );
  const gridRef = useRef<View>(null);
  const gridPageOffset = useRef({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gridMeasured = useRef(false);

  // Keep refs in sync
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { foundWordsRef.current = foundWords; }, [foundWords]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { turnActiveRef.current = turnActive; }, [turnActive]);

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

      const oUid = g.players.find((p) => p !== myUid);
      if (oUid && opName === "Rival") {
        const opSnap = await getDoc(doc(db, "users", oUid));
        if (opSnap.exists()) {
          setOpName(opSnap.data().name?.split(" ")[0] || "Rival");
          setOpSide(opSnap.data().side || "ucla");
        }
      }

      // Start my turn if it's my turn and I haven't played
      const isMyTurn = g.currentTurn === myUid;
      const myDone = g.turnDone?.[myUid] ?? false;
      if (isMyTurn && !myDone && !turnActiveRef.current && !turnSubmitted) {
        startMyTurn();
      }

      // Waiting state
      if (myDone && !(g.turnDone?.[oUid ?? ""] ?? false)) {
        setWaitingForOp(true);
      }

      // Navigate to result
      if (g.status === "complete") {
        router.replace(`/game/result/${gameId}` as any);
      }
    });
    return () => { unsub(); stopTimer(); };
  }, [gameId, myUid, turnSubmitted]);

  // ── Timer ──
  const startMyTurn = () => {
    setTurnActive(true);
    setTimeLeft(TURN_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopTimer();
          submitTurnNow();
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

  // ── Submit turn ──
  const submitTurnNow = useCallback(async () => {
    if (turnSubmitted) return;
    stopTimer();
    setTurnActive(false);
    setTurnSubmitted(true);

    const g = gameRef_latest();
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

    // If opponent already played, determine winner
    if (opDone) {
      const opScore = g.scores?.[oUid] ?? 0;
      const winner = myFinalScore > opScore ? myUid
        : myFinalScore < opScore ? oUid : "draw";
      update.status = "complete";
      update.winner = winner;
      // NOTE: scoreboard tally is handled by Cloud Function onGameComplete
      // — NOT client-side, to avoid double-counting and race conditions
    }

    try {
      await updateDoc(doc(db, "games", gameId as string), update);
    } catch (e) {
      console.error("Failed to submit turn:", e);
    }
  }, [myUid, gameId, turnSubmitted]);

  // Helper to get latest game state from ref
  const gameRef_latest = () => game;

  // ── Cell hit detection ──
  const getCellAtPoint = useCallback((pageX: number, pageY: number): number => {
    const relX = pageX - gridPageOffset.current.x;
    const relY = pageY - gridPageOffset.current.y;
    for (let i = 0; i < 16; i++) {
      const c = cellLayouts.current[i];
      if (!c) continue;
      if (relX >= c.x && relX <= c.x + c.w && relY >= c.y && relY <= c.y + c.h) {
        return i;
      }
    }
    return -1;
  }, []);

  // ── PanResponder ──
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => turnActiveRef.current,
    onMoveShouldSetPanResponder: () => turnActiveRef.current,
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
      const last = path[path.length - 1];
      if (!isAdjacent(last, cell)) return;
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
        setLastWord({ text: `Already found`, valid: false });
        setTimeout(() => setLastWord(null), 800);
        return;
      }
      if (isValidWord(word)) {
        const pts = wordScore(word);
        const newWords = [...foundWordsRef.current, word];
        foundWordsRef.current = newWords;
        setFoundWords(newWords);
        const newScore = scoreRef.current + pts;
        scoreRef.current = newScore;
        setScore(newScore);
        setLastWord({ text: `+${pts} ${word}`, valid: true });
      } else {
        setLastWord({ text: word, valid: false });
      }
      setTimeout(() => setLastWord(null), 900);
    },
  }));

  // Rebuild PanResponder when getCellAtPoint changes
  useEffect(() => {
    panResponder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => turnActiveRef.current,
      onMoveShouldSetPanResponder: () => turnActiveRef.current,
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
        const last = path[path.length - 1];
        if (!isAdjacent(last, cell)) return;
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
          setLastWord({ text: `Already found`, valid: false });
          setTimeout(() => setLastWord(null), 800);
          return;
        }
        if (isValidWord(word)) {
          const pts = wordScore(word);
          const newWords = [...foundWordsRef.current, word];
          foundWordsRef.current = newWords;
          setFoundWords(newWords);
          const newScore = scoreRef.current + pts;
          scoreRef.current = newScore;
          setScore(newScore);
          setLastWord({ text: `+${pts} ${word}`, valid: true });
        } else {
          setLastWord({ text: word, valid: false });
        }
        setTimeout(() => setLastWord(null), 900);
      },
    });
  }, [getCellAtPoint]);

  // Measure grid after layout with a small delay for reliability
  const onGridLayout = () => {
    setTimeout(() => {
      gridRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        if (pageX !== undefined && pageY !== undefined) {
          gridPageOffset.current = { x: pageX, y: pageY };
          gridMeasured.current = true;
        }
      });
    }, 100);
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: TEXT_SECONDARY, fontSize: 14 }}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Word Hunt</Text>
        {turnActive ? (
          <Text style={[styles.timer, { color: timerColor }]}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </Text>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* ── Scores ── */}
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

      {/* ── Current word ── */}
      <View style={styles.wordDisplay}>
        <Text style={[styles.wordText, {
          color: currentWord.length >= 3 ? accent : TEXT_SECONDARY,
        }]}>
          {currentWord || (turnActive ? "Trace letters to form words" : "")}
        </Text>
        {lastWord && (
          <Text style={[styles.wordFeedback, {
            color: lastWord.valid ? accent : "#EF4444",
          }]}>
            {lastWord.valid ? lastWord.text : `✗ ${lastWord.text}`}
          </Text>
        )}
      </View>

      {/* ── Grid ── */}
      <View
        ref={gridRef}
        onLayout={onGridLayout}
        style={styles.grid}
        {...(turnActive ? panResponder.current.panHandlers : {})}
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
              style={[
                styles.cell,
                {
                  backgroundColor: isSelected
                    ? isStart ? accent : accentBg(mySide, 0.55)
                    : BG_SURFACE,
                  borderColor: isSelected ? accent : "rgba(255,255,255,0.06)",
                  transform: isSelected ? [{ scale: 1.06 }] : [],
                },
              ]}
            >
              <Text style={[styles.cellLetter, {
                color: isSelected ? "#fff" : TEXT_PRIMARY,
              }]}>
                {letter}
              </Text>
              {isSelected && (
                <Text style={styles.cellOrder}>{pathIdx + 1}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* ── Bottom panel ── */}
      {turnActive && (
        <View style={styles.bottom}>
          <Text style={styles.wordCount}>
            {foundWords.length} word{foundWords.length !== 1 ? "s" : ""} found
          </Text>
          <Pressable
            style={[styles.submitBtn, { backgroundColor: accent }]}
            onPress={() => { stopTimer(); submitTurnNow(); }}
          >
            <Text style={styles.submitText}>Done — Submit {score} pts</Text>
          </Pressable>
        </View>
      )}

      {!turnActive && myDone && waitingForOp && (
        <View style={styles.bottom}>
          <View style={[styles.waitCard, { borderColor: `${accent}33` }]}>
            <Text style={styles.waitTitle}>You scored {score} pts 🎯</Text>
            <Text style={styles.waitSub}>Waiting for {opName} to play…</Text>
            <View style={styles.wordTags}>
              {foundWords.slice(0, 10).map((w) => (
                <View key={w} style={[styles.tag, { backgroundColor: accentBg(mySide, 0.15) }]}>
                  <Text style={[styles.tagText, { color: accent }]}>
                    {w} +{wordScore(w)}
                  </Text>
                </View>
              ))}
              {foundWords.length > 10 && (
                <Text style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                  +{foundWords.length - 10} more
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {!turnActive && !myDone && !isMyTurn && (
        <View style={styles.bottom}>
          <View style={[styles.waitCard, { borderColor: "rgba(255,255,255,0.08)" }]}>
            <Text style={styles.waitTitle}>⏳ {opName} is playing</Text>
            <Text style={styles.waitSub}>You'll play on the same board after them.</Text>
          </View>
        </View>
      )}
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
  wordFeedback: {
    position: "absolute", bottom: -16, fontSize: 13, fontWeight: "600",
  },
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
