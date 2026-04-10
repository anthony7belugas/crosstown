// app/chat/[matchId].tsx
// 1:1 chat between matched users — adapted from Besties DM chat
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc, collection, doc, getDoc, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlockModal } from "../../components/BlockModal";
import { MoreOptionsMenu } from "../../components/MoreOptionsMenu";
import { ReportModal } from "../../components/ReportModal";
import { auth, db } from "../../firebaseConfig";
import { blockUser, reportUser, ReportReason } from "../../utils/blockUtils";
import { containsBannedWords } from "../../utils/contentFilter";
import { accentColor, schoolColor } from "../../utils/colors";


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

  // Load match info + other user profile
  const styles = createStyles(mySide);

  useEffect(() => {
    if (!matchId || !auth.currentUser) return;

    // Load current user side
    getDoc(doc(db, "users", auth.currentUser.uid)).then(meSnap => {
      if (meSnap.exists()) setMySide(meSnap.data().side || "usc");
    }).catch(() => {});

    const loadMatchInfo = async () => {
      try {
        const matchDoc = await getDoc(doc(db, "matches", matchId));
        if (!matchDoc.exists()) {
          setLoading(false);
          return;
        }

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

  // Real-time messages listener
  useEffect(() => {
    if (!matchId) return;

    const messagesQuery = query(
      collection(db, "matches", matchId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[];
      setMessages(msgs);
      setLoading(false);

      // Scroll to bottom on new messages
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsub();
  }, [matchId]);

  const handleSend = async () => {
    if (!inputText.trim() || !matchId || !auth.currentUser || sending) return;

    const text = inputText.trim();

    // Content filter
    if (containsBannedWords(text)) {
      setInputText("");
      return;
    }

    setSending(true);
    setInputText("");

    try {
      // Add message to subcollection
      await addDoc(collection(db, "matches", matchId, "messages"), {
        senderId: auth.currentUser.uid,
        text,
        createdAt: serverTimestamp(),
      });

      // Update match doc with last message
      await updateDoc(doc(db, "matches", matchId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setInputText(text); // Restore text on failure
    } finally {
      setSending(false);
    }
  };

  const handleBlock = async () => {
    if (!otherUser) return;
    setBlockLoading(true);
    try {
      await blockUser(otherUser.uid);
      setShowBlockModal(false);
      router.back();
    } catch (e) {
      console.error(e);
    } finally {
      setBlockLoading(false);
    }
  };

  const handleReport = async (reason: ReportReason, desc?: string) => {
    if (!otherUser) return;
    setReportLoading(true);
    try {
      await reportUser({ reportedId: otherUser.uid, reason, description: desc });
      setShowReportModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setReportLoading(false);
    }
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isMyMessage = (msg: Message) =>
    msg.senderId === auth.currentUser?.uid;

  const sideColor = schoolColor(otherUser?.side || "ucla");

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const mine = isMyMessage(item);
    const prev = index > 0 ? messages[index - 1] : null;
    const showTimestamp =
      !prev ||
      !prev.createdAt ||
      !item.createdAt ||
      (item.createdAt?.seconds || 0) - (prev.createdAt?.seconds || 0) > 300;

    return (
      <View>
        {showTimestamp && item.createdAt && (
          <Text style={styles.timestamp}>{formatMessageTime(item.createdAt)}</Text>
        )}
        <View
          style={[
            styles.messageBubble,
            mine ? styles.myBubble : styles.theirBubble,
            mine
              ? { backgroundColor: accentColor(_s) }
              : { backgroundColor: "#1E293B" },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              mine ? { color: "#1E293B" } : { color: "#fff" },
            ]}
          >
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
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

        <Pressable
          style={styles.moreButton}
          onPress={() => setShowOptions(true)}
        >
          <FontAwesome name="ellipsis-v" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor(_s)} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatEmoji}>🔥</Text>
              <Text style={styles.emptyChatTitle}>
                You matched with {otherUser?.name}!
              </Text>
              <Text style={styles.emptyChatSubtitle}>
                Say something to your rival
              </Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View
        style={[
          styles.inputContainer,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Message your rival..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <Pressable
          style={[
            styles.sendButton,
            (!inputText.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#1E293B" />
          ) : (
            <FontAwesome name="send" size={16} color="#1E293B" />
          )}
        </Pressable>
      </View>

      {/* Modals */}
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

const createStyles = (_s: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerProfile: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerPhoto: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1E293B" },
  headerPhotoPlaceholder: { justifyContent: "center", alignItems: "center" },
  headerName: { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerSide: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  messagesList: { padding: 16, flexGrow: 1, justifyContent: "flex-end" },
  timestamp: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
    marginVertical: 12,
  },
  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 4,
  },
  myBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
  },
  messageText: { fontSize: 16, lineHeight: 22 },
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyChatEmoji: { fontSize: 48, marginBottom: 16 },
  emptyChatTitle: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 6 },
  emptyChatSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    color: "#fff",
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: accentColor(_s),
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { opacity: 0.4 },
});
