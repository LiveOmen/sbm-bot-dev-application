// cataCommand.ts
import {
  getUUID,
  getSkyblockProfiles,
  getActiveProfile,
  getCatacombsTotalXp,
  getTotalXpForLevel,
  getCatacombsLevel,
} from "./hypixelClient";

// Base XP per S+/good run BEFORE the 82% event boost.
// These are the "57k xp", "61k xp", etc. style values.
// Tweak these if your own per-run numbers are slightly different.
const BASE_CATA_XP_PER_RUN: Record<string, number> = {
  m1: 50_000,
  m2: 51_000,
  m3: 57_000,
  m4: 61_000,
  m5: 115_000,
  m6: 165_000,
  m7: 346_000,
};

// 52% normal boost + 30% event boost = +82%
const XP_BOOST_MULTIPLIER = 1.82;

function resolveFloor(arg: string | undefined): string | null {
  if (!arg) return null;
  const lower = arg.toLowerCase();
  if (/^m[1-7]$/.test(lower)) return lower;
  return null;
}

function resolveDesiredLevel(arg: string | undefined): number | null {
  if (!arg) return null;
  if (!/^\d+$/.test(arg)) return null;
  const n = parseInt(arg, 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.min(n, 50);
}

function formatRuns(n: number): string {
  return n.toLocaleString("en-US");
}

function formatXp(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Handle the !cata command.
 *
 * @param args raw arguments (anything after "!cata")
 * @param defaultIgn optional default ign from context (sender's ign/tag)
 */
export async function handleCataCommand(
  args: string[],
  defaultIgn?: string
): Promise<string> {
  try {
    // --- parse args (order-flexible) ---
    let floor: string | null = null;
    let ign: string | undefined;
    let desiredLevel: number | null = null;

    for (const raw of args) {
      const floorMaybe = resolveFloor(raw);
      if (!floor && floorMaybe) {
        floor = floorMaybe;
        continue;
      }

      const levelMaybe = resolveDesiredLevel(raw);
      if (desiredLevel === null && levelMaybe !== null) {
        desiredLevel = levelMaybe;
        continue;
      }

      if (!ign) {
        ign = raw;
      }
    }

    if (!floor) floor = "m7";
    if (desiredLevel === null) desiredLevel = 50;

    if (!ign) {
      if (defaultIgn) ign = defaultIgn;
      else {
        return "You need to specify an IGN for this command.";
      }
    }

    const floorXpBase = BASE_CATA_XP_PER_RUN[floor];
    if (!floorXpBase) {
      return "Invalid floor. Use m1–m7.";
    }

    const xpPerRun = Math.round(floorXpBase * XP_BOOST_MULTIPLIER);

    // --- fetch profile & cata XP ---
    const uuidNoDash = await getUUID(ign);
    const profilesData = await getSkyblockProfiles(uuidNoDash);

    if (!profilesData?.success) {
      return `Couldn't load SkyBlock profiles for ${ign}.`;
    }

    const activeProfile = getActiveProfile(profilesData);
    if (!activeProfile) {
      return `${ign} doesn't seem to have an active SkyBlock profile.`;
    }

    const totalXp = getCatacombsTotalXp(activeProfile, uuidNoDash);

    const currentLevel = getCatacombsLevel(totalXp);
    const targetLevel = Math.max(currentLevel, desiredLevel); // don't go backwards
    const totalNeeded = getTotalXpForLevel(targetLevel);

    let xpRemaining = totalNeeded - totalXp;
    if (xpRemaining < 0) xpRemaining = 0;

    const runsNeeded =
      xpRemaining > 0 ? Math.ceil(xpRemaining / xpPerRun) : 0;

   if (xpRemaining <= 0) {
  return `${ign} needs 0 ${floor} runs to reach cata ${targetLevel}`;
}

return `${ign} needs ${formatRuns(runsNeeded)} ${floor} runs to reach cata ${targetLevel}`;
  } catch (err: any) {
    console.error("[!cata] ERROR:", err);
    return "Something went wrong while calculating Catacombs XP.";
  }
}
