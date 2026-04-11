// app/game/_layout.tsx
// No header — game screens are full-screen immersive
import { Stack } from "expo-router";

export default function GameLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
  );
}
