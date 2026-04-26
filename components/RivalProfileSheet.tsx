// components/RivalProfileSheet.tsx
// Bottom sheet that slides up when a rival row is tapped.
// Exposes an imperative handle so the parent can trigger an animated close
// (used by the block-from-sheet flow so the sheet slides out, not snaps shut).
import { FontAwesome } from "@expo/vector-icons";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  accentColor,
  BG_SURFACE,
  schoolColor,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../utils/colors";
import { RivalCard } from "./RivalRow";

const { height: SH } = Dimensions.get("window");
const SHEET_HEIGHT = SH * 0.88;

/**
 * Build the player-stats line shown under major/year on the sheet.
 * Surfaces three pieces of competitive context (weekly wins, all-time
 * rank, win-loss record) — all already computed by the onGameUpdated
 * and recomputeRanks Cloud Functions. Hides clauses that don't apply
 * (no rank if outside top 100, no weekly clause if zero wins this week).
 */
function buildStatsLine(p: RivalCard): string {
  const games = p.gamesPlayed ?? 0;
  if (games === 0) return "🏆 New player · No games yet";

  const parts: string[] = [];
  const weekly = p.weeklyWins ?? 0;
  if (weekly > 0) {
    parts.push(`${weekly} ${weekly === 1 ? "win" : "wins"} this week`);
  }
  if (p.currentRank) {
    parts.push(`#${p.currentRank} all-time`);
  }
  const wins = p.wins ?? 0;
  const losses = Math.max(0, games - wins);
  parts.push(`${wins}-${losses} record`);

  return `🏆 ${parts.join(" · ")}`;
}

export interface RivalProfileSheetHandle {
  // Runs the slide-down animation, then calls onClose.
  animateClose: (then?: () => void) => void;
}

interface Props {
  visible: boolean;
  profile: RivalCard | null;
  userSide: string;
  challengeDisabled: boolean;
  onChallenge: () => void;
  onSkip: () => void;
  onClose: () => void;
  onOpenMoreOptions: () => void;
}

export const RivalProfileSheet = forwardRef<RivalProfileSheetHandle, Props>(
  function RivalProfileSheet(
    {
      visible,
      profile,
      userSide,
      challengeDisabled,
      onChallenge,
      onSkip,
      onClose,
      onOpenMoreOptions,
    },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const [photoIndex, setPhotoIndex] = useState(0);
    const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const challengeScale = useRef(new Animated.Value(1)).current;
    const isMounted = useRef(true);
    const isClosing = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    // Reset photo index + closing flag when a new profile loads
    useEffect(() => {
      if (profile?.uid) {
        setPhotoIndex(0);
        isClosing.current = false;
      }
    }, [profile?.uid]);

    // Slide in when visible flips true
    useEffect(() => {
      if (visible) {
        isClosing.current = false;
        slideAnim.setValue(SHEET_HEIGHT);
        backdropOpacity.setValue(0);
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [visible, slideAnim, backdropOpacity]);

    // Internal animated close — used by tap handlers and by the imperative handle.
    const animateCloseInternal = useCallback(
      (after: () => void) => {
        if (isClosing.current) return;
        isClosing.current = true;
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: SHEET_HEIGHT,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (isMounted.current) after();
        });
      },
      [slideAnim, backdropOpacity]
    );

    // Expose imperative close to the parent (for block flow)
    useImperativeHandle(
      ref,
      () => ({
        animateClose: (then?: () => void) => {
          animateCloseInternal(() => {
            if (then) then();
          });
        },
      }),
      [animateCloseInternal]
    );

    const handleBackdropPress = () => {
      animateCloseInternal(onClose);
    };

    // Drag-down gesture — only active on the drag handle area
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) slideAnim.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 100 || g.vy > 0.5) {
            animateCloseInternal(onClose);
          } else {
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 80,
              friction: 10,
            }).start();
          }
        },
      })
    ).current;

    if (!profile) return null;

    const userColor = accentColor(userSide);
    const rivalColor = schoolColor(profile.side);
    const rivalName = profile.side === "usc" ? "USC" : "UCLA";
    const yearLabel =
      !profile.gradYear
        ? ""
        : profile.gradYear === "Graduate"
        ? "Graduate"
        : `Class of ${profile.gradYear}`;
    const metaParts = [profile.major, yearLabel].filter(Boolean);

    const mainPhoto = profile.photos[photoIndex] || null;

    const handleChallengeTap = () => {
      if (challengeDisabled || isClosing.current) return;
      Animated.sequence([
        Animated.timing(challengeScale, {
          toValue: 0.96,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(challengeScale, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();
      animateCloseInternal(onChallenge);
    };

    const handleSkipTap = () => {
      if (isClosing.current) return;
      animateCloseInternal(onSkip);
    };

    const handlePhotoTap = (side: "left" | "right") => {
      if (side === "right" && photoIndex < profile.photos.length - 1) {
        setPhotoIndex(photoIndex + 1);
      } else if (side === "left" && photoIndex > 0) {
        setPhotoIndex(photoIndex - 1);
      }
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleBackdropPress}
        statusBarTranslucent
      >
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}
          >
            <Pressable style={styles.backdrop} onPress={handleBackdropPress} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{ translateY: slideAnim }],
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <View {...panResponder.panHandlers} style={styles.dragArea}>
              <View style={styles.handle} />
            </View>

            <View style={styles.photoArea}>
              {mainPhoto ? (
                <Image source={{ uri: mainPhoto }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]} />
              )}
              <Pressable
                style={styles.photoTapLeft}
                onPress={() => handlePhotoTap("left")}
              />
              <Pressable
                style={styles.photoTapRight}
                onPress={() => handlePhotoTap("right")}
              />
              {profile.photos.length > 1 && (
                <View style={styles.indicators}>
                  {profile.photos.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.indicator,
                        i === photoIndex && styles.indicatorActive,
                      ]}
                    />
                  ))}
                </View>
              )}
              <Pressable style={styles.moreButton} onPress={onOpenMoreOptions}>
                <FontAwesome name="ellipsis-h" size={18} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile.name}</Text>
                <View style={[styles.badge, { backgroundColor: rivalColor }]}>
                  <Text style={styles.badgeText}>{rivalName}</Text>
                </View>
              </View>
              {metaParts.length > 0 && (
                <Text style={styles.meta}>{metaParts.join(" · ")}</Text>
              )}
              <Text
                style={[styles.statsRow, { color: rivalColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {buildStatsLine(profile)}
              </Text>
            </View>

            <View style={styles.actions}>
              <Animated.View style={{ transform: [{ scale: challengeScale }] }}>
                <Pressable
                  onPress={handleChallengeTap}
                  disabled={challengeDisabled}
                  style={[
                    styles.challengeBtn,
                    { backgroundColor: userColor },
                    challengeDisabled && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.challengeText}>
                    {challengeDisabled ? "Daily limit reached" : "⚔  Challenge"}
                  </Text>
                </Pressable>
              </Animated.View>

              <Pressable
                onPress={handleSkipTap}
                hitSlop={12}
                style={styles.skipBtn}
              >
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: BG_SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  dragArea: {
    paddingVertical: 10,
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.45)",
  },
  photoArea: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#334155",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    backgroundColor: "#334155",
  },
  photoTapLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "40%",
    height: "100%",
  },
  photoTapRight: {
    position: "absolute",
    right: 0,
    top: 0,
    width: "40%",
    height: "100%",
  },
  indicators: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 4,
  },
  indicator: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
  },
  indicatorActive: {
    backgroundColor: "#fff",
  },
  moreButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  name: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  meta: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: "500",
  },
  statsRow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginTop: 4,
  },
  actions: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  challengeBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  challengeText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  skipBtn: {
    alignSelf: "center",
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_SECONDARY,
    opacity: 0.8,
  },
});
