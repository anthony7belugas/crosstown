// functions/index.js
//
// CROSSTOWN FIREBASE CLOUD FUNCTIONS V2
// - Push Notifications (new match, new message, someone liked you, inactive nudge)
// - Content Moderation (banned word filter on bios + messages)
// - Daily cleanup (expired passes)
//
// To deploy:
// 1. cd functions
// 2. npm install
// 3. firebase deploy --only functions

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { Expo } = require("expo-server-sdk");

const resendApiKey = defineSecret("RESEND_API_KEY");

initializeApp();
const db = getFirestore();
const expo = new Expo();

// ============================================
// BANNED WORDS (same as client-side contentFilter)
// ============================================

const BANNED_WORDS = [
  "nigger","nigga","faggot","retard","kike","spic","chink","wetback",
  "kill yourself","kys","go die",
];

function containsBannedWords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((word) => lower.includes(word));
}

// ============================================
// PUSH NOTIFICATION HELPERS
// ============================================

async function sendPush(pushToken, title, body, data = {}) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.log("Invalid push token:", pushToken);
    return false;
  }

  const message = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data,
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    console.log("Push sent:", title);
    return true;
  } catch (error) {
    console.error("Push error:", error);
    return false;
  }
}

async function getUserPushToken(userId) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return null;
    const data = userDoc.data();
    return data.expoPushToken || null;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

async function isUserBlocked(userId, otherUserId) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return false;
    const data = userDoc.data();
    const blocked = data.blockedUsers || [];
    const blockedBy = data.blockedByUsers || [];
    return blocked.includes(otherUserId) || blockedBy.includes(otherUserId);
  } catch (error) {
    return false;
  }
}

// ============================================
// PUSH: New Match
// Triggers when a match document is created
// ============================================

exports.onNewMatch = onDocumentCreated("matches/{matchId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;

  const matchData = snapshot.data();
  const users = matchData.users; // [uid1, uid2]

  console.log("New match between:", users[0], "and", users[1]);

  try {
    // Notify both users
    for (const userId of users) {
      const otherUserId = users.find((id) => id !== userId);
      const pushToken = await getUserPushToken(userId);
      if (!pushToken) continue;

      // Check notification preferences
      const userDoc = await db.collection("users").doc(userId).get();
      const prefs = userDoc.data()?.notificationPrefs || {};
      if (prefs.matches === false) continue;

      await sendPush(
        pushToken,
        "🔥 It's a Match!",
        "A rival just matched with you. Go say hi!",
        { type: "match", matchId: event.params.matchId }
      );
    }
  } catch (error) {
    console.error("Error sending match push:", error);
  }

  return null;
});

// ============================================
// PUSH: New Message
// Triggers when a message is added to a match's messages subcollection
// ============================================

exports.onNewMessage = onDocumentCreated(
  "matches/{matchId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return null;

    const message = snapshot.data();
    const matchId = event.params.matchId;
    const senderId = message.senderId;

    console.log("New message in match:", matchId);

    try {
      // Get the match to find the recipient
      const matchDoc = await db.collection("matches").doc(matchId).get();
      if (!matchDoc.exists) return null;

      const matchData = matchDoc.data();
      const recipientId = matchData.users.find((id) => id !== senderId);
      if (!recipientId) return null;

      // Check if blocked
      if (await isUserBlocked(recipientId, senderId)) return null;

      // Check notification preferences
      const recipientDoc = await db.collection("users").doc(recipientId).get();
      const prefs = recipientDoc.data()?.notificationPrefs || {};
      if (prefs.messages === false) return null;

      const pushToken = await getUserPushToken(recipientId);
      if (!pushToken) return null;

      // Get sender name
      const senderDoc = await db.collection("users").doc(senderId).get();
      const senderName = senderDoc.data()?.name || "Someone";

      const preview =
        message.text?.length > 50
          ? message.text.substring(0, 47) + "..."
          : message.text || "";

      await sendPush(
        pushToken,
        `${senderName}`,
        preview,
        { type: "message", matchId }
      );
    } catch (error) {
      console.error("Error sending message push:", error);
    }

    return null;
  }
);

// ============================================
// PUSH: Someone Liked You
// Triggers when a like document is created
// ============================================

exports.onNewLike = onDocumentCreated("likes/{likeId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;

  const like = snapshot.data();
  const toUserId = like.toUserId;
  const fromUserId = like.fromUserId;

  console.log("New like from", fromUserId, "to", toUserId);

  try {
    // Check if blocked
    if (await isUserBlocked(toUserId, fromUserId)) return null;

    // Check notification preferences
    const userDoc = await db.collection("users").doc(toUserId).get();
    const prefs = userDoc.data()?.notificationPrefs || {};
    if (prefs.likes === false) return null;

    const pushToken = await getUserPushToken(toUserId);
    if (!pushToken) return null;

    // Don't reveal who — just say "someone"
    await sendPush(
      pushToken,
      "❤️ Someone liked you",
      "Someone from the other side liked you today.",
      { type: "like" }
    );
  } catch (error) {
    console.error("Error sending like push:", error);
  }

  return null;
});

// ============================================
// CONTENT MODERATION: Check new messages
// ============================================

exports.moderateMessage = onDocumentCreated(
  "matches/{matchId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return null;

    const message = snapshot.data();

    if (message.text && containsBannedWords(message.text)) {
      console.log("Banned content detected in message, flagging");

      await snapshot.ref.update({
        flagged: true,
        originalText: message.text,
        text: "[Message removed for violating community guidelines]",
      });
    }

    return null;
  }
);

// ============================================
// CONTENT MODERATION: Check profile bios
// ============================================

exports.moderateBio = onDocumentCreated("users/{userId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;

  const userData = snapshot.data();

  if (userData.bio && containsBannedWords(userData.bio)) {
    console.log("Banned content in bio for user:", event.params.userId);

    await snapshot.ref.update({
      bio: "",
      bioFlagged: true,
    });
  }

  return null;
});

// ============================================
// SCHEDULED: Inactive User Nudge (every day at 6pm PT)
// ============================================

exports.inactiveNudge = onSchedule(
  { schedule: "every day 18:00", timeZone: "America/Los_Angeles" },
  async (event) => {
    console.log("Running inactive user nudge...");

    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // Find users who haven't swiped in 3+ days
      const usersSnap = await db
        .collection("users")
        .where("profileCompleted", "==", true)
        .get();

      let nudgeCount = 0;

      for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        if (!data.expoPushToken) continue;

        // Check notification preferences
        const prefs = data.notificationPrefs || {};
        if (prefs.nudges === false) continue;

        // Check last swipe date
        const lastSwipeDate = data.dailySwipeDate;
        if (lastSwipeDate) {
          const lastSwipe = new Date(lastSwipeDate);
          if (lastSwipe > threeDaysAgo) continue; // Active recently
        }

        await sendPush(
          data.expoPushToken,
          "Your rivals are swiping 👀",
          "Are you? Open CrossTown and see who's waiting.",
          { type: "nudge" }
        );

        nudgeCount++;
      }

      console.log(`Sent ${nudgeCount} inactive nudges`);
    } catch (error) {
      console.error("Error in inactive nudge:", error);
    }
  }
);

// ============================================
// SCHEDULED: Daily Cleanup (every day at 4am PT)
// Clean up expired passes, old data
// ============================================

exports.dailyCleanup = onSchedule(
  { schedule: "every day 04:00", timeZone: "America/Los_Angeles" },
  async (event) => {
    console.log("Running daily cleanup...");

    try {
      // Delete passes older than 1 day (they're date-scoped anyway,
      // but this keeps the collection from growing forever)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toLocaleDateString("en-CA");

      const oldPasses = await db
        .collection("passes")
        .where("date", "<", twoDaysAgoStr)
        .limit(500)
        .get();

      const batch = db.batch();
      oldPasses.docs.forEach((doc) => batch.delete(doc.ref));
      if (oldPasses.size > 0) {
        await batch.commit();
        console.log(`Deleted ${oldPasses.size} old passes`);
      }
    } catch (error) {
      console.error("Error in daily cleanup:", error);
    }
  }
);

// ============================================
// EMAIL VERIFICATION VIA RESEND
// Bypasses Firebase SMTP — sends directly via Resend REST API
//
// To set the secret:
//   firebase functions:secrets:set RESEND_API_KEY
//   Then paste your Resend API key (re_...) when prompted
// ============================================

exports.sendVerificationEmail = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email;

    if (!email) {
      throw new HttpsError("failed-precondition", "No email associated with account");
    }

    // Rate limit: 1 email per 30 seconds per user
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const lastSent = userDoc.data().lastVerificationEmailSent;
      if (lastSent) {
        const secondsAgo = (Date.now() - lastSent.toMillis()) / 1000;
        if (secondsAgo < 30) {
          throw new HttpsError(
            "resource-exhausted",
            `Please wait ${Math.ceil(30 - secondsAgo)} seconds before resending.`
          );
        }
      }
    }

    try {
      // Generate verification link via Firebase Admin SDK
      const verificationLink = await getAuth().generateEmailVerificationLink(email, {
        url: "https://crosstown-4476c.firebaseapp.com",
      });

      // Send via Resend REST API
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey.value()}`,
        },
        body: JSON.stringify({
          from: "CrossTown <crosstown@allmybesties.com>",
          to: email,
          subject: "Verify your email for CrossTown",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background-color: #0F172A;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="font-size: 36px; margin: 0; letter-spacing: 2px;">
                  <span style="color: #DC2626;">CROSS</span><span style="color: #2563EB;">TOWN</span>
                </h1>
                <p style="color: #94A3B8; font-size: 14px; margin-top: 4px;">Date Your Rival</p>
              </div>
              <p style="color: #E2E8F0; font-size: 16px; line-height: 24px; text-align: center;">
                Welcome to CrossTown! Tap the button below to verify your student email.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}"
                   style="background-color: #FBBF24; color: #1E293B; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
                  Verify Email
                </a>
              </div>
              <!--  <p style="color: #64748B; font-size: 12px; text-align: center;">
              //   If the button doesn't work, copy and paste this link into your browser:<br/>
              //   <a href="${verificationLink}" style="color: #94A3B8; word-break: break-all;">${verificationLink}</a>
              // </p> -->
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Resend API error:", response.status, errorData);
        throw new HttpsError("internal", "Failed to send verification email");
      }

      const result = await response.json();
      console.log(`Verification sent to ${email} via Resend (ID: ${result.id})`);

      // Record timestamp for rate limiting
      await userRef.set({ lastVerificationEmailSent: new Date() }, { merge: true });

      return { success: true };

    } catch (error) {
      console.error("Verification email error:", error);
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to send verification email. Please try again.");
    }
  }
);
