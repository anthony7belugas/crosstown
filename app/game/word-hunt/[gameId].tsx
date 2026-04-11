// app/game/word-hunt/[gameId].tsx
// Word Hunt — 4x4 letter grid, trace a path through adjacent letters to form words.
// Turn-based: Player 1 plays for 90s, submits score. Player 2 gets same board, plays for 90s.
// Higher score wins. Both players' found words are stored in Firestore.
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc, getDoc, onSnapshot, updateDoc, serverTimestamp,
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
const GRID_PADDING = 24;
const CELL_GAP = 8;
const GRID_SIZE = SW - GRID_PADDING * 2;
const CELL_SIZE = (GRID_SIZE - CELL_GAP * 3) / 4;
const TURN_SECONDS = 90;

// ─── Main Screen ─────────────────────────────────────────────
export default function WordHuntScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<Game | null>(null);
  const [mySide, setMySide] = useState("usc");
  const [myUid] = useState(auth.currentUser?.uid ?? "");
  const [opponentName, setOpponentName] = useState("Rival");
  const [opponentSide, setOpponentSide] = useState("ucla");

  // Gameplay state
  const [board, setBoard] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);   // cell indices in current word
  const [currentWord, setCurrentWord] = useState("");
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [lastWord, setLastWord] = useState<{ word: string; valid: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [turnActive, setTurnActive] = useState(false);
  const [turnSubmitted, setTurnSubmitted] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Cell layout refs (filled by onLayout)
  const cellLayouts = useRef<{ x: number; y: number; width: number; height: number }[]>(
    new Array(16).fill(null)
  );
  const gridRef = useRef<View>(null);
  const gridOffset = useRef({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

      if (g.board && board.length === 0) setBoard(g.board);

      // Load opponent info
      const opUid = g.players.find((p) => p !== myUid);
      if (opUid && opponentName === "Rival") {
        const opSnap = await getDoc(doc(db, "users", opUid));
        if (opSnap.exists()) {
          setOpponentName(opSnap.data().name?.split(" ")[0] || "Rival");
          setOpponentSide(opSnap.data().side || "ucla");
        }
      }

      // Determine my turn state
      const isMyTurn = g.currentTurn === myUid;
      const myDone = g.turnDone?.[myUid] ?? false;

      if (isMyTurn && !myDone && !turnActive && !turnSubmitted) {
        startMyTurn();
      }

      // Check if waiting for opponent after I'm done
      if (myDone && !(g.turnDone?.[opUid ?? ""] ?? false)) {
        setWaitingForOpponent(true);
      }

      // Navigate to result when complete
      if (g.status === "complete") {
        router.replace(`/game/result/${gameId}` as any);
      }
    });
    return () => { unsub(); stopTimer(); };
  }, [gameId, myUid]);

  // ─── Timer ───────────────────────────────────────────────
  const startMyTurn = () => {
    setTurnActive(true);
    setTimeLeft(TURN_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          submitTurn();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // ─── Submit turn to Firestore ────────────────────────────
  const submitTurn = useCallback(async () => {
    if (!game || turnSubmitted) return;
    stopTimer();
    setTurnActive(false);
    setTurnSubmitted(true);

    const opUid = game.players.find((p) => p !== myUid) ?? "";
    const opDone = game.turnDone?.[opUid] ?? false;

    const updateData: any = {
      [`scores.${myUid}`]: score,
      [`wordsFound.${myUid}`]: foundWords,
      [`turnDone.${myUid}`]: true,
      currentTurn: opUid,
    };

    // If opponent already played, determine winner and complete
    if (opDone) {
      const opScore = game.scores?.[opUid] ?? 0;
      const winner = score > opScore ? myUid : score < opScore ? opUid : "draw";
      updateData.status = "complete";
      updateData.winner = winner;

      // Increment winner's all-time wins in scoreboard
      if (winner !== "draw") {
        const winnerSide = game.sides[winner];
        try {
          const talliesRef = doc(db, "scoreboard", "tallies");
          const tallies = await getDoc(talliesRef);
          if (tallies.exists()) {
            const current = tallies.data();
            const allKey = `${winnerSide}_alltime`;
            const weekKey = `${winnerSide}_weekly`;
            await updateDoc(talliesRef, {
              [allKey]: (current[allKey] ?? 0) + 1,
              [weekKey]: (current[weekKey] ?? 0) + 1,
            });
          }
        } catch { /* non-fatal */ }
      }
    }

    try {
      await updateDoc(doc(db, "games", gameId as string), updateData);
    } catch (e) {
      console.error("Failed to submit turn:", e);
    }
  }, [game, myUid, score, foundWords, turnSubmitted, gameId]);

  // ─── Pan gesture for tracing letters ────────────────────
  // We track which cell the touch is over and build a path

  const getCellAtPoint = useCallback((touchX: number, touchY: number): number => {
    const relX = touchX - gridOffset.current.x;
    const relY = touchY - gridOffset.current.y;
    for (let i = 0; i < 16; i++) {
      const layout = cellLayouts.current[i];
      if (!layout) continue;
      if (
        relX >= layout.x && relX <= layout.x + layout.width &&
        relY >= layout.y && relY <= layout.y + layout.height
      ) {
        return i;
      }
    }
    return -1;
  }, []);

  const pathRef = useRef<number[]>([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => turnActive,
      onMoveShouldSetPanResponder: () => turnActive,

      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const cell = getCellAtPoint(pageX, pageY);
        if (cell >= 0) {
          pathRef.current = [cell];
          setSelectedPath([cell]);
          setCurrentWord(board[cell] ?? "");
        }
      },

      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const cell = getCellAtPoint(pageX, pageY);
        if (cell < 0) return;
        const path = pathRef.current;
        if (path.includes(cell)) return; // already in path
        const last = path[path.length - 1];
        if (!isAdjacent(last, cell)) return; // must be adjacent
        pathRef.current = [...path, cell];
        setSelectedPath([...pathRef.current]);
        setCurrentWord(pathRef.current.map((i) => board[i]).join(""));
      },

      onPanResponderRelease: () => {
        const word = pathRef.current.map((i) => board[i]).join("").toUpperCase();
        pathRef.current = [];
        setSelectedPath([]);
        setCurrentWord("");

        if (word.length < 3) return;
        if (foundWords.includes(word)) {
          setLastWord({ word, valid: false });
          setTimeout(() => setLastWord(null), 1000);
          return;
        }
        if (isValidWord(word)) {
          const pts = wordScore(word);
          setFoundWords((prev) => [...prev, word]);
          setScore((s) => s + pts);
          setLastWord({ word: `+${pts} ${word}`, valid: true });
        } else {
          setLastWord({ word, valid: false });
        }
        setTimeout(() => setLastWord(null), 1000);
      },
    })
  ).current;

  // Measure grid position after render
  const onGridLayout = () => {
    gridRef.current?.measure((x, y, w, h, pageX, pageY) => {
      gridOffset.current = { x: pageX, y: pageY };
    });
  };

  // ─── Render ───────────────────────────────────────────────
  if (!game || board.length === 0) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: TEXT_SECONDARY }}>Loading…</Text>
      </View>
    );
  }

  const accent = accentColor(mySide);
  const isMyTurn = game.currentTurn === myUid;
  const myDone = game.turnDone?.[myUid] ?? false;
  const opUid = game.players.find((p) => p !== myUid) ?? "";
  const opScore = game.scores?.[opUid] ?? 0;
  const timerColor = timeLeft <= 15 ? USC_RED : timeLeft <= 30 ? "#F59E0B" : TEXT_PRIMARY;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
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
          <Text style={[styles.scoreNum, { color: accentColor(opponentSide) }]}>{opScore}</Text>
          <Text style={styles.scoreName}>{opponentName}</Text>
        </View>
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: accent }]}>{score}</Text>
          <Text style={styles.scoreName}>You</Text>
        </View>
      </View>

      {/* ── Current word display ── */}
      <View style={styles.wordDisplay}>
        <Text style={[styles.wordText, { color: currentWord.length >= 3 ? accent : TEXT_SECONDARY }]}>
          {currentWord || (turnActive ? "Trace letters to form words" : "")}
        </Text>
        {lastWord && (
          <Text style={[styles.wordFeedback, { color: lastWord.valid ? accent : "#EF4444" }]}>
            {lastWord.valid ? lastWord.word : `✗ ${lastWord.word}`}
          </Text>
        )}
      </View>

      {/* ── Grid ── */}
      <View
        ref={gridRef}
        onLayout={onGridLayout}
        style={styles.grid}
        {...(turnActive ? panResponder.panHandlers : {})}
      >
        {board.map((letter, i) => {
          const pathIdx = selectedPath.indexOf(i);
          const isSelected = pathIdx >= 0;
          const isStart = pathIdx === 0;
          return (
            <View
              key={i}
              onLayout={(e) => {
                cellLayouts.current[i] = e.nativeEvent.layout;
              }}
              style={[
                styles.cell,
                {
                  backgroundColor: isSelected
                    ? isStart
                      ? accent
                      : accentBg(mySide, 0.6)
                    : BG_SURFACE,
                  borderColor: isSelected ? accent : "rgba(255,255,255,0.08)",
                  transform: isSelected ? [{ scale: 1.08 }] : [],
                },
              ]}
            >
              <Text style={[styles.cellLetter, { color: isSelected ? "#fff" : TEXT_PRIMARY }]}>
                {letter}
              </Text>
              {isSelected && (
                <Text style={styles.cellOrder}>{pathIdx + 1}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* ── State-based bottom panel ── */}
      {turnActive && (
        <View style={styles.bottomPanel}>
          <Pressable
            style={[styles.submitBtn, { backgroundColor: accent }]}
            onPress={submitTurn}
          >
            <Text style={styles.submitBtnText}>Done — Submit {score} pts</Text>
          </Pressable>
        </View>
      )}

      {!turnActive && myDone && waitingForOpponent && (
        <View style={styles.bottomPanel}>
          <View style={[styles.waitingCard, { borderColor: `${accent}33` }]}>
            <Text style={styles.waitingTitle}>You scored {score} pts 🎯</Text>
            <Text style={styles.waitingSubtitle}>Waiting for {opponentName} to play…</Text>
            <View style={styles.foundWordsList}>
              {foundWords.slice(0, 8).map((w) => (
                <View key={w} style={[styles.wordTag, { backgroundColor: accentBg(mySide, 0.2) }]}>
                  <Text style={[styles.wordTagText, { color: accent }]}>
                    {w} (+{wordScore(w)})
                  </Text>
                </View>
              ))}
              {foundWords.length > 8 && (
                <Text style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                  +{foundWords.length - 8} more
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {!turnActive && !myDone && !isMyTurn && (
        <View style={styles.bottomPanel}>
          <View style={[styles.waitingCard, { borderColor: "rgba(255,255,255,0.1)" }]}>
            <Text style={styles.waitingTitle}>⏳ {opponentName} is playing</Text>
            <Text style={styles.waitingSubtitle}>You'll play on the same board after them.</Text>
          </View>
        </View>
      )}

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
  timer: {
    fontSize: 20,
    fontWeight: "800",
    width: 60,
    textAlign: "right",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 40,
    paddingVertical: 8,
  },
  scoreBlock: { alignItems: "center", minWidth: 80 },
  scoreNum: { fontSize: 28, fontWeight: "800" },
  scoreName: { color: TEXT_SECONDARY, fontSize: 12 },
  vsText: { color: TEXT_SECONDARY, fontSize: 16, fontWeight: "700" },
  wordDisplay: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  wordText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  wordFeedback: {
    position: "absolute",
    bottom: -16,
    fontSize: 13,
    fontWeight: "600",
  },
  grid: {
    width: GRID_SIZE,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cellLetter: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cellOrder: {
    position: "absolute",
    top: 4,
    right: 6,
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
  },
  bottomPanel: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: "center",
  },
  submitBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  waitingCard: {
    width: "100%",
    backgroundColor: BG_SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  waitingTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  waitingSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 16,
  },
  foundWordsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  wordTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  wordTagText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
