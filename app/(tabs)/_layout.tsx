// app/(tabs)/_layout.tsx
import { FontAwesome } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { auth, db } from "../../firebaseConfig";
import { accentColor, TEXT_SECONDARY, BG_PRIMARY } from "../../utils/colors";

export default function TabsLayout() {
  const [side, setSide] = useState<string>("usc");

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
      {/* Tab 1: Duels — browse rivals and send challenges (was swipe.tsx, rename to duels.tsx) */}
      <Tabs.Screen
        name="duels"
        options={{
          title: "Duels",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="bolt" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 2: Rivals — incoming challenges + active showdowns + chats */}
      <Tabs.Screen
        name="rivals"
        options={{
          title: "Rivals",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="comment" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 3: Scoreboard — live USC vs UCLA tally, weekly reset, top players */}
      <Tabs.Screen
        name="scoreboard"
        options={{
          title: "Scoreboard",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="trophy" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 4: Profile — edit profile, settings, logout */}
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
