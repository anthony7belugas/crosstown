// app/(tabs)/_layout.tsx
// Tab bar: Duels | Rivals (badge) | Scoreboard | Profile
import { FontAwesome } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import {
  collection, doc, getDoc, onSnapshot, query, where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { auth, db } from "../../firebaseConfig";
import { accentColor, TEXT_SECONDARY, BG_PRIMARY } from "../../utils/colors";

export default function TabsLayout() {
  const [side, setSide] = useState<string>("usc");
  const [incomingCount, setIncomingCount] = useState(0);

  useEffect(() => {
    const loadSide = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (snap.exists()) setSide(snap.data().side || "usc");
      } catch {}
    };
    loadSide();
  }, []);

  // Real-time listener for incoming challenge count (badge on Rivals tab)
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const q = query(
      collection(db, "challenges"),
      where("toUserId", "==", uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      setIncomingCount(snap.size);
    });

    return () => unsub();
  }, []);

  const accent = accentColor(side);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: TEXT_SECONDARY,
        tabBarStyle: {
          backgroundColor: BG_PRIMARY,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.08)",
          paddingTop: 5,
          ...Platform.select({
            ios: { height: 85 },
            android: { height: 60, paddingBottom: 10 },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 5,
        },
      }}
    >
      <Tabs.Screen
        name="duels"
        options={{
          title: "Duels",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="bolt" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="rivals"
        options={{
          title: "Rivals",
          tabBarIcon: ({ color, size }) => (
            <View>
              <FontAwesome name="comment" size={size} color={color} />
              {incomingCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -10,
                    backgroundColor: "#EF4444",
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                    borderWidth: 2,
                    borderColor: BG_PRIMARY,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                    {incomingCount > 9 ? "9+" : incomingCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="scoreboard"
        options={{
          title: "Scoreboard",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="trophy" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="user" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
