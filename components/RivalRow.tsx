// components/RivalRow.tsx
// One row in the Duels list.
// Layout: [tappable body] [Challenge button] — SIBLINGS, not nested.
// Tap body → opens profile sheet. Tap button → fires challenge with confirmation.
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  accentBg,
  accentColor,
  schoolColor,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../utils/colors";

export interface RivalCard {
  uid: string;
  name: string;
  side: "usc" | "ucla";
  photos: string[];
  major: string;
  gradYear: string;
}

interface Props {
  profile: RivalCard;
  userSide: string;
  onChallenge: (profile: RivalCard) => void;
  onOpen: (profile: RivalCard) => void;
}

function RivalRowInner({ profile, userSide, onChallenge, onOpen }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const confirmedRef = useRef(false);

  const userColor = accentColor(userSide);
  const rivalColor = schoolColor(profile.side);
  const rivalName = profile.side === "usc" ? "USC" : "UCLA";

  // Only render "'27" if gradYear is non-empty and not "Graduate"
  const yearShort = !profile.gradYear
    ? ""
    : profile.gradYear === "Graduate"
    ? "Grad"
    : `'${profile.gradYear.slice(-2)}`;

  // Major + year line — handle missing either side gracefully
  const metaLine = [profile.major, yearShort].filter(Boolean).join(" · ");

  const mainPhoto = profile.photos[0] || null;

  const handleChallengePress = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    setConfirmed(true);

    // Brief "✓ Sent" pause, then slide out, then notify parent.
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 32,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onChallenge(profile);
      });
    }, 350);
  };

  const handleBodyPress = () => {
    // If the Challenge tap already fired, body tap should be inert.
    if (confirmedRef.current) return;
    onOpen(profile);
  };

  return (
    <Animated.View
      style={[styles.rowOuter, { opacity, transform: [{ translateX }] }]}
    >
      <View style={styles.row}>
        {/* Tappable body — contains thumb + info */}
        <Pressable
          onPress={handleBodyPress}
          disabled={confirmed}
          style={({ pressed }) => [
            styles.body,
            pressed && !confirmed && { backgroundColor: accentBg(userSide, 0.05) },
          ]}
        >
          {mainPhoto ? (
            <Image
              source={{ uri: mainPhoto }}
              style={[styles.thumb, { borderColor: rivalColor }]}
            />
          ) : (
            <View
              style={[
                styles.thumb,
                styles.thumbPlaceholder,
                { borderColor: rivalColor },
              ]}
            />
          )}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {profile.name}
              </Text>
              <View style={[styles.badge, { backgroundColor: rivalColor }]}>
                <Text style={styles.badgeText}>{rivalName}</Text>
              </View>
            </View>
            {metaLine.length > 0 && (
              <Text style={styles.meta} numberOfLines={1}>
                {metaLine}
              </Text>
            )}
          </View>
        </Pressable>

        {/* Challenge button — sibling, not nested inside the body Pressable */}
        <Pressable
          onPress={handleChallengePress}
          disabled={confirmed}
          hitSlop={8}
          style={({ pressed }) => [
            styles.challengeBtn,
            { backgroundColor: userColor },
            pressed && !confirmed && { opacity: 0.85 },
            confirmed && styles.challengeBtnConfirmed,
          ]}
        >
          <Text style={styles.challengeBtnText}>
            {confirmed ? "✓ Sent" : "⚔ Challenge"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Memoize so scrolling the FlatList doesn't re-render every row
export const RivalRow = React.memo(RivalRowInner);

const styles = StyleSheet.create({
  rowOuter: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 12,
    minHeight: 80,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: "#334155",
  },
  thumbPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  meta: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_SECONDARY,
  },
  challengeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  challengeBtnConfirmed: {
    opacity: 0.6,
  },
  challengeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
