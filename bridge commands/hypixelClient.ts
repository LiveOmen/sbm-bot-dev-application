// hypixelClient.ts
import axios from "axios";
import "dotenv/config";

const HYPIXEL_KEY = process.env.HYPIXEL_KEY;
if (!HYPIXEL_KEY) {
  throw new Error("HYPIXEL_KEY not set in .env");
}

export interface FloorStats {
  completions: number;
  fastest: number | null; // seconds
}

// NOTE: index = level, value = cumulative XP required to REACH that level
// index 0 is 0 xp (before cata 1)
export const CATACOMBS_CUMULATIVE_XP: number[] = [
  0,
  50,
  125,
  235,
  395,
  625,
  955,
  1425,
  2095,
  3045,
  4385,
  6275,
  8940,
  12700,
  17960,
  25340,
  35640,
  50040,
  70040,
  97640,
  135640,
  188140,
  259640,
  356640,
  488640,
  668640,
  911640,
  1_239_640,
  1_684_640,
  2_284_640,
  3_084_640,
  4_149_640,
  5_559_640,
  7_459_640,
  9_959_640,
  13_259_640,
  17_559_640,
  23_159_640,
  30_359_640,
  39_559_640,
  51_559_640,
  66_559_640,
  85_559_640,
  109_559_640,
  139_559_640,
  177_559_640,
  225_559_640,
  285_559_640,
  360_559_640,
  453_559_640,
  569_809_640,
];

// ---------- Basic profile helpers ----------

// Mojang: IGN -> UUID (no dashes)
export async function getUUID(ign: string): Promise<string> {
  const url = `https://api.mojang.com/users/profiles/minecraft/${ign}`;
  const res = await axios.get(url);
  const data: any = res.data;
  return data.id; // "4fb5f8a717b446f3af2bdf7226d79cd0"
}

// Hypixel: SkyBlock profiles by UUID
export async function getSkyblockProfiles(uuidNoDash: string): Promise<any> {
  const url = `https://api.hypixel.net/v2/skyblock/profiles?key=${HYPIXEL_KEY}&uuid=${uuidNoDash}`;
  const res = await axios.get(url, { timeout: 10000 });
  const data: any = res.data;
  return data;
}

// Get the active profile object
export function getActiveProfile(data: any): any | null {
  if (!data || !Array.isArray(data.profiles)) return null;
  return data.profiles.find((p: any) => p.selected) ?? null;
}

// ---------- Helpers for dungeon floors ----------

// Normalize Hypixel fastest time (handles ms vs seconds weirdness)
function normalizeTime(raw: any): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  let sec = raw;

  // If it's absurdly big, it's almost certainly milliseconds
  if (sec > 7_200) {
    sec = sec / 1000;
  }

  return Math.round(sec);
}

// Get stats for a master dungeon floor (m1–m7)
export function getFloorStats(
  profile: any,
  uuidNoDash: string,
  floorNumber: number
): FloorStats {
  if (!profile || typeof profile !== "object") {
    return { completions: 0, fastest: null };
  }

  const member = profile.members?.[uuidNoDash];
  if (!member) {
    return { completions: 0, fastest: null };
  }

  const dungeons = member.dungeons?.dungeon_types;
  if (!dungeons || typeof dungeons !== "object") {
    return { completions: 0, fastest: null };
  }

  const floorKey = String(floorNumber);

  const master = dungeons.master_catacombs;
  const normal = dungeons.catacombs;

  let completions = 0;
  let fastest: number | null = null;

  // Master mode (preferred)
  if (master && typeof master === "object") {
    const tc = master.tier_completions;
    if (tc && typeof tc === "object" && typeof tc[floorKey] === "number") {
      completions = tc[floorKey];
    }

    const fsp = master.fastest_time_s_plus;
    if (fsp && typeof fsp === "object" && typeof fsp[floorKey] === "number") {
      fastest = normalizeTime(fsp[floorKey]);
    }
  }

  // Fallback to normal completions if master has none
  if (completions === 0 && normal && typeof normal === "object") {
    const tc = normal.tier_completions;
    if (tc && typeof tc === "object" && typeof tc[floorKey] === "number") {
      completions = tc[floorKey];
    }
  }

  // Fallback to normal fastest S+ if master missing
  if (fastest == null && normal && typeof normal === "object") {
    const fsp = normal.fastest_time_s_plus;
    if (fsp && typeof fsp === "object" && typeof fsp[floorKey] === "number") {
      fastest = normalizeTime(fsp[floorKey]);
    }
  }

  return { completions, fastest };
}

// ---------- Catacombs XP / level helpers ----------

// total catacombs XP from profile for this member
export function getCatacombsTotalXp(profile: any, uuidNoDash: string): number {
  const member = profile.members?.[uuidNoDash];
  if (!member) return 0;

  const cata = member.dungeons?.dungeon_types?.catacombs;
  const xp = cata?.experience;
  return typeof xp === "number" && Number.isFinite(xp) ? xp : 0;
}

// current catacombs level from total XP
export function getCatacombsLevel(totalXp: number): number {
  let level = 0;
  for (let i = 1; i < CATACOMBS_CUMULATIVE_XP.length; i++) {
    if (totalXp >= CATACOMBS_CUMULATIVE_XP[i]) {
      level = i;
    } else {
      break;
    }
  }
  return level;
}

// XP needed to reach a target level (absolute cumulative XP)
export function getTotalXpForLevel(targetLevel: number): number {
  if (targetLevel <= 0) return 0;
  if (targetLevel >= CATACOMBS_CUMULATIVE_XP.length) {
    return CATACOMBS_CUMULATIVE_XP[CATACOMBS_CUMULATIVE_XP.length - 1];
  }
  return CATACOMBS_CUMULATIVE_XP[targetLevel];
}
