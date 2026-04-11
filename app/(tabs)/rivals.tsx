// app/(tabs)/rivals.tsx
// Rivals tab — incoming challenges + active showdowns + chats
// TODO: Build out full Rivals tab
//   - Incoming Challenges section (collapsible, badge count, show 3, "See all N →")
//   - Active Showdowns section (accepted challenges / open chats)
//   Reference: besties friends.tsx for the pending requests pattern

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BG_PRIMARY, TEXT_SECONDARY } from "../../utils/colors";

export default function RivalsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Rivals — coming soon</Text>
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
