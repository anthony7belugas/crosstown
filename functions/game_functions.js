// functions/game_functions.js
// ADD THESE FUNCTIONS to your existing functions/index.js
// They handle: game win tracking, scoreboard increment, push notifications
// for "your turn", and weekly scoreboard reset.
//
// ─── HOW TO ADD ────────────────────────────────────────────────────────────
// 1. Paste all functions below at the bottom of functions/index.js
// 2. The imports you already have cover everything needed EXCEPT:
//    - Add `onDocumentUpdated` to your existing firebase-functions/v2/firestore import:
//      const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
// 3. Deploy: firebase deploy --only functions
// ───────────────────────────────────────────────────────────────────────────

// ============================================
// GAME COMPLETED → increment wins + scoreboard
// ============================================
// Fires when a game doc transitions to status: "complete"

exports.onGameComplete = onDocumentUpdated("games/{gameId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Only act on the transition to "complete"
  if (before.status === "complete" || after.status !== "complete") return;

  const winnerId = after.winner;
  if (!winnerId || winnerId === "draw") return;

  const winnerSide = after.sides?.[winnerId];
  if (!winnerSide) return;

  try {
    // 1. Increment winner's personal win count (powers the Scoreboard leaderboard)
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
        // First-ever game: initialize
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

    // 3. Send push to the loser: "rematch?" nudge
    const loserId = after.players?.find((p) => p !== winnerId);
    if (loserId) {
      const loserSnap = await db.collection("users").doc(loserId).get();
      const loserToken = loserSnap.exists ? loserSnap.data().expoPushToken : null;
      const winnerSnap = await db.collection("users").doc(winnerId).get();
      const winnerName = winnerSnap.exists
        ? winnerSnap.data().name?.split(" ")[0] || "Your rival"
        : "Your rival";

      const gameLabel = after.type === "cup_pong" ? "Cup Pong" : "Word Hunt";
      if (loserToken) {
        await sendPush(
          loserToken,
          `${winnerName} won ${gameLabel} 🏆`,
          "Rematch?",
          { matchId: after.matchId, type: "game_result" }
        );
      }
    }

    console.log(`Game ${event.params.gameId} complete. Winner: ${winnerId} (${winnerSide})`);
  } catch (err) {
    console.error("onGameComplete error:", err);
  }
});

// ============================================
// GAME TURN CHANGED → notify the next player
// ============================================
// Fires when currentTurn changes on a game doc (it's now someone's turn)

exports.onGameTurnChanged = onDocumentUpdated("games/{gameId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Only fire when currentTurn actually changed and game is still active
  if (before.currentTurn === after.currentTurn) return;
  if (after.status !== "active") return;

  const nextPlayerId = after.currentTurn;
  if (!nextPlayerId) return;

  try {
    const playerSnap = await db.collection("users").doc(nextPlayerId).get();
    if (!playerSnap.exists) return;
    const playerData = playerSnap.data();
    const token = playerData.expoPushToken;
    if (!token) return;

    // Get opponent name for the notification
    const opponentId = after.players?.find((p) => p !== nextPlayerId);
    let opponentName = "Your rival";
    if (opponentId) {
      const opSnap = await db.collection("users").doc(opponentId).get();
      if (opSnap.exists) opponentName = opSnap.data().name?.split(" ")[0] || "Your rival";
    }

    const gameLabel = after.type === "cup_pong" ? "Cup Pong" : "Word Hunt";
    await sendPush(
      token,
      `${opponentName} played their turn ⚔`,
      `It's your turn in ${gameLabel}`,
      {
        gameId: event.params.gameId,
        gameType: after.type,
        matchId: after.matchId,
        type: "your_turn",
      }
    );
  } catch (err) {
    console.error("onGameTurnChanged error:", err);
  }
});

// ============================================
// WEEKLY SCOREBOARD RESET — every Monday midnight PT
// ============================================

exports.weeklyScoreboardReset = onSchedule(
  { schedule: "0 8 * * 1", timeZone: "America/Los_Angeles" }, // 8 UTC = midnight PT
  async () => {
    try {
      const talliesRef = db.collection("scoreboard").doc("tallies");
      const snap = await talliesRef.get();

      if (!snap.exists) return;

      const data = snap.data();
      const uscWeekly = data.usc_weekly || 0;
      const uclaWeekly = data.ucla_weekly || 0;

      // Archive the completed week before resetting
      await db.collection("scoreboard").doc(`week_${Date.now()}`).set({
        usc: uscWeekly,
        ucla: uclaWeekly,
        winner: uscWeekly > uclaWeekly ? "usc" : uclaWeekly > uscWeekly ? "ucla" : "draw",
        archivedAt: new Date(),
      });

      // Reset weekly counters
      await talliesRef.update({ usc_weekly: 0, ucla_weekly: 0 });

      console.log(`Weekly reset: USC ${uscWeekly} — UCLA ${uclaWeekly}`);

      // Broadcast push to ALL users announcing the winner (if not a draw)
      if (uscWeekly !== uclaWeekly) {
        const winner = uscWeekly > uclaWeekly ? "USC" : "UCLA";
        const loser = uscWeekly > uclaWeekly ? "UCLA" : "USC";
        const winnerCount = Math.max(uscWeekly, uclaWeekly);
        const loserCount = Math.min(uscWeekly, uclaWeekly);

        const usersSnap = await db.collection("users")
          .where("expoPushToken", "!=", null)
          .limit(500)
          .get();

        const messages = [];
        for (const userDoc of usersSnap.docs) {
          const token = userDoc.data().expoPushToken;
          if (!Expo.isExpoPushToken(token)) continue;
          const userSide = userDoc.data().side;
          const isWinner = userSide === winner.toLowerCase();
          messages.push({
            to: token,
            sound: "default",
            title: isWinner
              ? `${winner} wins the week 🏆`
              : `${winner} beat you this week`,
            body: `${winner} ${winnerCount} — ${loser} ${loserCount}. New week starts now.`,
            data: { type: "weekly_result" },
          });
        }

        // Send in batches (Expo limit)
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
// SCOREBOARD GAP ALERT — fire when a school closes to within 50 points
// ============================================
// Runs as part of onGameComplete (above). Extracted here for clarity.
// Called automatically when onGameComplete updates the tallies.

exports.checkScoreboardGapAlert = onDocumentUpdated(
  "scoreboard/tallies",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const uscBefore = before.usc_weekly || 0;
    const uclaaBefore = before.ucla_weekly || 0;
    const uscAfter = after.usc_weekly || 0;
    const uclaAfter = after.ucla_weekly || 0;

    const gapBefore = Math.abs(uscBefore - uclaaBefore);
    const gapAfter = Math.abs(uscAfter - uclaAfter);

    // Only fire if gap just crossed below 50
    if (gapBefore >= 50 && gapAfter < 50) {
      // Who's closing the gap?
      const leaderBefore = uscBefore > uclaaBefore ? "usc" : "ucla";
      const closingSchool = leaderBefore === "usc" ? "ucla" : "usc";
      const closingSchoolName = closingSchool === "usc" ? "USC" : "UCLA";
      const leaderName = closingSchool === "usc" ? "UCLA" : "USC";

      // Notify the leading school to defend
      const usersSnap = await db.collection("users")
        .where("side", "==", leaderBefore)
        .where("expoPushToken", "!=", null)
        .limit(500)
        .get();

      const messages = [];
      for (const userDoc of usersSnap.docs) {
        const token = userDoc.data().expoPushToken;
        if (!Expo.isExpoPushToken(token)) continue;
        messages.push({
          to: token,
          sound: "default",
          title: `${closingSchoolName} is closing the gap 🔥`,
          body: `Defend your lead — challenge a ${closingSchoolName} student now`,
          data: { type: "gap_alert", screen: "duels" },
        });
      }

      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk).catch(console.error);
      }

      console.log(`Gap alert fired: ${closingSchoolName} closing on ${leaderName}`);
    }
  }
);
