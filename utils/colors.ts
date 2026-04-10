// utils/colors.ts
// CrossTown Color System — School-Color-as-Accent
// See CrossTown_Color_System_Spec for full rationale
//
// NO gold (#FFD100), NO amber (#F59E0B), NO arbitrary third accent.
// The user's school color IS the accent. The rivalry IS the color system.

// ─── Backgrounds ─────────────────────────────────────────────
export const BG_PRIMARY = "#0F172A";   // Near-black dark slate (the arena)
export const BG_SURFACE = "#1E293B";   // Slightly lighter for cards/surfaces

// ─── School Colors (shifted generic — NOT official hex codes) ──
export const USC_RED = "#DC2626";      // Generic warm red (official cardinal #990000/#9D2235 is prohibited)
export const UCLA_BLUE = "#2563EB";    // Generic electric blue (official true blue #2774AE/#2D68C4 is prohibited)

// ─── Text ────────────────────────────────────────────────────
export const TEXT_PRIMARY = "#E2E8F0";   // Off-white
export const TEXT_SECONDARY = "#94A3B8"; // Muted gray for subtitles, timestamps

// ─── Neutral Accent (pre-side-pick only) ─────────────────────
export const NEUTRAL_ACCENT = "#E2E8F0"; // White/off-white — used ONLY before user picks a side

// ─── Dynamic Color Helpers ───────────────────────────────────

/** Returns the user's school color */
export const schoolColor = (side: string): string =>
  side === "usc" ? USC_RED : UCLA_BLUE;

/** Returns the rival school's color */
export const rivalColor = (side: string): string =>
  side === "usc" ? UCLA_BLUE : USC_RED;

/** Alias for schoolColor — used for CTA buttons, progress bars, active tabs */
export const accentColor = (side: string): string =>
  schoolColor(side);

/** Returns rgba of the user's school color at a given opacity */
export const accentBg = (side: string, opacity: number): string => {
  const [r, g, b] = side === "usc" ? [220, 38, 38] : [37, 99, 235];
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/** Returns the rival's color at 0.50 opacity for badge glow effects */
export const rivalGlow = (side: string): string =>
  accentBg(side === "usc" ? "ucla" : "usc", 0.5);
