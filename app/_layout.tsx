// app/_layout.tsx
// Root layout with auth state routing — adapted from Besties
import { Stack, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { auth, db } from "../firebaseConfig";

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const router = useRouter();

  // Mark layout as ready
  useEffect(() => {
    setIsLayoutReady(true);
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await firebaseUser.reload();
      }
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // Route based on auth state
  useEffect(() => {
    if (user === undefined) return; // Still loading
    if (hasNavigated) return;
    if (!isLayoutReady) return;

    const handleNavigation = async () => {
      // Not logged in → welcome screen
      if (!user) {
        setHasNavigated(true);
        router.replace("/");
        return;
      }

      // Logged in but email not verified → waiting screen
      if (!user.emailVerified) {
        setHasNavigated(true);
        // Determine their side from email domain
        const email = user.email || "";
        const side = email.endsWith("@usc.edu") ? "usc" : "ucla";
        router.replace({
          pathname: "/onboarding/waitingVerify",
          params: { side },
        });
        return;
      }

      // Logged in and verified → check if profile is completed
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;

        if (userData?.profileCompleted === true) {
          // Profile complete → main app
          setHasNavigated(true);
          router.replace("/(tabs)/swipe");
        } else {
          // Profile not complete → continue onboarding
          const email = user.email || "";
          const side = email.endsWith("@usc.edu") ? "usc" : "ucla";
          setHasNavigated(true);
          router.replace({
            pathname: "/onboarding/nameAndDob",
            params: { side },
          });
        }
      } catch (error) {
        console.error("Error checking profile:", error);
        setHasNavigated(true);
        router.replace("/(tabs)/swipe");
      }
    };

    handleNavigation();
  }, [user, hasNavigated, isLayoutReady]);

  // Reset navigation flag on logout
  useEffect(() => {
    if (user === null) {
      setHasNavigated(false);
    }
  }, [user]);

  // Loading state
  if (user === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" }}>
          <ActivityIndicator size="large" color="#E2E8F0" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </GestureHandlerRootView>
  );
}
