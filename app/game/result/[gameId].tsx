// app/game/result/[gameId].tsx
// Game result — school-color collision, winner display, rematch CTA
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebaseConfig";
import { createGame, Game, GameType } from "../../../utils/gameUtils";
import {
  accentColor, accentBg, rivalColor,
  BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY,
} from "../../../utils/colors";

const { width: SW } = Dimensions.get("window");

export default function GameResultScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [game, setGame] = useState<Game | null>(null);
  const [mySide, setMySide] = useState("usc");
  const myUid = auth.currentUser?.uid ?? "";
  const [opName, setOpName] = useState("Rival");
  const [opSide, setOpSide] = useState("ucla");
  const [showRematch, setShowRematch] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Animation — fires only once
  const hasAnimated = useRef(false);
  const leftSlide = useRef(new Animated.Value(-SW / 2)).current;
  const rightSlide = useRef(new Animated.Value(SW / 2)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

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

      const oUid = g.players.find((p) => p !== myUid) ?? "";
      const opSnap = await getDoc(doc(db, "users", oUid));
      if (opSnap.exists()) {
        const d = opSnap.data();
        setOpName(d.name?.split(" ")[0] || "Rival");
        setOpSide(d.side || "ucla");
      }

      // Run entry animation once
      if (!hasAnimated.current) {
        hasAnimated.current = true;
        Animated.sequence([
          Animated.parallel([
            Animated.timing(leftSlide, {
              toValue: SW * 0.1, duration: 500,
              easing: Easing.out(Easing.back(1.5)), useNativeDriver: true,
            }),
            Animated.timing(rightSlide, {
              toValue: -SW * 0.1, duration: 500,
              easing: Easing.out(Easing.back(1.5)), useNativeDriver: true,
            }),
          ]),
          Animated.timing(contentOpacity, {
            toValue: 1, duration: 300, useNativeDriver: true,
          }),
        ]).start();
      }
    });
    return () => unsub();
  }, [gameId, myUid]);

  const launchRematch = async (type: GameType) => {
    if (!game || launching) return;
    setLaunching(true);
    const oUid = game.players.find((p) => p !== myUid) ?? "";
    try {
      const newId = await createGame(game.showdownId, type,
        [myUid, oUid], { ...game.sides });
      const route = type === "cup_pong"
        ? `/game/cup-pong/${newId}` : `/game/word-hunt/${newId}`;
      router.replace(route as any);
    } catch (e) {
      console.error("Rematch failed:", e);
      setLaunching(false);
    }
  };

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
  const iWon = game.winner === myUid;
  const isDraw = game.winner === "draw";
  const opUid = game.players.find((p) => p !== myUid) ?? "";
  const isCupPong = game.type === "cup_pong";

  const mySunk = isCupPong ? (game.cups?.[myUid]?.filter((c) => !c).length ?? 0) : 0;
  const opSunk = isCupPong ? (game.cups?.[opUid]?.filter((c) => !c).length ?? 0) : 0;
  const myScore = game.scores?.[myUid] ?? 0;
  const opScore = game.scores?.[opUid] ?? 0;
  const myWords = game.wordsFound?.[myUid] ?? [];
  const opWords = game.wordsFound?.[opUid] ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Collision banner ── */}
      <View style={styles.collisionRow}>
        <Animated.View style={[styles.collisionBlock,
          { backgroundColor: accentBg(mySide, 0.25), transform: [{ translateX: leftSlide }] }
        ]}>
          <Text style={[styles.collisionSchool, { color: accent }]}>
            {mySide === "usc" ? "USC" : "UCLA"}
          </Text>
        </Animated.View>
        <Text style={styles.vsGlyph}>⚔</Text>
        <Animated.View style={[styles.collisionBlock,
          { backgroundColor: accentBg(opSide, 0.25), transform: [{ translateX: rightSlide }] }
        ]}>
          <Text style={[styles.collisionSchool, { color: opAccent }]}>
            {opSide === "usc" ? "USC" : "UCLA"}
          </Text>
        </Animated.View>
      </View>

      {/* ── Result ── */}
      <Animated.View style={[styles.resultBlock, { opacity: contentOpacity }]}>
        <Text style={[styles.verdict, {
          color: isDraw ? TEXT_SECONDARY : iWon ? accent : opAccent,
        }]}>
          {isDraw ? "DRAW" : iWon ? "YOU WIN 🏆" : "YOU LOST"}
        </Text>
        <Text style={styles.detail}>
          {isCupPong
            ? iWon
              ? `Sank all of ${opName}'s cups!`
              : `${opName} sank all your cups.`
            : isDraw
              ? `Tied at ${myScore} pts each`
              : iWon
                ? `${myScore} pts vs ${opScore} pts`
                : `${opScore} pts vs ${myScore} pts`
          }
        </Text>
      </Animated.View>

      {/* ── Score cards ── */}
      <Animated.View style={[styles.cards, { opacity: contentOpacity }]}>
        <View style={[styles.card, { borderColor: `${accent}44` }]}>
          <Text style={[styles.cardSchool, { color: accent }]}>
            {mySide === "usc" ? "USC" : "UCLA"}
          </Text>
          <Text style={styles.cardName}>You</Text>
          {isCupPong ? (
            <Text style={[styles.cardScore, { color: TEXT_PRIMARY }]}>
              {6 - mySunk} cups left
            </Text>
          ) : (
            <>
              <Text style={[styles.cardScore, { color: accent }]}>{myScore} pts</Text>
              <Text style={styles.cardDetail}>{myWords.length} words</Text>
            </>
          )}
        </View>
        <View style={[styles.card, { borderColor: `${opAccent}44` }]}>
          <Text style={[styles.cardSchool, { color: opAccent }]}>
            {opSide === "usc" ? "USC" : "UCLA"}
          </Text>
          <Text style={styles.cardName}>{opName}</Text>
          {isCupPong ? (
            <Text style={[styles.cardScore, { color: TEXT_PRIMARY }]}>
              {6 - opSunk} cups left
            </Text>
          ) : (
            <>
              <Text style={[styles.cardScore, { color: opAccent }]}>{opScore} pts</Text>
              <Text style={styles.cardDetail}>{opWords.length} words</Text>
            </>
          )}
        </View>
      </Animated.View>

      {/* ── Actions ── */}
      <Animated.View style={[styles.actions, { opacity: contentOpacity }]}>
        {!showRematch ? (
          <>
            <Pressable
              style={[styles.rematchBtn, { backgroundColor: accent }]}
              onPress={() => setShowRematch(true)}
            >
              <Text style={styles.rematchText}>⚔ Rematch</Text>
            </Pressable>
            <Pressable
              style={styles.chatBtn}
              onPress={() => router.replace(`/chat/${game.showdownId}` as any)}
            >
              <Text style={[styles.chatText, { color: accent }]}>Open Chat →</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>Choose a game</Text>
            <Pressable
              style={[styles.gameOpt, { borderColor: `${accent}55` }]}
              onPress={() => launchRematch("cup_pong")}
              disabled={launching}
            >
              <Text style={styles.gameEmoji}>🏓</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gameTitle, { color: TEXT_PRIMARY }]}>Cup Pong</Text>
                <Text style={styles.gameDesc}>Sink all 6 cups to win</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.gameOpt, { borderColor: `${accent}55` }]}
              onPress={() => launchRematch("word_hunt")}
              disabled={launching}
            >
              <Text style={styles.gameEmoji}>🔤</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gameTitle, { color: TEXT_PRIMARY }]}>Word Hunt</Text>
                <Text style={styles.gameDesc}>Find the most words in 90s</Text>
              </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_PRIMARY, alignItems: "center" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  collisionRow: {
    flexDirection: "row", width: "100%", height: 100,
    overflow: "hidden", marginBottom: 8, alignItems: "center",
  },
  collisionBlock: {
    flex: 1, height: "100%", alignItems: "center", justifyContent: "center",
  },
  collisionSchool: { fontSize: 32, fontWeight: "900", letterSpacing: 4 },
  vsGlyph: { fontSize: 28, color: TEXT_SECONDARY, zIndex: 2, marginHorizontal: -8 },
  resultBlock: { alignItems: "center", marginVertical: 16 },
  verdict: { fontSize: 34, fontWeight: "900", letterSpacing: 2, marginBottom: 6 },
  detail: { color: TEXT_SECONDARY, fontSize: 15 },
  cards: {
    flexDirection: "row", gap: 12, paddingHorizontal: 24,
    width: "100%", marginBottom: 24,
  },
  card: {
    flex: 1, backgroundColor: BG_SURFACE, borderRadius: 16,
    borderWidth: 1.5, padding: 16, alignItems: "center", gap: 4,
  },
  cardSchool: { fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  cardName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: "700", marginBottom: 4 },
  cardScore: { fontSize: 24, fontWeight: "800" },
  cardDetail: { color: TEXT_SECONDARY, fontSize: 12 },
  actions: { width: "100%", paddingHorizontal: 24, gap: 12, alignItems: "center" },
  rematchBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  rematchText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  chatBtn: { paddingVertical: 12 },
  chatText: { fontSize: 15, fontWeight: "600" },
  picker: { width: "100%", alignItems: "center", gap: 10 },
  pickerTitle: {
    fontSize: 13, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 1, color: TEXT_SECONDARY, marginBottom: 4,
  },
  gameOpt: {
    width: "100%", backgroundColor: BG_SURFACE, borderRadius: 14,
    borderWidth: 1.5, padding: 16, flexDirection: "row", alignItems: "center", gap: 14,
  },
  gameEmoji: { fontSize: 28 },
  gameTitle: { fontSize: 16, fontWeight: "700" },
  gameDesc: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
});
