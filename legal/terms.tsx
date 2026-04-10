// app/legal/terms.tsx
import { FontAwesome } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ACCENT,
  BG_PRIMARY,
  BG_SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../utils/colors';

const SUPPORT_EMAIL = "support@crosstownapp.com";
const APP_NAME = "CrossTown";
const COMPANY_NAME = "Besties, Inc.";

const TermsAndConditionsScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>Last Updated: April 10, 2026</Text>

        <Text style={styles.intro}>
          Terms and Conditions for the {APP_NAME} App — by {COMPANY_NAME}.{'\n'}
          "Date Your Rival."
        </Text>

        <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
        <Text style={styles.text}>
          By accessing or using the {APP_NAME} app ("Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you disagree with any part of these Terms, you may not access the Service.
        </Text>

        <Text style={styles.sectionTitle}>2. About {APP_NAME}</Text>
        <Text style={styles.text}>
          {APP_NAME} is a dating and social discovery platform that connects current students from USC and UCLA ("the Crosstown rivalry"). The Service allows you to:
        </Text>
        <Text style={styles.bulletText}>• Create a profile verified to your university email</Text>
        <Text style={styles.bulletText}>• Swipe on and match with students from the opposing school</Text>
        <Text style={styles.bulletText}>• Message mutual matches</Text>
        <Text style={styles.bulletText}>• Manage your dating profile and preferences</Text>

        <Text style={styles.sectionTitle}>3. Eligibility</Text>
        <Text style={styles.text}>
          To use {APP_NAME}, you must:
        </Text>
        <Text style={styles.bulletText}>• Be at least 18 years of age</Text>
        <Text style={styles.bulletText}>• Be a current student at USC (usc.edu email) or UCLA (ucla.edu email)</Text>
        <Text style={styles.bulletText}>• Provide accurate and truthful information when creating your account</Text>
        <Text style={styles.bulletText}>• Not be prohibited from using the Service under applicable law</Text>
        <Text style={styles.text}>
          By creating an account, you represent and warrant that you meet all of the above requirements.
        </Text>

        <Text style={styles.sectionTitle}>4. Account Security</Text>
        <Text style={styles.text}>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to immediately notify us of any unauthorized use. We are not liable for any loss arising from your failure to protect your account.
        </Text>
        <Text style={styles.text}>
          You may only create one account. Creating multiple accounts, fake accounts, or accounts using another person's email is prohibited and will result in immediate termination.
        </Text>

        <Text style={styles.sectionTitle}>5. User Conduct</Text>
        <Text style={styles.text}>
          You agree to use the Service in a lawful and respectful manner. The following behaviors are strictly prohibited:
        </Text>
        <Text style={styles.bulletText}>• Harassment, bullying, or threatening other users</Text>
        <Text style={styles.bulletText}>• Hate speech, discrimination, or content targeting any group</Text>
        <Text style={styles.bulletText}>• Sharing explicit, sexual, or inappropriate content</Text>
        <Text style={styles.bulletText}>• Impersonating another person or providing false information</Text>
        <Text style={styles.bulletText}>• Soliciting money or conducting unauthorized commercial activity</Text>
        <Text style={styles.bulletText}>• Sharing another person's personal information without consent</Text>
        <Text style={styles.bulletText}>• Spamming, flooding, or otherwise disrupting the Service</Text>
        <Text style={styles.bulletText}>• Using the Service for any illegal purpose</Text>
        <Text style={styles.bulletText}>• Creating multiple or fake accounts</Text>
        <Text style={styles.bulletText}>• Stalking or obsessively contacting other users</Text>
        <Text style={styles.bulletText}>• Attempting to circumvent swipe limits or other Service restrictions</Text>
        <Text style={styles.bulletText}>• Using bots, scripts, or automated tools to interact with the Service</Text>

        <Text style={styles.sectionTitle}>6. Content</Text>
        <Text style={styles.text}>
          You retain ownership of content you post ("User Content"), including photos, profile text, and messages. By posting content, you grant {COMPANY_NAME} a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and display your User Content solely for the purpose of operating and improving the Service.
        </Text>
        <Text style={styles.text}>
          We reserve the right to remove any User Content that violates these Terms, is reported by other users, or that we otherwise find objectionable at our sole discretion.
        </Text>

        <Text style={styles.sectionTitle}>7. Photo Requirements</Text>
        <Text style={styles.text}>
          Profile photos must clearly show your face and accurately represent you. The following are prohibited:
        </Text>
        <Text style={styles.bulletText}>• Photos of other people used as your profile picture</Text>
        <Text style={styles.bulletText}>• Explicit, nude, or sexually suggestive photos</Text>
        <Text style={styles.bulletText}>• Photos containing hate symbols or imagery</Text>
        <Text style={styles.bulletText}>• Photos of minors</Text>
        <Text style={styles.bulletText}>• Heavily filtered or AI-generated photos that do not represent your actual appearance</Text>
        <Text style={styles.text}>
          We reserve the right to remove any photos that violate these guidelines without notice.
        </Text>

        <Text style={styles.sectionTitle}>8. Swipe Limits</Text>
        <Text style={styles.text}>
          {APP_NAME} enforces daily swipe limits to promote thoughtful matching and prevent spam behavior. Swipe counts reset on a 24-hour cycle. Attempting to circumvent swipe limits through any means is a violation of these Terms and may result in account suspension.
        </Text>

        <Text style={styles.sectionTitle}>9. Matching & Messaging</Text>
        <Text style={styles.text}>
          Messaging is only available between mutually matched users (both users have swiped right on each other). You agree not to use messaging to harass, solicit, or spam other users. Matches may be unmatched at any time by either party, which will remove the conversation.
        </Text>

        <Text style={styles.sectionTitle}>10. Blocking and Reporting</Text>
        <Text style={styles.text}>
          If you encounter inappropriate behavior or content, you can:
        </Text>
        <Text style={styles.bulletText}>• Block a user to prevent them from seeing your profile or contacting you</Text>
        <Text style={styles.bulletText}>• Report users or content that violates these Terms</Text>
        <Text style={styles.bulletText}>• Contact support for serious safety concerns</Text>
        <Text style={styles.text}>
          {APP_NAME} has zero tolerance for objectionable content or abusive users. We review all reports and take action within 24 hours, including removing offending content and suspending or permanently banning accounts that violate these Terms.
        </Text>

        <Text style={styles.sectionTitle}>11. Content Moderation — Zero Tolerance Policy</Text>
        <Text style={styles.text}>
          The following content will result in immediate removal and permanent account termination with no appeal:
        </Text>
        <Text style={styles.bulletText}>• Content sexualizing minors (CSAM) — reported to NCMEC and law enforcement</Text>
        <Text style={styles.bulletText}>• Credible threats of violence against a specific person or group</Text>
        <Text style={styles.bulletText}>• Racial slurs, hate speech, or targeted harassment</Text>
        <Text style={styles.bulletText}>• Self-harm or suicide instructions directed at another user</Text>
        <Text style={styles.bulletText}>• Non-consensual sharing of intimate images</Text>
        <Text style={styles.bulletText}>• Explicit sexual content</Text>

        <Text style={styles.sectionTitle}>12. Safety and In-Person Meetings</Text>
        <Text style={styles.text}>
          {APP_NAME} connects you with real people. If you choose to meet a match in person, we strongly recommend:
        </Text>
        <Text style={styles.bulletText}>• Meeting in a public place, especially for the first time</Text>
        <Text style={styles.bulletText}>• Telling a friend where you're going and who you're meeting</Text>
        <Text style={styles.bulletText}>• Never sharing financial information, passwords, or home addresses early on</Text>
        <Text style={styles.bulletText}>• Trusting your instincts and leaving if you feel uncomfortable</Text>
        <Text style={styles.bulletText}>• Reporting any concerning offline behavior to us and, where appropriate, to law enforcement</Text>
        <Text style={styles.text}>
          You acknowledge that meeting people you've connected with online carries inherent risks, and you assume full responsibility for your interactions both online and offline.
        </Text>

        <Text style={styles.sectionTitle}>13. Push Notifications</Text>
        <Text style={styles.text}>
          If you enable push notifications, you may receive alerts about new matches, messages, and app activity. You can manage notification preferences in your device settings or within the app at any time.
        </Text>

        <Text style={styles.sectionTitle}>14. Intellectual Property</Text>
        <Text style={styles.text}>
          The Service and its original content, features, design, and functionality are owned by {COMPANY_NAME} and are protected by copyright, trademark, and other intellectual property laws. "CrossTown" and "Date Your Rival" are original marks of {COMPANY_NAME}.
        </Text>
        <Text style={styles.text}>
          You may not copy, reproduce, distribute, or create derivative works from any part of the Service without our express written permission.
        </Text>

        <Text style={styles.sectionTitle}>15. University Affiliation Disclaimer</Text>
        <Text style={styles.text}>
          {APP_NAME} is an independent product by {COMPANY_NAME} and is not officially affiliated with, endorsed by, or sponsored by the University of Southern California or the University of California, Los Angeles. USC and UCLA are used in a nominative, descriptive capacity only. USC and UCLA trademarks, logos, mascots, and official marks are the property of their respective universities.
        </Text>

        <Text style={styles.sectionTitle}>16. Disclaimer of Warranties</Text>
        <Text style={styles.text}>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
        </Text>
        <Text style={styles.text}>
          WE ARE NOT RESPONSIBLE FOR THE CONDUCT OF OTHER USERS, THE ACCURACY OF PROFILE INFORMATION, OR ANY OUTCOME OR RESULT THAT ARISES FROM YOUR USE OF THE SERVICE.
        </Text>

        <Text style={styles.sectionTitle}>17. Limitation of Liability</Text>
        <Text style={styles.text}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {COMPANY_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </Text>

        <Text style={styles.sectionTitle}>18. Account Termination</Text>
        <Text style={styles.text}>
          We may terminate or suspend your account immediately, without prior notice, if you violate these Terms or if we determine in our sole discretion that termination is appropriate to protect other users or the integrity of the Service. You may also delete your account at any time through Settings → Delete Account.
        </Text>
        <Text style={styles.text}>When your account is terminated or deleted:</Text>
        <Text style={styles.bulletText}>• Your profile is immediately hidden from all other users</Text>
        <Text style={styles.bulletText}>• Your photos are removed</Text>
        <Text style={styles.bulletText}>• Your matches and messages are hidden</Text>
        <Text style={styles.bulletText}>• This action is permanent and cannot be undone</Text>

        <Text style={styles.sectionTitle}>19. Changes to Terms</Text>
        <Text style={styles.text}>
          We reserve the right to modify these Terms at any time. We will notify users of material changes by:
        </Text>
        <Text style={styles.bulletText}>• Updating the "Last Updated" date above</Text>
        <Text style={styles.bulletText}>• Posting a notice within the app</Text>
        <Text style={styles.bulletText}>• Emailing users (for material changes)</Text>
        <Text style={styles.text}>
          Your continued use of the Service after changes constitutes acceptance of the updated Terms.
        </Text>

        <Text style={styles.sectionTitle}>20. Dispute Resolution</Text>
        <Text style={styles.text}>
          Any disputes arising from these Terms or the Service shall be resolved through binding arbitration in Los Angeles County, California. You waive your right to a jury trial and the right to participate in any class action lawsuit or class-wide arbitration.
        </Text>

        <Text style={styles.sectionTitle}>21. Governing Law</Text>
        <Text style={styles.text}>
          These Terms shall be governed by the laws of the State of California. Any legal action not subject to arbitration must be brought exclusively in the state or federal courts located in Los Angeles County, California.
        </Text>

        <Text style={styles.sectionTitle}>22. Severability</Text>
        <Text style={styles.text}>
          If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.
        </Text>

        <Text style={styles.sectionTitle}>23. Contact Information</Text>
        <Text style={styles.text}>
          If you have questions about these Terms, need to report a violation, or have a safety concern, please contact us:
        </Text>
        <Text style={styles.bulletText}>• In the app: Settings → Help & Support</Text>
        <Text style={styles.bulletText}>• Email: {SUPPORT_EMAIL}</Text>

        <Text style={styles.acknowledgment}>
          By creating an account, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions and our Privacy Policy.
        </Text>

        <Text style={styles.companyInfo}>© 2026 {COMPANY_NAME}. All rights reserved.</Text>

        <View style={styles.linkContainer}>
          <Link href="/legal/privacy" style={styles.link} replace>
            <Text style={styles.linkText}>View Privacy Policy</Text>
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
    fontWeight: '600',
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
    color: ACCENT,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default TermsAndConditionsScreen;
