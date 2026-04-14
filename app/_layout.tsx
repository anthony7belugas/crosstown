// app/_layout.tsx
// Root layout with auth state routing, OTA update check,
// push notification handling, and branded loading screen
import { Stack, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { auth, db } from "../firebaseConfig";
import { refreshPushToken, removePushToken } from "../utils/pushNotifications";

// ─── Colors (inline to avoid circular deps in root layout) ───
const BG_PRIMARY = "#0F172A";
const USC_RED = "#DC2626";
const UCLA_BLUE = "#2563EB";
const NEUTRAL_ACCENT = "#E2E8F0";

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const router = useRouter();

  // Notification listener refs
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Loading screen animations
  const spinAnim = useRef(new Animated.Value(0)).current;
  const vsGlow = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  // ════════════════════════════════════════════
  //  OTA UPDATE CHECK — Silent auto-restart
  //  Ported from Besties — checks on every launch
  // ════════════════════════════════════════════
  useEffect(() => {
    async function checkForOTAUpdate() {
      // Only check in production builds, not during development
      if (__DEV__) {
        return;
      }

      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          // Silent restart — user won't notice (takes 1-2 seconds)
          await Updates.reloadAsync();
        }
      } catch (error) {
        // Silently fail — don't disrupt user experience
        console.log("[OTA] Update check failed:", error);
      }
    }

    checkForOTAUpdate();
  }, []);

  // Mark layout as ready
  useEffect(() => {
    setIsLayoutReady(true);
  }, []);

  // Start loading animations
  useEffect(() => {
    // Fade in
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Spinner rotation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // VS glow pulse (matches welcome screen)
    Animated.loop(
      Animated.sequence([
        Animated.timing(vsGlow, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(vsGlow, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
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
   */
  const handleNotificationNavigation = (data: any) => {
    if (!data || !data.type) {
      router.push("/(tabs)/rivals" as any);
      return;
    }

    try {
      switch (data.type) {
        case "challenge_received":
          router.push("/(tabs)/rivals" as any);
          break;

        case "challenge_accepted":
          if (data.showdownId) {
            router.push(`/chat/${data.showdownId}` as any);
          } else {
            router.push("/(tabs)/rivals" as any);
          }
          break;

        case "game_turn":
          if (data.gameId && data.gameType === "cup_pong") {
            router.push(`/game/cup-pong/${data.gameId}` as any);
          } else if (data.gameId && data.gameType === "word_hunt") {
            router.push(`/game/word-hunt/${data.gameId}` as any);
          } else {
            router.push("/(tabs)/rivals" as any);
          }
          break;

        case "game_result":
          if (data.gameId) {
            router.push(`/game/result/${data.gameId}` as any);
          } else {
            router.push("/(tabs)/rivals" as any);
          }
          break;

        case "message":
          if (data.showdownId) {
            router.push(`/chat/${data.showdownId}` as any);
          } else {
            router.push("/(tabs)/rivals" as any);
          }
          break;

        case "scoreboard":
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
      refreshPushToken().catch((e) =>
        console.error("[Push] Token refresh failed:", e)
      );
    }
  }, [user]);

  // ────────────────────────────────────────────
  //  Auth routing — run once per app launch
  // ────────────────────────────────────────────
  useEffect(() => {
    if (user === undefined) return;
    if (hasNavigated) return;
    if (!isLayoutReady) return;

    const handleNavigation = async () => {
      if (!user) {
        setHasNavigated(true);
        router.replace("/");
        return;
      }

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

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;

        if (userData?.accountStatus === "deleted" || userData?.isSuspended) {
          await removePushToken();
          await auth.signOut();
          setHasNavigated(true);
          router.replace("/");
          return;
        }

        if (userData?.profileCompleted === true) {
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
          // Smart resume — check which onboarding step to send them to
          const email = user.email || "";
          const side = email.endsWith("@usc.edu") ? "usc" : "ucla";
          setHasNavigated(true);

          if (!userData || !userData.name) {
            // No name yet — start of onboarding
            router.replace({
              pathname: "/onboarding/name",
              params: { side },
            });
          } else if (!userData.photos || userData.photos.length === 0) {
            // Has name but no photos
            router.replace({
              pathname: "/onboarding/photos",
              params: { side },
            });
          } else {
            // Has name and photos but profile not completed — needs major/year
            router.replace({
              pathname: "/onboarding/profileInfo",
              params: { side },
            });
          }
        }
      } catch (error) {
        console.error("Error checking profile:", error);
        setHasNavigated(true);
        router.replace("/(tabs)/duels");
      }
    };

    handleNavigation();
  }, [user, hasNavigated, isLayoutReady]);

  // Reset on logout
  useEffect(() => {
    if (user === null) {
      setHasNavigated(false);
    }
  }, [user]);

  // ════════════════════════════════════════════
  //  LOADING SCREEN — CrossTown branded
  //  Matches the welcome screen: dark arena,
  //  red/blue split, pulsing VS, spinning loader
  // ════════════════════════════════════════════
  if (user === undefined) {
    const spin = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    const vsScale = vsGlow.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.08],
    });

    const vsOpacity = vsGlow.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
    });

    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={loadingStyles.container}>
          {/* Red/blue split background — matches welcome screen */}
          <View style={loadingStyles.splitBackground}>
            <View
              style={[loadingStyles.splitHalf, { backgroundColor: USC_RED }]}
            />
            <View
              style={[loadingStyles.splitHalf, { backgroundColor: UCLA_BLUE }]}
            />
          </View>

          {/* Dark overlay */}
          <View style={loadingStyles.overlay} />

          {/* Diagonal line — matches welcome screen */}
          <View style={loadingStyles.diagonalContainer}>
            <View style={loadingStyles.diagonal} />
          </View>

          {/* Content */}
          <Animated.View
            style={[loadingStyles.content, { opacity: fadeIn }]}
          >
            {/* Pulsing VS — same animation as welcome screen */}
            <Animated.View
              style={[
                loadingStyles.vsContainer,
                { transform: [{ scale: vsScale }] },
              ]}
            >
              <Animated.Text
                style={[loadingStyles.vsText, { opacity: vsOpacity }]}
              >
                VS
              </Animated.Text>
            </Animated.View>

            {/* Brand name */}
            <Text style={loadingStyles.title}>CrossTown</Text>

            {/* Spinning loader ring */}
            <Animated.View
              style={[
                loadingStyles.spinner,
                { transform: [{ rotate: spin }] },
              ]}
            >
              <View style={loadingStyles.spinnerArc} />
            </Animated.View>
          </Animated.View>
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

// ════════════════════════════════════════════
//  Loading screen styles — mirrors index.tsx
// ════════════════════════════════════════════
const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
  },
  splitBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  splitHalf: {
    flex: 1,
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  diagonalContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  diagonal: {
    width: 2,
    height: "120%",
    backgroundColor: "rgba(226, 232, 240, 0.15)",
    transform: [{ rotate: "15deg" }],
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  vsContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(226, 232, 240, 0.12)",
    borderWidth: 2,
    borderColor: NEUTRAL_ACCENT,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  vsText: {
    fontSize: 28,
    fontWeight: "900",
    color: NEUTRAL_ACCENT,
    letterSpacing: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 32,
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(226, 232, 240, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  spinnerArc: {
    position: "absolute",
    top: -3,
    left: -3,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: NEUTRAL_ACCENT,
  },
});
