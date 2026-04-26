// utils/gameUtils.ts
// CrossTown game engine — Cup Pong + Word Hunt
// Both games are turn-based and stored in Firestore under `games/{gameId}`

import {
  addDoc, collection, doc, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { isBonusWord, isValidWord } from "./wordList";

// ─── Types ───────────────────────────────────────────────────

export type GameType = "cup_pong" | "word_hunt";
export type Side = "usc" | "ucla";

export interface Game {
  id: string;
  showdownId: string;
  type: GameType;
  players: string[];               // [player0Uid, player1Uid]
  sides: Record<string, Side>;     // uid -> "usc" | "ucla"
  status: "active" | "complete";
  currentTurn: string;             // uid whose turn it is
  winner?: string;                 // uid of winner, or "draw"
  createdAt: any;
  // Cup Pong
  cups?: Record<string, boolean[]>; // uid -> [true=standing, false=sunk], 6 cups
  // Word Hunt
  board?: string[];                 // 16 uppercase letters (4x4 grid)
  scores?: Record<string, number>;  // uid -> score
  wordsFound?: Record<string, string[]>; // uid -> list of found words
  turnDone?: Record<string, boolean>;    // uid -> has played their round
}

// ─── Cup Pong Layout ────────────────────────────────────────
// Triangle: 3 at back, 2 in middle, 1 at front
// Indices:  0  1  2   (row 0 — back row, farthest from thrower)
//              3  4   (row 1 — middle)
//               5     (row 2 — front, closest to thrower)

export const CUPS_PER_SIDE = 6;
export const INITIAL_CUPS = (): boolean[] => [true, true, true, true, true, true];

// Row definitions for the triangle
const CUP_ROWS = [
  { count: 3, indices: [0, 1, 2] }, // back
  { count: 2, indices: [3, 4] },    // middle
  { count: 1, indices: [5] },       // front
];

/**
 * Get the normalized center of a cup (0-1 range).
 * flipped=true means the triangle points upward (opponent view — front cup at bottom).
 */
export const getCupPosition = (
  index: number,
  flipped: boolean
): { nx: number; ny: number } => {
  let row = -1, col = -1, rowCount = -1;
  for (const r of CUP_ROWS) {
    const colIdx = r.indices.indexOf(index);
    if (colIdx >= 0) {
      row = CUP_ROWS.indexOf(r);
      col = colIdx;
      rowCount = r.count;
      break;
    }
  }
  if (row < 0) return { nx: 0.5, ny: 0.5 };

  const totalRows = 3;
  // Horizontal: evenly space within the row, centered
  const nx = (col + 1) / (rowCount + 1);
  // Vertical: spread across 3 rows with padding
  const rowNorm = (row + 1) / (totalRows + 1);
  const ny = flipped ? (1 - rowNorm) : rowNorm;

  return { nx, ny };
};

/** Convert normalized position to pixel coordinates within a container. */
export const getCupCenter = (
  index: number,
  areaW: number,
  areaH: number,
  flipped: boolean
): { x: number; y: number } => {
  const { nx, ny } = getCupPosition(index, flipped);
  return { x: nx * areaW, y: ny * areaH };
};

// ─── Cup Pong Hit Detection (PURE AIM — no RNG) ─────────────

/** Radius for hit detection — generous but fair. */
export const CUP_HIT_RADIUS = 0.14; // normalized — generous for fun gameplay

/**
 * Check if a landing point hits any standing cup.
 * All coordinates in normalized 0-1 space.
 * Returns the cup index that was hit, or -1 for a miss.
 */
export const checkCupHit = (
  landingNx: number,
  landingNy: number,
  cups: boolean[],
  flipped: boolean
): number => {
  let closestIdx = -1;
  let closestDist = Infinity;

  for (let i = 0; i < CUPS_PER_SIDE; i++) {
    if (!cups[i]) continue; // already sunk
    const { nx, ny } = getCupPosition(i, flipped);
    const dx = landingNx - nx;
    const dy = landingNy - ny;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < CUP_HIT_RADIUS && dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }
  return closestIdx;
};

// ─── Word Hunt Board ─────────────────────────────────────────

// Letter frequencies tuned for good boards
// J added at frequency 1 so TROJAN is formable (mirrors BRUIN's
// reliance on B at frequency 2). Q/X/Z still excluded — those four
// are nightmare letters in Boggle and don't justify the findability hit.
const VOWELS = "AAAEEEIIOOUU";
const CONSONANTS = "BBCDDFFGGHHJKLLMMNNPPRRRSSSTTTTVWY";

/** Count how many valid words can be found on a board using DFS. */
const countBoardWords = (board: string[]): number => {
  const found = new Set<string>();

  const dfs = (path: number[], word: string) => {
    if (word.length >= 3 && isValidWord(word)) {
      found.add(word);
    }
    if (word.length >= 8) return; // max word length

    const last = path[path.length - 1];
    const lastRow = Math.floor(last / 4);
    const lastCol = last % 4;

    for (let i = 0; i < 16; i++) {
      if (path.includes(i)) continue;
      const row = Math.floor(i / 4);
      const col = i % 4;
      if (Math.abs(row - lastRow) <= 1 && Math.abs(col - lastCol) <= 1) {
        dfs([...path, i], word + board[i]);
      }
    }
  };

  for (let i = 0; i < 16; i++) {
    dfs([i], board[i]);
  }
  return found.size;
};

/**
 * Generate a board and validate it has at least MIN_WORDS findable words.
 * Retries up to 20 times.
 */
const MIN_WORDS = 20;

export const generateBoard = (): string[] => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const board: string[] = new Array(16);
    // Guarantee 5-6 vowels spread across the grid
    const indices = [...Array(16).keys()].sort(() => Math.random() - 0.5);
    const vowelCount = 5 + Math.floor(Math.random() * 2); // 5 or 6
    const vowelSlots = new Set(indices.slice(0, vowelCount));

    for (let i = 0; i < 16; i++) {
      if (vowelSlots.has(i)) {
        board[i] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
      } else {
        board[i] = CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
      }
    }

    const wordCount = countBoardWords(board);
    if (wordCount >= MIN_WORDS) return board;
  }

  // Fallback: return a known-good board layout
  return ["T", "H", "E", "R", "A", "N", "D", "S", "I", "L", "O", "W", "G", "E", "T", "S"];
};

/** Two grid positions (0-15) are adjacent if they share an edge or corner. */
export const isAdjacent = (a: number, b: number): boolean => {
  const rowA = Math.floor(a / 4), colA = a % 4;
  const rowB = Math.floor(b / 4), colB = b % 4;
  return Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1 && a !== b;
};

/**
 * GamePigeon-style scoring: 3=1pt, 4=2pt, 5=4pt, 6=7pt, 7=11pt, 8+=15pt
 * Bonus words (rivalry-themed — see BONUS_WORDS in wordList.ts) score 2×.
 */
export const wordScore = (word: string): number => {
  const table: Record<number, number> = { 3: 1, 4: 2, 5: 4, 6: 7, 7: 11 };
  const base = word.length >= 8 ? 15 : (table[word.length] ?? 0);
  return isBonusWord(word) ? base * 2 : base;
};

// ─── Firestore Game Creation ──────────────────────────────────

export const createGame = async (
  showdownId: string,
  type: GameType,
  players: [string, string],
  sides: Record<string, Side>
): Promise<string> => {
  const base: any = {
    showdownId,
    type,
    players,
    sides,
    status: "active",
    currentTurn: players[0],
    createdAt: serverTimestamp(),
  };

  if (type === "cup_pong") {
    base.cups = {
      [players[0]]: INITIAL_CUPS(),
      [players[1]]: INITIAL_CUPS(),
    };
  } else {
    base.board = generateBoard();
    base.scores = { [players[0]]: 0, [players[1]]: 0 };
    base.wordsFound = { [players[0]]: [], [players[1]]: [] };
    base.turnDone = { [players[0]]: false, [players[1]]: false };
  }

  const ref = await addDoc(collection(db, "games"), base);

  // Link game to showdown so chat can surface it
  await updateDoc(doc(db, "showdowns", showdownId), {
    activeGameId: ref.id,
    activeGameType: type,
  });

  return ref.id;
};
