// utils/gameUtils.ts
// CrossTown game engine — Cup Pong + Word Hunt
// Both games are turn-based and stored in Firestore under `games/{gameId}`

import {
  addDoc, collection, doc, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// ─── Types ───────────────────────────────────────────────────

export type GameType = "cup_pong" | "word_hunt";
export type Side = "usc" | "ucla";

export interface Game {
  id: string;
  matchId: string;
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

// ─── Cup Layout ──────────────────────────────────────────────
// Triangle: 3 at back, 2 in middle, 1 at front
// Indices:  0  1  2   (row 0)
//              3  4   (row 1)
//               5     (row 2)

export interface CupLayout {
  row: number;
  col: number; // 0-indexed within the row
  maxCols: number; // total cups in this row
}

export const CUP_LAYOUT: CupLayout[] = [
  { row: 0, col: 0, maxCols: 3 },
  { row: 0, col: 1, maxCols: 3 },
  { row: 0, col: 2, maxCols: 3 },
  { row: 1, col: 0, maxCols: 2 },
  { row: 1, col: 1, maxCols: 2 },
  { row: 2, col: 0, maxCols: 1 },
];

export const INITIAL_CUPS = (): boolean[] => [true, true, true, true, true, true];

/** Get the pixel center of a cup within a container of (areaW x areaH). */
export const getCupCenter = (
  index: number,
  areaW: number,
  areaH: number,
  flipped = false // flip triangle orientation (for opponent's side)
): { x: number; y: number } => {
  const layout = CUP_LAYOUT[index];
  const ROW_COUNT = 3;
  const rowH = areaH / (ROW_COUNT + 1);
  const colW = areaW / (layout.maxCols + 1);

  const x = colW * (layout.col + 1);
  const rawY = rowH * (layout.row + 1);
  const y = flipped ? areaH - rawY : rawY;
  return { x, y };
};

// ─── Word Hunt Board ─────────────────────────────────────────

const VOWELS = "AAAEEEIIOO";
const CONSONANTS = "BCDDFGGHHKLLLMMNNNPRRRSSSTTTVWY";

export const generateBoard = (): string[] => {
  const board: string[] = new Array(16);
  // Guarantee ~5 vowels spread across the grid
  const indices = [...Array(16).keys()].sort(() => Math.random() - 0.5);
  const vowelSlots = new Set(indices.slice(0, 5));
  for (let i = 0; i < 16; i++) {
    if (vowelSlots.has(i)) {
      board[i] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    } else {
      board[i] = CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
    }
  }
  return board;
};

/** Two grid positions (0-15) are adjacent if they share an edge or corner. */
export const isAdjacent = (a: number, b: number): boolean => {
  const rowA = Math.floor(a / 4), colA = a % 4;
  const rowB = Math.floor(b / 4), colB = b % 4;
  return Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1 && a !== b;
};

/** GamePigeon-style scoring: 3=1pt, 4=2pt, 5=4pt, 6=7pt, 7=11pt, 8+=15pt */
export const wordScore = (word: string): number => {
  const table: Record<number, number> = { 3: 1, 4: 2, 5: 4, 6: 7, 7: 11 };
  return word.length >= 8 ? 15 : (table[word.length] ?? 0);
};

// ─── Firestore Game Creation ──────────────────────────────────

export const createGame = async (
  matchId: string,
  type: GameType,
  players: [string, string],
  sides: Record<string, Side>
): Promise<string> => {
  const base: any = {
    matchId,
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

  // Link game to match so chat can surface it
  await updateDoc(doc(db, "matches", matchId), {
    activeGameId: ref.id,
    activeGameType: type,
  });

  return ref.id;
};

// ─── Shot result helper for Cup Pong ─────────────────────────

/**
 * Given a throw "accuracy" (0–1, 1 = perfect center), determine if it's a hit.
 * ~60% hit rate at perfect accuracy, dropping off with distance.
 */
export const computeHit = (accuracy: number): boolean => {
  const hitChance = 0.6 * Math.pow(accuracy, 0.7);
  return Math.random() < hitChance;
};
