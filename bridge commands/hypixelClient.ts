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

// 1) Mojang IGN -> UUID (no dashes)
export async function getUUID(ign: string): Promise<string> {
  const url = `https://api.mojang.com/users/profiles/minecraft/${ign}`;
  const res = await axios.get(url);
  const data: any = res.data;
  return data.id; // UUID without dashes
}

// 2) Hypixel profiles for that UUID
export async function getSkyblockProfiles(uuidNoDash: string): Promise<any> {
  const url = `https://api.hypixel.net/v2/skyblock/profiles?key=${HYPIXEL_KEY}&uuid=${uuidNoDash}`;
  const res = await axios.get(url, { timeout: 10000 });
  const data: any = res.data;
  return data;
}

// 3) Active profile
export function getActiveProfile(data: any): any | null {
  if (!data || !Array.isArray(data.profiles)) return null;
  return data.profiles.find((p: any) => p.selected) ?? null;
}

// normalize Hypixel time (seconds vs ms)
function normalizeTime(raw: any): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  let sec = raw;

  if (sec > 7200) {
    sec = sec / 1000; // treat as ms -> seconds
  }

  return Math.round(sec);
}

// 4) Get stats for a given *master* dungeon floor (m1–m7)
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

  // Master mode lives under "master_catacombs" now
  const master = dungeons.master_catacombs;
  const normal = dungeons.catacombs;

  let completions = 0;
  let fastest: number | null = null;

  // Master mode stats first
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

  // Fallback to normal catacombs completions if master data missing
  if (completions === 0 && normal && typeof normal === "object") {
    const tc = normal.tier_completions;
    if (tc && typeof tc === "object" && typeof tc[floorKey] === "number") {
      completions = tc[floorKey];
    }
  }

  // Fallback to normal fastest S+ if master fastest missing
  if (fastest == null && normal && typeof normal === "object") {
    const fsp = normal.fastest_time_s_plus;
    if (fsp && typeof fsp === "object" && typeof fsp[floorKey] === "number") {
      fastest = normalizeTime(fsp[floorKey]);
    }
  }

  return { completions, fastest };
}
