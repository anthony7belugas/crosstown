// app/(tabs)/chat.tsx
// Placeholder — matches + conversations list to be built next session
import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <FontAwesome name="comment" size={40} color="#FFD100" />
        </View>
        <Text style={styles.title}>No Matches Yet</Text>
        <Text style={styles.subtitle}>
          Start swiping to find your rival match!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,209,0,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 22 },
});
