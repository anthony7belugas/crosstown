// app/legal/guidelines.tsx
//
// Community Guidelines — plain-English rules of the rivalry.
//
// Surfaced in two places:
//   1. Settings → Privacy & Safety → Community Guidelines
//   2. Linked from terms.tsx and privacy.tsx
//
// Designed to read in under 30 seconds. The screen App Review can screenshot
// to verify the app makes its rules clear to users in plain language.

import { FontAwesome } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BG_PRIMARY,
  BG_SURFACE,
  NEUTRAL_ACCENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../../utils/colors";

const SUPPORT_EMAIL = "support@allmybesties.com";

const GuidelinesScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Guidelines</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* ─── HERO ─── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>⚔</Text>
          <Text style={styles.heroTitle}>The Rules of the Rivalry</Text>
          <Text style={styles.heroSubtitle}>
            CrossTown is the USC vs UCLA rivalry app. Talk smack. Compete hard. Keep it fun.
          </Text>
        </View>

        {/* ─── WHAT'S WELCOME ─── */}
        <Text style={styles.sectionTitle}>What's Welcome</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowEmoji}>🔥</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Trash talk and competitive banter.</Text> School rivalries have always involved talking smack. That's the spirit of the app.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmoji}>🏆</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Showing up for your school.</Text> Win for your side. Climb the leaderboard. Defend the scoreboard.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmoji}>😏</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Wit, jokes, and roasts about the other school.</Text> The Rose Bowl. Your football team. Your basketball team. Your dining halls. Fair game.
            </Text>
          </View>
        </View>

        {/* ─── WHAT'S NOT ─── */}
        <Text style={styles.sectionTitle}>What Crosses the Line</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowEmojiRed}>✕</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Hate speech, slurs, or content targeting people because of race, religion, gender, sexual orientation, ethnicity, or disability.</Text> Zero tolerance. Permanent ban.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmojiRed}>✕</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Threats of violence or harm.</Text> Toward anyone, for any reason. Reported to law enforcement when warranted.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmojiRed}>✕</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Harassment, stalking, or sustained targeting of a specific person.</Text> One sharp comeback is rivalry. Twenty messages telling someone to log off is harassment.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmojiRed}>✕</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Sexual or explicit content.</Text> Including nude, suggestive, or sexually graphic photos and messages.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmojiRed}>✕</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Sharing someone's private information.</Text> Phone numbers, addresses, schedules, family details — without their consent.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmojiRed}>✕</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Impersonating other people.</Text> Use your real name. Use your own photos.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmojiRed}>✕</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Self-harm or suicide content directed at another user.</Text> Telling someone to hurt themselves is grounds for permanent ban.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowEmojiRed}>✕</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowBold}>Spam, scams, or commercial solicitation.</Text> CrossTown is not for selling products, services, or content.
            </Text>
          </View>
        </View>

        {/* ─── THE LINE ─── */}
        <Text style={styles.sectionTitle}>The Line</Text>
        <View style={styles.lineCard}>
          <Text style={styles.lineText}>
            <Text style={styles.lineBold}>Punch up at schools, not down at people.</Text>
            {"\n\n"}
            "USC's defense couldn't stop a Pop Warner team last Saturday." — fair game.
            {"\n\n"}
            "[name] is ugly and should kill themselves." — banned, immediately, forever.
            {"\n\n"}
            If you're not sure where a message lands, ask yourself: would your mom laugh, or would she be embarrassed for you? Send the one she'd laugh at.
          </Text>
        </View>

        {/* ─── HOW WE ENFORCE ─── */}
        <Text style={styles.sectionTitle}>How We Enforce</Text>
        <View style={styles.card}>
          <View style={styles.enforceRow}>
            <View style={styles.enforceNumber}>
              <Text style={styles.enforceNumberText}>1</Text>
            </View>
            <View style={styles.enforceTextWrap}>
              <Text style={styles.enforceTitle}>Block</Text>
              <Text style={styles.enforceBody}>
                Tap the three-dot menu on any rival's profile. Block instantly. They can't see you. You can't see them. Fully reversible from Settings → Blocked Users.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.enforceRow}>
            <View style={styles.enforceNumber}>
              <Text style={styles.enforceNumberText}>2</Text>
            </View>
            <View style={styles.enforceTextWrap}>
              <Text style={styles.enforceTitle}>Report</Text>
              <Text style={styles.enforceBody}>
                Same three-dot menu. Pick a reason: harassment, inappropriate content, fake profile, or other. We review every report within 24 hours.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.enforceRow}>
            <View style={styles.enforceNumber}>
              <Text style={styles.enforceNumberText}>3</Text>
            </View>
            <View style={styles.enforceTextWrap}>
              <Text style={styles.enforceTitle}>Auto-filter</Text>
              <Text style={styles.enforceBody}>
                Slurs and threats are blocked from being sent in the first place — before they ever reach the other person.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.enforceRow}>
            <View style={styles.enforceNumber}>
              <Text style={styles.enforceNumberText}>4</Text>
            </View>
            <View style={styles.enforceTextWrap}>
              <Text style={styles.enforceTitle}>Bans</Text>
              <Text style={styles.enforceBody}>
                Reports for hate speech, threats, sexual content, or targeted harassment result in immediate permanent ban with no appeal. Other violations may result in warnings or temporary suspensions.
              </Text>
            </View>
          </View>
        </View>

        {/* ─── EMERGENCY ─── */}
        <View style={styles.emergencyCard}>
          <Text style={styles.emergencyTitle}>If You're in Danger</Text>
          <Text style={styles.emergencyBody}>
            If someone threatens you or you're in immediate danger, contact local law enforcement (911 in the US) before contacting us. Then report through the app and email{" "}
            <Text
              style={styles.emergencyLink}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Safety%20Concern`)}
            >
              {SUPPORT_EMAIL}
            </Text>{" "}
            so we can take action on the account.
          </Text>
        </View>

        {/* ─── FOOTER ─── */}
        <Text style={styles.footerText}>
          These guidelines apply alongside our Terms and Privacy Policy. Violating them violates the Terms.
        </Text>

        <View style={styles.linkContainer}>
          <Link href="/legal/terms" style={styles.link} replace>
            <Text style={styles.linkText}>Terms of Service</Text>
          </Link>
          <Text style={styles.linkSeparator}>·</Text>
          <Link href="/legal/privacy" style={styles.link} replace>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Link>
        </View>

        <Text style={styles.versionText}>Last updated: April 24, 2026</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: BG_PRIMARY,
    borderBottomWidth: 1,
    borderBottomColor: BG_SURFACE,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  // Hero
  heroCard: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 28,
    backgroundColor: BG_SURFACE,
    borderRadius: 16,
  },
  heroEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  // Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginTop: 20,
    marginBottom: 12,
  },

  // Cards
  card: {
    backgroundColor: BG_SURFACE,
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "flex-start",
  },
  rowEmoji: {
    fontSize: 18,
    marginRight: 12,
    marginTop: 1,
    width: 24,
  },
  rowEmojiRed: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
    width: 24,
    color: "#EF4444",
    fontWeight: "800",
  },
  rowText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 21,
    flex: 1,
  },
  rowBold: {
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 52,
  },

  // The Line
  lineCard: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderColor: "rgba(245,158,11,0.25)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
  },
  lineText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 22,
  },
  lineBold: {
    color: TEXT_PRIMARY,
    fontWeight: "700",
    fontSize: 15,
  },

  // Enforce
  enforceRow: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "flex-start",
  },
  enforceNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    marginTop: 1,
  },
  enforceNumberText: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  enforceTextWrap: {
    flex: 1,
  },
  enforceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  enforceBody: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 19,
  },

  // Emergency
  emergencyCard: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginTop: 24,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#EF4444",
    marginBottom: 8,
  },
  emergencyBody: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 21,
  },
  emergencyLink: {
    color: NEUTRAL_ACCENT,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // Footer
  footerText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginTop: 28,
    marginBottom: 16,
    lineHeight: 19,
    fontStyle: "italic",
  },
  linkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  link: {},
  linkText: {
    fontSize: 14,
    color: NEUTRAL_ACCENT,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  linkSeparator: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginHorizontal: 12,
  },
  versionText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
  },
});

export default GuidelinesScreen;
