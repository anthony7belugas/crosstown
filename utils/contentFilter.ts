// utils/contentFilter.ts
// Client-side word blocklist — ported from Besties
// Runs before writing to Firestore — zero latency
import { Alert } from "react-native";

const BANNED_WORDS = [
  'nigger', 'niggers', 'n1gger', 'n1ggers', 'nigga',
  'faggot', 'faggots', 'f4ggot',
  'retard', 'kike', 'spic', 'chink', 'wetback',
  'kill yourself', 'kys', 'go die',
];

export function passesContentFilter(text: string): boolean {
  if (!text || !text.trim()) return true;
  const textLower = text.toLowerCase();
  return !BANNED_WORDS.some(word => textLower.includes(word));
}

export function checkContentFilter(text: string): boolean {
  if (passesContentFilter(text)) return true;
  Alert.alert("Content Not Allowed", "Your message contains prohibited language. Please revise.");
  return false;
}
