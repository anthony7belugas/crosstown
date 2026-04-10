// app/legal/privacy.tsx
import { FontAwesome } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BG_PRIMARY,
  BG_SURFACE,
  NEUTRAL_ACCENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../utils/colors';

const SUPPORT_EMAIL = "support@crosstownapp.com";
const APP_NAME = "CrossTown";
const COMPANY_NAME = "Besties, Inc.";

const PrivacyPolicyScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>Last Updated: April 10, 2026</Text>

        <Text style={styles.intro}>
          At {COMPANY_NAME}, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, share, and protect your personal information when you use the {APP_NAME} app ("Service").
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>

        <Text style={styles.subsectionTitle}>Information You Provide:</Text>
        <Text style={styles.text}>
          When you create an account and use {APP_NAME}, we collect:
        </Text>
        <Text style={styles.bulletText}>• Name and university email address (USC or UCLA)</Text>
        <Text style={styles.bulletText}>• Your school affiliation (USC or UCLA)</Text>
        <Text style={styles.bulletText}>• Date of birth (to verify you are 18 or older)</Text>
        <Text style={styles.bulletText}>• Photos you upload to your profile</Text>
        <Text style={styles.bulletText}>• Academic information (major, graduation year)</Text>
        <Text style={styles.bulletText}>• Gender identity and preferences</Text>
        <Text style={styles.bulletText}>• Messages sent through the app</Text>

        <Text style={styles.subsectionTitle}>Automatically Collected Information:</Text>
        <Text style={styles.bulletText}>• Device information (type, operating system)</Text>
        <Text style={styles.bulletText}>• Usage data (swipe activity, features used, interactions)</Text>
        <Text style={styles.bulletText}>• Log data (IP address, access times)</Text>
        <Text style={styles.bulletText}>• Push notification tokens (if enabled)</Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.text}>We use your information to:</Text>
        <Text style={styles.bulletText}>• Provide and operate the Service</Text>
        <Text style={styles.bulletText}>• Create and maintain your account</Text>
        <Text style={styles.bulletText}>• Show your profile to users from the rival school</Text>
        <Text style={styles.bulletText}>• Facilitate mutual matches and enable messaging</Text>
        <Text style={styles.bulletText}>• Enforce swipe limits and track match activity</Text>
        <Text style={styles.bulletText}>• Send push notifications about matches and messages</Text>
        <Text style={styles.bulletText}>• Send you service-related communications, including updates, surveys, and requests for feedback</Text>
        <Text style={styles.bulletText}>• Improve and personalize your experience</Text>
        <Text style={styles.bulletText}>• Prevent fraud, abuse, and safety issues</Text>
        <Text style={styles.bulletText}>• Enforce our Terms and Conditions</Text>
        <Text style={styles.bulletText}>• Comply with legal obligations</Text>

        <Text style={styles.sectionTitle}>3. Information Sharing</Text>

        <Text style={styles.subsectionTitle}>With Other Users:</Text>
        <Text style={styles.text}>
          Your profile information (name, photos, major, graduation year, school affiliation) is visible to verified users from the opposing school. You will only be shown to — and see — users from the rival university.
        </Text>
        <Text style={styles.text}>
          Direct messages are only visible to you and the person you matched with.
        </Text>

        <Text style={styles.subsectionTitle}>We Do Not Sell Your Data:</Text>
        <Text style={styles.text}>
          We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
        </Text>

        <Text style={styles.subsectionTitle}>We May Share Information With:</Text>
        <Text style={styles.bulletText}>• Service providers (Firebase/Google for hosting and authentication; Expo for push notifications)</Text>
        <Text style={styles.bulletText}>• Law enforcement when required by law or to protect safety</Text>
        <Text style={styles.bulletText}>• Other parties with your explicit consent</Text>

        <Text style={styles.sectionTitle}>4. School Verification & Email Data</Text>
        <Text style={styles.text}>
          We use your university email address exclusively to verify your school affiliation (USC or UCLA). Your email is not displayed to other users and is not used for marketing without your consent.
        </Text>
        <Text style={styles.text}>
          Email verification links expire after a limited time. Once verified, your email is stored securely and used only for account authentication and critical service communications.
        </Text>

        <Text style={styles.sectionTitle}>5. Push Notifications</Text>
        <Text style={styles.text}>
          If you enable push notifications, we collect your device's push token to send you alerts about new matches, messages, and app activity.
        </Text>
        <Text style={styles.text}>
          You can control notification preferences in your device settings or within the app at any time.
        </Text>

        <Text style={styles.sectionTitle}>6. Data Security</Text>
        <Text style={styles.text}>
          We implement reasonable security measures to protect your information, including encrypted data transmission (HTTPS/TLS), secure authentication, and access controls.
        </Text>
        <Text style={styles.text}>
          However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
        </Text>

        <Text style={styles.sectionTitle}>7. Data Retention & Account Deletion</Text>
        <Text style={styles.text}>
          We retain your information for as long as your account is active or as needed to provide the Service.
        </Text>

        <Text style={styles.subsectionTitle}>When You Delete Your Account:</Text>
        <Text style={styles.bulletText}>• Your profile is immediately hidden from all other users</Text>
        <Text style={styles.bulletText}>• Your photos are removed</Text>
        <Text style={styles.bulletText}>• Your match history and messages are hidden</Text>
        <Text style={styles.bulletText}>• Your push notification token is cleared</Text>
        <Text style={styles.bulletText}>• You are signed out and cannot log back in</Text>
        <Text style={styles.bulletText}>• This action is permanent and cannot be undone</Text>

        <Text style={styles.subsectionTitle}>Data We May Retain After Deletion:</Text>
        <Text style={styles.bulletText}>• Information required for legal compliance</Text>
        <Text style={styles.bulletText}>• Information needed to resolve disputes or enforce bans</Text>
        <Text style={styles.bulletText}>• Aggregated, anonymized analytics data</Text>

        <Text style={styles.sectionTitle}>8. Your Rights and Choices</Text>
        <Text style={styles.text}>You have the right to:</Text>
        <Text style={styles.bulletText}>• Access your personal information</Text>
        <Text style={styles.bulletText}>• Correct inaccurate information through profile settings</Text>
        <Text style={styles.bulletText}>• Delete your account (Settings → Delete Account)</Text>
        <Text style={styles.bulletText}>• Export your data (contact support)</Text>
        <Text style={styles.bulletText}>• Control push notification preferences</Text>
        <Text style={styles.bulletText}>• Block and report other users</Text>

        <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
        <Text style={styles.text}>
          {APP_NAME} is intended for users 18 years of age and older who are current USC or UCLA students. We do not knowingly collect personal information from anyone under 18. If you believe we have collected information from someone under 18, please contact us immediately.
        </Text>

        <Text style={styles.sectionTitle}>10. California Privacy Rights (CCPA)</Text>
        <Text style={styles.text}>
          If you are a California resident, you have additional rights including the right to know what personal information we collect, the right to delete personal information, and the right to non-discrimination for exercising your rights. We do not sell personal information.
        </Text>

        <Text style={styles.sectionTitle}>11. Third-Party Services</Text>
        <Text style={styles.text}>We use the following third-party services:</Text>
        <Text style={styles.bulletText}>• Firebase (Google) — hosting, authentication, database</Text>
        <Text style={styles.bulletText}>• Expo — push notification delivery</Text>
        <Text style={styles.text}>
          These services have their own privacy policies available at policies.google.com/privacy and expo.dev/privacy.
        </Text>

        <Text style={styles.sectionTitle}>12. University Affiliation Disclaimer</Text>
        <Text style={styles.text}>
          {APP_NAME} is an independent service by {COMPANY_NAME} and is not officially affiliated with, endorsed by, or sponsored by the University of Southern California or the University of California, Los Angeles. USC and UCLA trademarks are the property of their respective institutions.
        </Text>

        <Text style={styles.sectionTitle}>13. Changes to This Policy</Text>
        <Text style={styles.text}>
          We may update this Privacy Policy from time to time. We will notify you of significant changes by:
        </Text>
        <Text style={styles.bulletText}>• Updating the "Last Updated" date above</Text>
        <Text style={styles.bulletText}>• Posting a notice within the app</Text>
        <Text style={styles.bulletText}>• Emailing users (for material changes)</Text>
        <Text style={styles.text}>
          Your continued use of the Service after changes constitutes acceptance of the updated policy.
        </Text>

        <Text style={styles.sectionTitle}>14. International Users</Text>
        <Text style={styles.text}>
          Your information may be transferred to and stored on servers in the United States. By using {APP_NAME}, you consent to this transfer.
        </Text>

        <Text style={styles.sectionTitle}>15. Contact Us</Text>
        <Text style={styles.text}>
          If you have questions about this Privacy Policy, wish to exercise your privacy rights, or have concerns about how your data is handled, please contact us:
        </Text>
        <Text style={styles.bulletText}>• In the app: Settings → Help & Support</Text>
        <Text style={styles.bulletText}>• Email: {SUPPORT_EMAIL}</Text>

        <Text style={styles.acknowledgment}>
          By using {APP_NAME}, you acknowledge that you have read and understood this Privacy Policy.
        </Text>

        <Text style={styles.companyInfo}>© 2026 {COMPANY_NAME}. All rights reserved.</Text>

        <View style={styles.linkContainer}>
          <Link href="/legal/terms" style={styles.link} replace>
            <Text style={styles.linkText}>View Terms & Conditions</Text>
          </Link>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 16,
  },
  intro: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    marginBottom: 24,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: TEXT_PRIMARY,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    color: TEXT_SECONDARY,
  },
  text: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    marginBottom: 12,
    lineHeight: 22,
    paddingRight: 5,
  },
  bulletText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    marginBottom: 8,
    paddingLeft: 15,
    paddingRight: 10,
    lineHeight: 22,
  },
  acknowledgment: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    marginTop: 24,
    marginBottom: 10,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  companyInfo: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  linkContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  link: {},
  linkText: {
    fontSize: 16,
    color: NEUTRAL_ACCENT,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default PrivacyPolicyScreen;
