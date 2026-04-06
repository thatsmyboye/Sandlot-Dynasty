import { GeneratedPlayer, generateRoster, pickRandom, randInt } from "./playerGenerator";

export type { GeneratedPlayer };
export { pickRandom, randInt };

export type GeneratedTeam = {
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  logoSeed: string;
  roster: GeneratedPlayer[];
};

// ---------------------------------------------------------------------------
// Team definitions
// ---------------------------------------------------------------------------

type TeamDefinition = {
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
};

const TEAM_DEFINITIONS: TeamDefinition[] = [
  {
    name: "Ironclads",
    city: "New Carthage",
    abbreviation: "NCI",
    primaryColor: "#1a3a6b",
    secondaryColor: "#c8a84b",
  },
  {
    name: "Grizzlies",
    city: "Veltham",
    abbreviation: "VGR",
    primaryColor: "#2d5a27",
    secondaryColor: "#f5f0e8",
  },
  {
    name: "Tides",
    city: "Port Meridian",
    abbreviation: "PMT",
    primaryColor: "#00508c",
    secondaryColor: "#f5a623",
  },
  {
    name: "Mustangs",
    city: "Ashbrook",
    abbreviation: "AMS",
    primaryColor: "#8b1a1a",
    secondaryColor: "#d4b483",
  },
  {
    name: "Herons",
    city: "Lakeport",
    abbreviation: "LKH",
    primaryColor: "#006994",
    secondaryColor: "#ffffff",
  },
  {
    name: "Outlaws",
    city: "Crestfall",
    abbreviation: "CFO",
    primaryColor: "#2c2c2c",
    secondaryColor: "#d4af37",
  },
  {
    name: "Cannons",
    city: "New Dunmore",
    abbreviation: "NDC",
    primaryColor: "#c41230",
    secondaryColor: "#002147",
  },
  {
    name: "Wolves",
    city: "Stonehaven",
    abbreviation: "SHW",
    primaryColor: "#4a2e83",
    secondaryColor: "#c8c8c8",
  },
  {
    name: "Stallions",
    city: "Ridgecrest",
    abbreviation: "RCS",
    primaryColor: "#1b4d3e",
    secondaryColor: "#ffd700",
  },
  {
    name: "Pelicans",
    city: "Bayfront",
    abbreviation: "BFP",
    primaryColor: "#005f73",
    secondaryColor: "#ee9b00",
  },
  {
    name: "Hammers",
    city: "Harmon Valley",
    abbreviation: "HVH",
    primaryColor: "#3d0000",
    secondaryColor: "#ff6b35",
  },
  {
    name: "Pines",
    city: "Clearwater",
    abbreviation: "CWP",
    primaryColor: "#2e4a1e",
    secondaryColor: "#ffffff",
  },
  {
    name: "Raiders",
    city: "Duskport",
    abbreviation: "DKR",
    primaryColor: "#1a1a2e",
    secondaryColor: "#e94560",
  },
  {
    name: "Foxes",
    city: "Millbrook",
    abbreviation: "MLF",
    primaryColor: "#8b4513",
    secondaryColor: "#f4d03f",
  },
  {
    name: "Sentinels",
    city: "Irongate",
    abbreviation: "IGS",
    primaryColor: "#2c3e50",
    secondaryColor: "#e74c3c",
  },
  {
    name: "Miners",
    city: "Coldwater",
    abbreviation: "CWM",
    primaryColor: "#4a3728",
    secondaryColor: "#bfa980",
  },
];

// ---------------------------------------------------------------------------
// Logo seed generation
// ---------------------------------------------------------------------------

function generateLogoSeed(abbreviation: string, primaryColor: string): string {
  // Deterministic-ish seed combining abbreviation and color for use with
  // any seed-based logo/avatar service (e.g. dicebear, robohash, etc.)
  const colorHex = primaryColor.replace("#", "");
  return `${abbreviation.toLowerCase()}-${colorHex}`;
}

// ---------------------------------------------------------------------------
// League generator
// ---------------------------------------------------------------------------

export function generateLeague(currentYear: number): GeneratedTeam[] {
  return TEAM_DEFINITIONS.map((def) => ({
    name: def.name,
    city: def.city,
    abbreviation: def.abbreviation,
    primaryColor: def.primaryColor,
    secondaryColor: def.secondaryColor,
    logoSeed: generateLogoSeed(def.abbreviation, def.primaryColor),
    roster: generateRoster(currentYear),
  }));
}
