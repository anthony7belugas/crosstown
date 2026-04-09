// app/(tabs)/profile.tsx
// Placeholder — profile + likes counter + settings to be built next session
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../firebaseConfig";

const GOLD = "#FFD100";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <FontAwesome name="user" size={40} color={GOLD} />
        </View>
        <Text style={styles.title}>{auth.currentUser?.email || "You"}</Text>
        <Text style={styles.subtitle}>Profile editing coming soon</Text>

        {/* Likes placeholder */}
        <View style={styles.likesCard}>
          <FontAwesome name="heart" size={20} color={GOLD} />
          <Text style={styles.likesText}>0 rivals liked you</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <FontAwesome name="sign-out" size={18} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, gap: 16 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,209,0,0.1)", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.4)" },
  likesCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,209,0,0.08)", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,209,0,0.15)", marginTop: 8 },
  likesText: { fontSize: 16, fontWeight: "600", color: GOLD },
  logoutButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 24, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 12, marginTop: 16 },
  logoutText: { fontSize: 16, fontWeight: "600", color: "#EF4444" },
});
