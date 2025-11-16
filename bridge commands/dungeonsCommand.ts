import {
  getUUID,
  getSkyblockProfiles,
  getActiveProfile,
  getFloorStats,
} from "./hypixelClient";

export type CommandSource = "discord" | "minecraft";

export interface DungeonsCommandContext {
  source: CommandSource;
  rawAuthorName: string;
  linkedIgn?: string;
}

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function parseFloor(f: string): number | null {
  const match = /^m([1-7])$/i.exec(f);
  return match ? parseInt(match[1], 10) : null;
}

export async function handleDungeonsCommand(
  args: string[],
  ctx: DungeonsCommandContext
): Promise<string> {
  if (args.length === 0) {
    return "Usage: !dungeons <m1–m7> [ign]";
  }

  const floorArg = args[0].toLowerCase();
  const floorNumber = parseFloor(floorArg);
  if (!floorNumber) return "Invalid floor. Use m1–m7.";

  const ign =
    args[1]?.trim() || ctx.linkedIgn?.trim() || ctx.rawAuthorName.trim();
  if (!ign) return "Unable to determine IGN.";

  try {
    const uuid = await getUUID(ign);
    const profiles = await getSkyblockProfiles(uuid);
    if (!profiles.success) {
      return `Failed to fetch SkyBlock profiles for ${ign}.`;
    }

    const active = getActiveProfile(profiles);
    if (!active) {
      return `${ign} has no active SkyBlock profile.`;
    }

    const stats = getFloorStats(active, uuid, floorNumber);

    const completions = stats.completions;
    const fastest = formatSeconds(stats.fastest);

    return `${ign} has ${completions} ${floorArg} completions. Their fastest S+ time is ${fastest}.`;
  } catch (err: any) {
    console.error("[!dungeons] ERROR:", err);
    return `An error occurred while checking dungeons for ${ign}.`;
  }
}
