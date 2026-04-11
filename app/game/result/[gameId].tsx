// app/game/result/[gameId].tsx
// Game result — school-color collision screen, shows winner, final score, rematch CTA
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing, Image, Pressable,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebaseConfig";
import { createGame, Game, GameType } from "../../../utils/gameUtils";
import {
  accentColor, accentBg, rivalColor, schoolColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
  USC_RED, UCLA_BLUE,
} from "../../../utils/colors";

const { width: SW } = Dimensions.get("window");

export default function GameResultScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<Game | null>(null);
  const [mySide, setMySide] = useState("usc");
  const [myUid] = useState(auth.currentUser?.uid ?? "");
  const [opponentName, setOpponentName] = useState("Rival");
  const [opponentSide, setOpponentSide] = useState("ucla");
  const [opponentPhoto, setOpponentPhoto] = useState("");
  const [showRematch, setShowRematch] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Entry animations
  const leftSlide = useRef(new Animated.Value(-SW / 2)).current;
  const rightSlide = useRef(new Animated.Value(SW / 2)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!myUid) return;
    getDoc(doc(db, "users", myUid)).then((s) => {
      if (s.exists()) setMySide(s.data().side || "usc");
    });
  }, [myUid]);

  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, "games", gameId), async (snap) => {
      if (!snap.exists()) return;
      const g = { id: snap.id, ...snap.data() } as Game;
      setGame(g);

      const opUid = g.players.find((p) => p !== myUid) ?? "";
      const opSnap = await getDoc(doc(db, "users", opUid));
      if (opSnap.exists()) {
        const d = opSnap.data();
        setOpponentName(d.name?.split(" ")[0] || "Rival");
        setOpponentSide(d.side || "ucla");
        setOpponentPhoto(d.photos?.[0] || "");
      }

      // Trigger entry animation
      Animated.sequence([
        Animated.parallel([
          Animated.timing(leftSlide, {
            toValue: SW * 0.1,
            duration: 500,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
          Animated.timing(rightSlide, {
            toValue: -SW * 0.1,
            duration: 500,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(resultOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => unsub();
  }, [gameId, myUid]);

  const launchRematch = async (type: GameType) => {
    if (!game || launching) return;
    setLaunching(true);
    const opUid = game.players.find((p) => p !== myUid) ?? "";
    try {
      const newGameId = await createGame(
        game.matchId,
        type,
        [myUid, opUid],
        { ...game.sides }
      );
      const route = type === "cup_pong"
        ? `/game/cup-pong/${newGameId}`
        : `/game/word-hunt/${newGameId}`;
      router.replace(route as any);
    } catch (e) {
      console.error("Failed to create rematch:", e);
      setLaunching(false);
    }
  };

  if (!game) {
    return (
      <View style={[styles.root, { justifyContent: "center" }]}>
        <Text style={{ color: TEXT_SECONDARY }}>Loading…</Text>
      </View>
    );
  }

  const accent = accentColor(mySide);
  const opAccent = rivalColor(mySide);
  const iWon = game.winner === myUid;
  const isDraw = game.winner === "draw";
  const opUid = game.players.find((p) => p !== myUid) ?? "";

  // Cup Pong cup counts
  const myCupsLeft = game.cups?.[myUid]?.filter(Boolean).length ?? 0;
  const opCupsLeft = game.cups?.[opUid]?.filter(Boolean).length ?? 0;

  // Word Hunt scores
  const myScore = game.scores?.[myUid] ?? 0;
  const opScore = game.scores?.[opUid] ?? 0;
  const myWords = game.wordsFound?.[myUid] ?? [];
  const opWords = game.wordsFound?.[opUid] ?? [];

  const isCupPong = game.type === "cup_pong";

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Collision banner ── */}
      <View style={styles.collisionRow}>
        <Animated.View
          style={[
            styles.collisionBlock,
            { backgroundColor: accentBg(mySide, 0.25), transform: [{ translateX: leftSlide }] },
          ]}
        >
          <Text style={[styles.collisionSchool, { color: accent }]}>
            {mySide === "usc" ? "USC" : "UCLA"}
          </Text>
        </Animated.View>
        <Text style={styles.vsGlyph}>⚔</Text>
        <Animated.View
          style={[
            styles.collisionBlock,
            { backgroundColor: accentBg(opponentSide, 0.25), transform: [{ translateX: rightSlide }] },
          ]}
        >
          <Text style={[styles.collisionSchool, { color: opAccent }]}>
            {opponentSide === "usc" ? "USC" : "UCLA"}
          </Text>
        </Animated.View>
      </View>

      {/* ── Result ── */}
      <Animated.View style={[styles.resultBlock, { opacity: resultOpacity }]}>
        <Text style={[styles.resultVerdict, {
          color: isDraw ? TEXT_SECONDARY : iWon ? accent : opAccent,
        }]}>
          {isDraw ? "DRAW" : iWon ? "YOU WIN 🏆" : "YOU LOST"}
        </Text>

        {isCupPong ? (
          <Text style={styles.resultDetail}>
            {iWon
              ? `Sank all of ${opponentName}'s cups!`
              : `${opponentName} sank all your cups.`}
          </Text>
        ) : (
          <Text style={styles.resultDetail}>
            {iWon
              ? `${myScore} pts vs ${opScore} pts`
              : isDraw
              ? `Tied at ${myScore} pts each`
              : `${opScore} pts vs ${myScore} pts`}
          </Text>
        )}
      </Animated.View>

      {/* ── Score cards ── */}
      <Animated.View style={[styles.scoreCards, { opacity: resultOpacity }]}>
        {/* Me */}
        <View style={[styles.scoreCard, { borderColor: `${accent}44` }]}>
          <Text style={[styles.cardSchool, { color: accent }]}>
            {mySide === "usc" ? "USC" : "UCLA"}
          </Text>
          <Text style={styles.cardName}>You</Text>
          {isCupPong ? (
            <Text style={[styles.cardScore, { color: TEXT_PRIMARY }]}>
              {6 - myCupsLeft} sunk
            </Text>
          ) : (
            <>
              <Text style={[styles.cardScore, { color: accent }]}>{myScore} pts</Text>
              <Text style={styles.cardWords}>{myWords.length} words</Text>
            </>
          )}
        </View>

        {/* Opponent */}
        <View style={[styles.scoreCard, { borderColor: `${opAccent}44` }]}>
          <Text style={[styles.cardSchool, { color: opAccent }]}>
            {opponentSide === "usc" ? "USC" : "UCLA"}
          </Text>
          <Text style={styles.cardName}>{opponentName}</Text>
          {isCupPong ? (
            <Text style={[styles.cardScore, { color: TEXT_PRIMARY }]}>
              {6 - opCupsLeft} sunk
            </Text>
          ) : (
            <>
              <Text style={[styles.cardScore, { color: opAccent }]}>{opScore} pts</Text>
              <Text style={styles.cardWords}>{opWords.length} words</Text>
            </>
          )}
        </View>
      </Animated.View>

      {/* ── Rematch / Continue ── */}
      <Animated.View style={[styles.actions, { opacity: resultOpacity }]}>
        {!showRematch ? (
          <>
            <Pressable
              style={[styles.rematchBtn, { backgroundColor: accent }]}
              onPress={() => setShowRematch(true)}
            >
              <Text style={styles.rematchBtnText}>⚔ Rematch</Text>
            </Pressable>
            <Pressable
              style={styles.chatBtn}
              onPress={() => router.replace(`/chat/${game.matchId}` as any)}
            >
              <Text style={[styles.chatBtnText, { color: accent }]}>
                Open Chat →
              </Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.gamePicker}>
            <Text style={[styles.gamePickerTitle, { color: TEXT_SECONDARY }]}>
              Choose a game
            </Text>
            <Pressable
              style={[styles.gameOption, { borderColor: `${accent}66` }]}
              onPress={() => launchRematch("cup_pong")}
              disabled={launching}
            >
              <Text style={styles.gameOptionEmoji}>🏓</Text>
              <Text style={[styles.gameOptionTitle, { color: TEXT_PRIMARY }]}>Cup Pong</Text>
              <Text style={styles.gameOptionDesc}>Sink all 6 cups to win</Text>
            </Pressable>
            <Pressable
              style={[styles.gameOption, { borderColor: `${accent}66` }]}
              onPress={() => launchRematch("word_hunt")}
              disabled={launching}
            >
              <Text style={styles.gameOptionEmoji}>🔤</Text>
              <Text style={[styles.gameOptionTitle, { color: TEXT_PRIMARY }]}>Word Hunt</Text>
              <Text style={styles.gameOptionDesc}>Find the most words in 90s</Text>
            </Pressable>
            <Pressable onPress={() => setShowRematch(false)}>
              <Text style={{ color: TEXT_SECONDARY, fontSize: 13, marginTop: 8 }}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

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
  collisionRow: {
    flexDirection: "row",
    width: "100%",
    height: 100,
    overflow: "hidden",
    marginBottom: 8,
    alignItems: "center",
  },
  collisionBlock: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  collisionSchool: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 4,
  },
  vsGlyph: {
    fontSize: 28,
    color: TEXT_SECONDARY,
    zIndex: 2,
    marginHorizontal: -8,
  },
  resultBlock: {
    alignItems: "center",
    marginVertical: 16,
  },
  resultVerdict: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 6,
  },
  resultDetail: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  scoreCards: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    width: "100%",
    marginBottom: 24,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: BG_SURFACE,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  cardSchool: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  cardName: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardScore: {
    fontSize: 24,
    fontWeight: "800",
  },
  cardWords: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  actions: {
    width: "100%",
    paddingHorizontal: 24,
    gap: 12,
    alignItems: "center",
  },
  rematchBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  rematchBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  chatBtn: {
    paddingVertical: 12,
  },
  chatBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  gamePicker: {
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  gamePickerTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  gameOption: {
    width: "100%",
    backgroundColor: BG_SURFACE,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  gameOptionEmoji: { fontSize: 28 },
  gameOptionTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  gameOptionDesc: { color: TEXT_SECONDARY, fontSize: 12 },
});
