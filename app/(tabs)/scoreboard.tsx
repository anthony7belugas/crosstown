// app/(tabs)/scoreboard.tsx
// Scoreboard tab — live USC vs UCLA tally, weekly leaderboard, top players
// TODO: Build out full Scoreboard tab
//   - All-time tally: USC X — UCLA Y, big color split bar
//   - This Week section with countdown to Monday reset
//   - Top Players leaderboard, USC in red, UCLA in blue, ranked by win count

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BG_PRIMARY, TEXT_SECONDARY } from "../../utils/colors";

export default function ScoreboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Scoreboard — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: TEXT_SECONDARY,
    fontSize: 16,
  },
});
