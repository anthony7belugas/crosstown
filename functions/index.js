// functions/index.js
//
// CROSSTOWN FIREBASE CLOUD FUNCTIONS V2
// - Push Notifications (new showdown, new message, new challenge, inactive nudge)
// - Content Moderation (banned word filter on bios + messages)
// - Daily cleanup (expired passes)
//
// To deploy:
// 1. cd functions
// 2. npm install
// 3. firebase deploy --only functions

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
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
// PUSH: New Showdown
// Triggers when a showdown document is created
// ============================================

exports.onNewShowdown = onDocumentCreated("showdowns/{showdownId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;

  const showdownData = snapshot.data();
  const users = showdownData.users; // [uid1, uid2]

  console.log("New showdown between:", users[0], "and", users[1]);

  try {
    // Notify both users
    for (const userId of users) {
      const otherUserId = users.find((id) => id !== userId);
      const pushToken = await getUserPushToken(userId);
      if (!pushToken) continue;

      // Check notification preferences
      const userDoc = await db.collection("users").doc(userId).get();
      const prefs = userDoc.data()?.notificationPrefs || {};
      if (prefs.showdowns === false) continue;

      await sendPush(
        pushToken,
        "⚔️ Game On!",
        "A rival accepted your challenge. Let's go!",
        { type: "showdown", showdownId: event.params.showdownId }
      );
    }
  } catch (error) {
    console.error("Error sending showdown push:", error);
  }

  return null;
});

// ============================================
// PUSH: New Message
// Triggers when a message is added to a showdown's messages subcollection
// ============================================

exports.onNewMessage = onDocumentCreated(
  "showdowns/{showdownId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return null;

    const message = snapshot.data();
    const showdownId = event.params.showdownId;
    const senderId = message.senderId;

    console.log("New message in showdown:", showdownId);

    try {
      // Get the showdown to find the recipient
      const showdownDoc = await db.collection("showdowns").doc(showdownId).get();
      if (!showdownDoc.exists) return null;

      const showdownData = showdownDoc.data();
      const recipientId = showdownData.users.find((id) => id !== senderId);
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
        { type: "message", showdownId }
      );
    } catch (error) {
      console.error("Error sending message push:", error);
    }

    return null;
  }
);

// ============================================
// PUSH: Someone Challenged You
// Triggers when a challenge document is created
// ============================================

exports.onNewChallenge = onDocumentCreated("challenges/{challengeId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;

  const challenge = snapshot.data();
  const toUserId = challenge.toUserId;
  const fromUserId = challenge.fromUserId;

  console.log("New challenge from", fromUserId, "to", toUserId);

  try {
    // Check if blocked
    if (await isUserBlocked(toUserId, fromUserId)) return null;

    // Check notification preferences
    const userDoc = await db.collection("users").doc(toUserId).get();
    const prefs = userDoc.data()?.notificationPrefs || {};
    if (prefs.challenges === false) return null;

    const pushToken = await getUserPushToken(toUserId);
    if (!pushToken) return null;

    // Don't reveal who — just say "someone"
    await sendPush(
      pushToken,
      "⚔️ New Challenger",
      "Someone from the other side just challenged you.",
      { type: "challenge" }
    );
  } catch (error) {
    console.error("Error sending challenge push:", error);
  }

  return null;
});

// ============================================
// CONTENT MODERATION: Check new messages
// ============================================

exports.moderateMessage = onDocumentCreated(
  "showdowns/{showdownId}/messages/{messageId}",
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

      // Find users who haven't played in 3+ days
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

        // Check last challenge date
        const lastChallengeDate = data.dailyChallengeDate;
        if (lastChallengeDate) {
          const lastChallenge = new Date(lastChallengeDate);
          if (lastChallenge > threeDaysAgo) continue; // Active recently
        }

        await sendPush(
          data.expoPushToken,
          "Your rivals are playing without you 👀",
          "The scoreboard is moving. Get back in the game.",
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
                <p style="color: #94A3B8; font-size: 14px; margin-top: 4px;">USC vs. UCLA</p>
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

// ============================================
// GAME UPDATED — handles completion + turn changes
// Single trigger on games/{gameId}
// ============================================

exports.onGameUpdated = onDocumentUpdated("games/{gameId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // ── CASE 1: Game just completed ──
  if (before.status !== "complete" && after.status === "complete") {
    const winnerId = after.winner;
    if (!winnerId || winnerId === "draw") return;

    const winnerSide = after.sides?.[winnerId];
    if (!winnerSide) return;

    try {
      // 1. Increment winner's personal win count
      const winnerRef = db.collection("users").doc(winnerId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(winnerRef);
        const current = snap.exists ? (snap.data().wins || 0) : 0;
        tx.update(winnerRef, { wins: current + 1 });
      });

      // 2. Increment school tally (all-time + weekly)
      const talliesRef = db.collection("scoreboard").doc("tallies");
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(talliesRef);
        if (!snap.exists) {
          tx.set(talliesRef, {
            usc_alltime: winnerSide === "usc" ? 1 : 0,
            ucla_alltime: winnerSide === "ucla" ? 1 : 0,
            usc_weekly: winnerSide === "usc" ? 1 : 0,
            ucla_weekly: winnerSide === "ucla" ? 1 : 0,
          });
        } else {
          const data = snap.data();
          const allKey = `${winnerSide}_alltime`;
          const weekKey = `${winnerSide}_weekly`;
          tx.update(talliesRef, {
            [allKey]: (data[allKey] || 0) + 1,
            [weekKey]: (data[weekKey] || 0) + 1,
          });
        }
      });

      // 3. Push to loser
      const loserId = after.players?.find((p) => p !== winnerId);
      if (loserId) {
        const loserToken = await getUserPushToken(loserId);
        const winnerSnap = await db.collection("users").doc(winnerId).get();
        const winnerName = winnerSnap.exists
          ? winnerSnap.data().name?.split(" ")[0] || "Your rival"
          : "Your rival";
        const gameLabel = after.type === "cup_pong" ? "Cup Pong" : "Word Hunt";
        if (loserToken) {
          await sendPush(loserToken, `${winnerName} won ${gameLabel} 🏆`, "Rematch?",
            { gameId: event.params.gameId, showdownId: after.showdownId, type: "game_result" });
        }
      }

      console.log(`Game ${event.params.gameId} complete. Winner: ${winnerId} (${winnerSide})`);
    } catch (err) {
      console.error("onGameUpdated (complete) error:", err);
    }
    return;
  }

  // ── CASE 2: Turn changed on active game ──
  if (before.currentTurn !== after.currentTurn && after.status === "active") {
    const nextPlayerId = after.currentTurn;
    if (!nextPlayerId) return;

    try {
      const token = await getUserPushToken(nextPlayerId);
      if (!token) return;

      const opponentId = after.players?.find((p) => p !== nextPlayerId);
      let opponentName = "Your rival";
      if (opponentId) {
        const opSnap = await db.collection("users").doc(opponentId).get();
        if (opSnap.exists) opponentName = opSnap.data().name?.split(" ")[0] || "Your rival";
      }

      const gameLabel = after.type === "cup_pong" ? "Cup Pong" : "Word Hunt";
      await sendPush(token, `${opponentName} played their turn ⚔`,
        `It's your turn in ${gameLabel}`,
        { gameId: event.params.gameId, gameType: after.type, showdownId: after.showdownId, type: "your_turn" });
    } catch (err) {
      console.error("onGameUpdated (turn) error:", err);
    }
  }
});

// ============================================
// WEEKLY SCOREBOARD RESET — Monday midnight PT
// ============================================

exports.weeklyScoreboardReset = onSchedule(
  { schedule: "every monday 00:00", timeZone: "America/Los_Angeles" },
  async () => {
    try {
      const talliesRef = db.collection("scoreboard").doc("tallies");
      const snap = await talliesRef.get();
      if (!snap.exists) return;

      const data = snap.data();
      const uscWeekly = data.usc_weekly || 0;
      const uclaWeekly = data.ucla_weekly || 0;

      // Archive
      await db.collection("scoreboard").doc(`week_${Date.now()}`).set({
        usc: uscWeekly, ucla: uclaWeekly,
        winner: uscWeekly > uclaWeekly ? "usc" : uclaWeekly > uscWeekly ? "ucla" : "draw",
        archivedAt: new Date(),
      });

      await talliesRef.update({ usc_weekly: 0, ucla_weekly: 0 });
      console.log(`Weekly reset: USC ${uscWeekly} — UCLA ${uclaWeekly}`);

      // Broadcast push
      if (uscWeekly !== uclaWeekly) {
        const winner = uscWeekly > uclaWeekly ? "USC" : "UCLA";
        const loser = uscWeekly > uclaWeekly ? "UCLA" : "USC";
        const winCount = Math.max(uscWeekly, uclaWeekly);
        const loseCount = Math.min(uscWeekly, uclaWeekly);

        const usersSnap = await db.collection("users")
          .where("expoPushToken", "!=", null).limit(500).get();
        const messages = [];
        for (const userDoc of usersSnap.docs) {
          const token = userDoc.data().expoPushToken;
          if (!Expo.isExpoPushToken(token)) continue;
          const userSide = userDoc.data().side;
          const isWinner = userSide === winner.toLowerCase();
          messages.push({
            to: token, sound: "default",
            title: isWinner ? `${winner} wins the week 🏆` : `${winner} beat you this week`,
            body: `${winner} ${winCount} — ${loser} ${loseCount}. New week starts now.`,
            data: { type: "weekly_result" },
          });
        }
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          await expo.sendPushNotificationsAsync(chunk).catch(console.error);
        }
      }
    } catch (err) {
      console.error("weeklyScoreboardReset error:", err);
    }
  }
);

// ============================================
// GAP ALERT — when a school closes within 50 pts
// ============================================

exports.onScoreboardGapAlert = onDocumentUpdated("scoreboard/tallies", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const gapBefore = Math.abs((before.usc_weekly || 0) - (before.ucla_weekly || 0));
  const gapAfter = Math.abs((after.usc_weekly || 0) - (after.ucla_weekly || 0));

  if (gapBefore >= 50 && gapAfter < 50) {
    const leaderBefore = (before.usc_weekly || 0) > (before.ucla_weekly || 0) ? "usc" : "ucla";
    const closingSchool = leaderBefore === "usc" ? "UCLA" : "USC";

    const usersSnap = await db.collection("users")
      .where("side", "==", leaderBefore)
      .where("expoPushToken", "!=", null).limit(500).get();
    const messages = [];
    for (const userDoc of usersSnap.docs) {
      const token = userDoc.data().expoPushToken;
      if (!Expo.isExpoPushToken(token)) continue;
      messages.push({
        to: token, sound: "default",
        title: `${closingSchool} is closing the gap 🔥`,
        body: `Defend your lead — challenge a ${closingSchool} student now`,
        data: { type: "gap_alert", screen: "duels" },
      });
    }
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk).catch(console.error);
    }
    console.log(`Gap alert: ${closingSchool} closing the gap`);
  }
});
