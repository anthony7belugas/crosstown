// utils/pushNotifications.ts
// Push notification registration — ported from Besties with OTA-safe token refresh
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { auth, db } from "../firebaseConfig";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Get the Expo project ID — checks multiple sources for compatibility
 */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * FORCE refresh push token — call this on EVERY app launch.
 * Handles OTA updates, token rotation, and stale tokens.
 * Ported from Besties' proven implementation.
 */
export async function refreshPushToken(): Promise<string | null> {
  console.log("[Push] Starting token refresh...");

  if (!Device.isDevice) {
    console.log("[Push] Not a physical device, skipping");
    return null;
  }

  if (!auth.currentUser) {
    console.log("[Push] No user logged in, skipping");
    return null;
  }

  // Check permissions — don't request, just check
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    console.log("[Push] Permissions not granted, skipping");
    return null;
  }

  try {
    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const newToken = tokenData.data;
    console.log("[Push] Got token:", newToken.substring(0, 30) + "...");

    // Get stored token from Firestore
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    const userData = userDoc.data();
    const storedToken = userData?.expoPushToken;
    const storedAppVersion = userData?.pushTokenAppVersion;

    // Get current app version
    const currentAppVersion = Application.nativeApplicationVersion || "1.0.0";
    const currentBuildVersion = Application.nativeBuildVersion || "1";
    const fullVersion = `${currentAppVersion}-${currentBuildVersion}`;

    // Force update if:
    // 1. Token is different (rotated by Expo)
    // 2. App version changed (OTA or store update)
    // 3. Token is older than 7 days
    const tokenAge = userData?.pushTokenUpdatedAt?.toDate?.();
    const isTokenOld = tokenAge
      ? Date.now() - tokenAge.getTime() > 7 * 24 * 60 * 60 * 1000
      : true;
    const versionChanged = storedAppVersion !== fullVersion;
    const tokenChanged = storedToken !== newToken;

    if (tokenChanged || versionChanged || isTokenOld) {
      console.log("[Push] Updating token. Reasons:", {
        tokenChanged,
        versionChanged: versionChanged
          ? `${storedAppVersion} -> ${fullVersion}`
          : false,
        isTokenOld,
      });

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          expoPushToken: newToken,
          pushTokenUpdatedAt: new Date(),
          pushTokenAppVersion: fullVersion,
          pushTokenPlatform: Platform.OS,
          pushTokenDeviceModel: Device.modelName,
        },
        { merge: true }
      );
      console.log("[Push] Token updated in Firestore");
    } else {
      console.log("[Push] Token unchanged, no update needed");
    }

    return newToken;
  } catch (error) {
    console.error("[Push] Error refreshing token:", error);
    return null;
  }
}

/**
 * Register for push notifications and save token to Firestore.
 * Call this during onboarding or when user enables notifications.
 * Triggers the system permission dialog if not already granted.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[Push] Push notifications require a physical device");
    return null;
  }

  try {
    // Check/request permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Permission not granted");
      return null;
    }

    // Get the Expo push token
    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log("[Push] Initial token:", token);

    // Setup Android notification channels
    if (Platform.OS === "android") {
      await setupAndroidChannels();
    }

    // Save token to Firestore
    if (auth.currentUser) {
      await savePushToken(token);
    }

    return token;
  } catch (error) {
    console.error("[Push] Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Setup Android notification channels — separate channels for
 * challenges and messages so users can control each independently.
 */
async function setupAndroidChannels() {
  await Notifications.setNotificationChannelAsync("default", {
    name: "CrossTown",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#E2E8F0",
  });

  await Notifications.setNotificationChannelAsync("challenges", {
    name: "Challenges",
    description: "Incoming challenges, game turns, and results",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#DC2626",
  });

  await Notifications.setNotificationChannelAsync("messages", {
    name: "Messages",
    description: "Chat messages from your rivals",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250],
    lightColor: "#2563EB",
  });

  await Notifications.setNotificationChannelAsync("scoreboard", {
    name: "Scoreboard",
    description: "School rivalry scoreboard updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: "#E2E8F0",
  });
}

/**
 * Save push token to Firestore with version and device metadata.
 */
async function savePushToken(token: string): Promise<void> {
  if (!auth.currentUser) return;

  try {
    const currentAppVersion = Application.nativeApplicationVersion || "1.0.0";
    const currentBuildVersion = Application.nativeBuildVersion || "1";

    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        expoPushToken: token,
        pushTokenUpdatedAt: new Date(),
        pushTokenAppVersion: `${currentAppVersion}-${currentBuildVersion}`,
        pushTokenPlatform: Platform.OS,
        pushTokenDeviceModel: Device.modelName,
      },
      { merge: true }
    );
    console.log("[Push] Token saved to Firestore");
  } catch (error) {
    console.error("[Push] Error saving push token:", error);
  }
}

/**
 * Remove push token from Firestore — call this on logout.
 */
export async function removePushToken(): Promise<void> {
  if (!auth.currentUser) return;

  try {
    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        expoPushToken: null,
        pushTokenUpdatedAt: null,
      },
      { merge: true }
    );
    console.log("[Push] Token removed");
  } catch (error) {
    console.error("[Push] Error removing push token:", error);
  }
}

/**
 * Add a listener for received notifications (app in foreground).
 * Returns a subscription to clean up.
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for notification responses (user tapped notification).
 * Returns a subscription to clean up.
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Clear all notifications and reset badge count.
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}
