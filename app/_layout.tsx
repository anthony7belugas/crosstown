// app/_layout.tsx
// Root layout with auth state routing, push notification handling,
// and token refresh on every launch — adapted from Besties
import { Stack, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { auth, db } from "../firebaseConfig";
import { refreshPushToken, removePushToken } from "../utils/pushNotifications";

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const router = useRouter();

  // Notification listener refs
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

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

  // ────────────────────────────────────────────
  //  Push notification listeners
  // ────────────────────────────────────────────
  useEffect(() => {
    // Foreground notification received
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log(
          "[Push] Notification received:",
          notification.request.content.title
        );
      });

    // User tapped a notification — route them to the right screen
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (isLayoutReady) {
          handleNotificationNavigation(data);
        }
      });

    return () => {
      if (notificationListener.current)
        notificationListener.current.remove();
      if (responseListener.current)
        responseListener.current.remove();
    };
  }, [isLayoutReady]);

  /**
   * Route to the correct screen when user taps a push notification.
   * Notification data.type determines the destination.
   */
  const handleNotificationNavigation = (data: any) => {
    if (!data || !data.type) {
      // Default: go to Rivals tab where incoming challenges live
      router.push("/(tabs)/rivals" as any);
      return;
    }

    try {
      switch (data.type) {
        case "challenge_received":
          // Someone challenged the user — go to Rivals tab (incoming challenges)
          router.push("/(tabs)/rivals" as any);
          break;

        case "challenge_accepted":
          // Rival accepted — go to the game or chat
          if (data.showdownId) {
            router.push(`/chat/${data.showdownId}` as any);
          } else {
            router.push("/(tabs)/rivals" as any);
          }
          break;

        case "game_turn":
          // It's your turn to play — go to the game
          if (data.gameId && data.gameType === "cup_pong") {
            router.push(`/game/cup-pong/${data.gameId}` as any);
          } else if (data.gameId && data.gameType === "word_hunt") {
            router.push(`/game/word-hunt/${data.gameId}` as any);
          } else {
            router.push("/(tabs)/rivals" as any);
          }
          break;

        case "game_result":
          // Game finished — show result
          if (data.gameId) {
            router.push(`/game/result/${data.gameId}` as any);
          } else {
            router.push("/(tabs)/rivals" as any);
          }
          break;

        case "message":
          // New chat message — go to the chat
          if (data.showdownId) {
            router.push(`/chat/${data.showdownId}` as any);
          } else {
            router.push("/(tabs)/rivals" as any);
          }
          break;

        case "scoreboard":
          // Scoreboard update (e.g. "UCLA is closing the gap!")
          router.push("/(tabs)/scoreboard" as any);
          break;

        default:
          router.push("/(tabs)/rivals" as any);
      }
    } catch (error) {
      console.error("[Push] Error navigating from notification:", error);
      router.push("/(tabs)/rivals" as any);
    }
  };

  // ────────────────────────────────────────────
  //  Token refresh on every authenticated launch
  // ────────────────────────────────────────────
  useEffect(() => {
    if (user && user.emailVerified) {
      // Refresh push token on every app launch for this authenticated user.
      // Handles OTA updates, token rotation, stale tokens.
      refreshPushToken().catch((e) =>
        console.error("[Push] Token refresh failed:", e)
      );
    }
  }, [user]);

  // ────────────────────────────────────────────
  //  Auth routing — run once per app launch
  // ────────────────────────────────────────────
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

        // Check if account is deleted or suspended
        if (userData?.accountStatus === "deleted" || userData?.isSuspended) {
          await removePushToken();
          await auth.signOut();
          setHasNavigated(true);
          router.replace("/");
          return;
        }

        if (userData?.profileCompleted === true) {
          // Check notification prompt before routing to main app
          if (!userData.notificationPromptShown) {
            const { status } = await Notifications.getPermissionsAsync();
            const email = user.email || "";
            const side = email.endsWith("@usc.edu") ? "usc" : "ucla";
            if (status === "granted") {
              await updateDoc(doc(db, "users", user.uid), {
                notificationPromptShown: true,
              });
              setHasNavigated(true);
              router.replace("/(tabs)/duels");
            } else {
              setHasNavigated(true);
              router.replace({
                pathname: "/enableNotifications",
                params: { side },
              });
            }
          } else {
            setHasNavigated(true);
            router.replace("/(tabs)/duels");
          }
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
        router.replace("/(tabs)/duels");
      }
    };

    handleNavigation();
  }, [user, hasNavigated, isLayoutReady]);

  // ────────────────────────────────────────────
  //  Token cleanup + reset on logout
  // ────────────────────────────────────────────
  useEffect(() => {
    if (user === null) {
      setHasNavigated(false);
    }
  }, [user]);

  // Loading state
  if (user === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#0F172A",
          }}
        >
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
