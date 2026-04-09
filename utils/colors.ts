// utils/colors.ts
// CrossTown shared color constants — centralized to prevent trademark violations
// See CrossTown_Design_Branding_Spec.docx for rationale

// School accents — shifted generic colors, NOT official school hex codes
export const USC_RED = "#DC2626";     // Generic warm red (official cardinal #9D2235 is prohibited)
export const UCLA_BLUE = "#2563EB";   // Generic medium blue (official true blue #2D68C4 is prohibited)

// Primary accent — warm amber replaces gold (#FFD100 is prohibited, shared by both schools)
export const ACCENT = "#F59E0B";

// Backgrounds
export const BG_PRIMARY = "#0F172A";  // Near-black main background
export const BG_SURFACE = "#1E293B";  // Slightly lighter for cards/surfaces

// Text
export const TEXT_PRIMARY = "#E2E8F0";   // Off-white
export const TEXT_SECONDARY = "#94A3B8"; // Muted gray for subtitles, timestamps

// Accent helpers (rgba equivalents for overlays/glows)
export const ACCENT_FAINT = "rgba(245, 158, 11, 0.08)";
export const ACCENT_SUBTLE = "rgba(245, 158, 11, 0.1)";
export const ACCENT_LIGHT = "rgba(245, 158, 11, 0.12)";
export const ACCENT_MEDIUM = "rgba(245, 158, 11, 0.15)";
export const ACCENT_GLOW = "rgba(245, 158, 11, 0.2)";
export const ACCENT_TRACK = "rgba(245, 158, 11, 0.3)";

// Helper to get school color by side
export const schoolColor = (side: "usc" | "ucla") => side === "usc" ? USC_RED : UCLA_BLUE;
