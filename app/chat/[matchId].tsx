// app/chat/[matchId].tsx
// 1:1 chat — with persistent ⚔ Rematch button in header and game-picker modal
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc, collection, doc, getDoc, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal,
  Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlockModal } from "../../components/BlockModal";
import { MoreOptionsMenu } from "../../components/MoreOptionsMenu";
import { ReportModal } from "../../components/ReportModal";
import { auth, db } from "../../firebaseConfig";
import { blockUser, reportUser, ReportReason } from "../../utils/blockUtils";
import { containsBannedWords } from "../../utils/contentFilter";
import { accentColor, accentBg, schoolColor, BG_PRIMARY, BG_SURFACE, TEXT_PRIMARY, TEXT_SECONDARY } from "../../utils/colors";
import { createGame, GameType } from "../../utils/gameUtils";

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

interface OtherUser {
  name: string;
  photo: string;
  side: "usc" | "ucla";
  uid: string;
}

export default function ChatDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mySide, setMySide] = useState<string>("usc");
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // Game / rematch state
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeGameType, setActiveGameType] = useState<GameType | null>(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [launchingGame, setLaunchingGame] = useState(false);

  const styles = createStyles(mySide);

  // ─── Load match + user info ───────────────────────────────
  useEffect(() => {
    if (!matchId || !auth.currentUser) return;

    getDoc(doc(db, "users", auth.currentUser.uid)).then((meSnap) => {
      if (meSnap.exists()) setMySide(meSnap.data().side || "usc");
    }).catch(() => {});

    const loadMatchInfo = async () => {
      try {
        const matchDoc = await getDoc(doc(db, "matches", matchId));
        if (!matchDoc.exists()) { setLoading(false); return; }
        const matchData = matchDoc.data();
        const otherUserId = matchData.users.find(
          (id: string) => id !== auth.currentUser!.uid
        );
        if (otherUserId) {
          const userDoc = await getDoc(doc(db, "users", otherUserId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setOtherUser({
              uid: otherUserId,
              name: userData.name || "Unknown",
              photo: userData.photos?.[0] || "",
              side: userData.side || "usc",
            });
          }
        }
      } catch (error) {
        console.error("Error loading match:", error);
      }
    };
    loadMatchInfo();
  }, [matchId]);

  // ─── Real-time match doc listener (picks up activeGameId) ─
  useEffect(() => {
    if (!matchId) return;
    const unsub = onSnapshot(doc(db, "matches", matchId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setActiveGameId(data.activeGameId ?? null);
      setActiveGameType(data.activeGameType ?? null);
    });
    return () => unsub();
  }, [matchId]);

  // ─── Real-time messages ───────────────────────────────────
  useEffect(() => {
    if (!matchId) return;
    const q = query(
      collection(db, "matches", matchId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub();
  }, [matchId]);

  // ─── Send message ─────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim() || !matchId || !auth.currentUser || sending) return;
    const text = inputText.trim();
    if (containsBannedWords(text)) { setInputText(""); return; }
    setSending(true);
    setInputText("");
    try {
      await addDoc(collection(db, "matches", matchId, "messages"), {
        senderId: auth.currentUser.uid,
        text,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "matches", matchId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  // ─── Launch game ──────────────────────────────────────────
  const launchActiveGame = () => {
    if (!activeGameId || !activeGameType) return;
    const route = activeGameType === "cup_pong"
      ? `/game/cup-pong/${activeGameId}`
      : `/game/word-hunt/${activeGameId}`;
    router.push(route as any);
  };

  const launchRematch = async (type: GameType) => {
    if (!matchId || !otherUser || !auth.currentUser || launchingGame) return;
    setLaunchingGame(true);
    setShowGamePicker(false);
    try {
      const meSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
      const mySideVal = meSnap.exists() ? meSnap.data().side : "usc";
      const sides: Record<string, string> = {
        [auth.currentUser.uid]: mySideVal,
        [otherUser.uid]: otherUser.side,
      };
      const gameId = await createGame(
        matchId,
        type,
        [auth.currentUser.uid, otherUser.uid],
        sides as any
      );
      const route = type === "cup_pong"
        ? `/game/cup-pong/${gameId}`
        : `/game/word-hunt/${gameId}`;
      router.push(route as any);
    } catch (e) {
      console.error("Failed to create game:", e);
    } finally {
      setLaunchingGame(false);
    }
  };

  // ─── Modals ───────────────────────────────────────────────
  const handleBlock = async () => {
    if (!otherUser) return;
    setBlockLoading(true);
    try { await blockUser(otherUser.uid); setShowBlockModal(false); router.back(); }
    catch (e) { console.error(e); }
    finally { setBlockLoading(false); }
  };

  const handleReport = async (reason: ReportReason, desc?: string) => {
    if (!otherUser) return;
    setReportLoading(true);
    try { await reportUser({ reportedId: otherUser.uid, reason, description: desc }); setShowReportModal(false); }
    catch (e) { console.error(e); }
    finally { setReportLoading(false); }
  };

  // ─── Helpers ──────────────────────────────────────────────
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const isMyMessage = (msg: Message) => msg.senderId === auth.currentUser?.uid;
  const sideColor = schoolColor(otherUser?.side || "ucla");
  const accent = accentColor(mySide);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const mine = isMyMessage(item);
    const prev = index > 0 ? messages[index - 1] : null;
    const showTimestamp =
      !prev || !prev.createdAt || !item.createdAt ||
      (item.createdAt?.seconds || 0) - (prev.createdAt?.seconds || 0) > 300;

    return (
      <View>
        {showTimestamp && item.createdAt && (
          <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
        )}
        <View style={[
          styles.messageBubble,
          mine ? styles.myBubble : styles.theirBubble,
          mine ? { backgroundColor: accent } : { backgroundColor: BG_SURFACE },
        ]}>
          <Text style={[styles.messageText, mine ? { color: "#fff" } : { color: TEXT_PRIMARY }]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={18} color="#fff" />
        </Pressable>

        <Pressable style={styles.headerProfile}>
          {otherUser?.photo ? (
            <Image source={{ uri: otherUser.photo }} style={styles.headerPhoto} />
          ) : (
            <View style={[styles.headerPhoto, styles.headerPhotoPlaceholder]}>
              <FontAwesome name="user" size={14} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{otherUser?.name || "..."}</Text>
            {otherUser && (
              <Text style={[styles.headerSide, { color: sideColor }]}>
                {otherUser.side.toUpperCase()}
              </Text>
            )}
          </View>
        </Pressable>

        {/* ── Rematch button ── */}
        {activeGameId ? (
          // Active game in progress — show "Resume" 
          <Pressable
            style={[styles.rematchBtn, { backgroundColor: accentBg(mySide, 0.2), borderColor: `${accent}66` }]}
            onPress={launchActiveGame}
          >
            <Text style={[styles.rematchBtnText, { color: accent }]}>
              {activeGameType === "cup_pong" ? "🏓" : "🔤"} Resume
            </Text>
          </Pressable>
        ) : (
          // No active game — offer rematch
          <Pressable
            style={[styles.rematchBtn, { backgroundColor: accent }]}
            onPress={() => setShowGamePicker(true)}
            disabled={launchingGame}
          >
            {launchingGame ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.rematchBtnText, { color: "#fff" }]}>⚔ Rematch</Text>
            )}
          </Pressable>
        )}

        <Pressable style={styles.moreButton} onPress={() => setShowOptions(true)}>
          <FontAwesome name="ellipsis-v" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      {/* ── Messages ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatEmoji}>🔥</Text>
              <Text style={styles.emptyChatTitle}>You matched with {otherUser?.name}!</Text>
              <Text style={styles.emptyChatSubtitle}>Say something to your rival</Text>
            </View>
          }
        />
      )}

      {/* ── Input ── */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Message your rival..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendButton, { backgroundColor: accent }, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <FontAwesome name="send" size={16} color="#fff" />
          )}
        </Pressable>
      </View>

      {/* ── Game Picker Modal ── */}
      <Modal
        visible={showGamePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGamePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGamePicker(false)}>
          <Pressable style={styles.gamePickerSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Challenge to a rematch</Text>
            <Text style={styles.sheetSubtitle}>
              {otherUser?.name} will be notified to play
            </Text>

            <Pressable
              style={[styles.gameOption, { borderColor: `${accent}55` }]}
              onPress={() => launchRematch("cup_pong")}
            >
              <Text style={styles.gameOptionEmoji}>🏓</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.gameOptionTitle}>Cup Pong</Text>
                <Text style={styles.gameOptionDesc}>Sink all 6 cups to win</Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={TEXT_SECONDARY} />
            </Pressable>

            <Pressable
              style={[styles.gameOption, { borderColor: `${accent}55` }]}
              onPress={() => launchRematch("word_hunt")}
            >
              <Text style={styles.gameOptionEmoji}>🔤</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.gameOptionTitle}>Word Hunt</Text>
                <Text style={styles.gameOptionDesc}>Find the most words in 90 seconds</Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={TEXT_SECONDARY} />
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={() => setShowGamePicker(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Other Modals ── */}
      <MoreOptionsMenu
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        onBlock={() => setShowBlockModal(true)}
        onReport={() => setShowReportModal(true)}
      />
      <BlockModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onBlock={handleBlock}
        userName={otherUser?.name || ""}
        loading={blockLoading}
      />
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        userName={otherUser?.name || ""}
        loading={reportLoading}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const createStyles = (_s: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PRIMARY },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  headerProfile: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerPhoto: { width: 36, height: 36, borderRadius: 18, backgroundColor: BG_SURFACE },
  headerPhotoPlaceholder: { justifyContent: "center", alignItems: "center" },
  headerName: { fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY },
  headerSide: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  rematchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  rematchBtnText: { fontSize: 13, fontWeight: "700" },
  moreButton: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  messagesList: { padding: 16, flexGrow: 1, justifyContent: "flex-end" },
  timestamp: { fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginVertical: 12 },
  messageBubble: { maxWidth: "78%", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginBottom: 4 },
  myBubble: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  theirBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  messageText: { fontSize: 16, lineHeight: 22 },
  emptyChat: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  emptyChatEmoji: { fontSize: 48, marginBottom: 16 },
  emptyChatTitle: { fontSize: 20, fontWeight: "700", color: TEXT_PRIMARY, marginBottom: 6 },
  emptyChatSubtitle: { fontSize: 14, color: TEXT_SECONDARY },
  inputContainer: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", gap: 10,
  },
  textInput: {
    flex: 1, backgroundColor: BG_SURFACE, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 12,
    fontSize: 16, color: TEXT_PRIMARY, maxHeight: 100,
  },
  sendButton: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  sendButtonDisabled: { opacity: 0.4 },
  // Game picker modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  gamePickerSheet: {
    backgroundColor: BG_SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center", marginBottom: 8,
  },
  sheetTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: "700" },
  sheetSubtitle: { color: TEXT_SECONDARY, fontSize: 14, marginTop: -4 },
  gameOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: BG_PRIMARY, borderRadius: 14, borderWidth: 1.5, padding: 16,
  },
  gameOptionEmoji: { fontSize: 28 },
  gameOptionTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: "700" },
  gameOptionDesc: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: TEXT_SECONDARY, fontSize: 15 },
});
