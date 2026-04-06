import { generateNarrative, type NarrativeContext } from "./narrativeEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Input types
// ─────────────────────────────────────────────────────────────────────────────

export type SimPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  contact: number;
  power: number;
  eye: number;
  speed: number;
  velocity: number;
  movement: number;
  control: number;
  stamina: number;
  glove: number;
  arm: number;
  clutch: number;
  durability: number;
};

export type SimTeam = {
  id: string;
  name: string;
  city: string;
  players: SimPlayer[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

export type SimGameLog = {
  inning: number;
  isTop: boolean;
  sequence: number;
  eventType: string;
  text: string;
  homeScore: number;
  awayScore: number;
  outs: number;
  runnersOn: string;
  batterId: string | null;
  pitcherId: string | null;
};

export type BatterBoxScore = {
  playerId: string;
  lineupSlot: number;
  atBats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  runs: number;
  stolenBases: number;
  caughtStealing: number;
};

export type PitcherBoxScore = {
  playerId: string;
  isStarter: boolean;
  outsPitched: number;
  hitsAllowed: number;
  earnedRuns: number;
  walksAllowed: number;
  strikeouts: number;
  homeRunsAllowed: number;
  win: boolean;
  loss: boolean;
  save: boolean;
  holdEarned: boolean;
};

export type GameResult = {
  homeScore: number;
  awayScore: number;
  inningsPlayed: number;
  log: SimGameLog[];
  homeBatters: BatterBoxScore[];
  awayBatters: BatterBoxScore[];
  homePitchers: PitcherBoxScore[];
  awayPitchers: PitcherBoxScore[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal game state
// ─────────────────────────────────────────────────────────────────────────────

type GameState = {
  inning: number;
  isTop: boolean;
  outs: number;
  bases: (string | null)[]; // [1B, 2B, 3B] — stores playerId
  homeScore: number;
  awayScore: number;
  log: SimGameLog[];
  sequence: number;
};

type PitcherState = {
  player: SimPlayer;
  outsPitched: number;
  earnedRuns: number;
  isStarter: boolean;
};

type AtBatResult = {
  type:
    | "SINGLE"
    | "DOUBLE"
    | "TRIPLE"
    | "HOME_RUN"
    | "WALK"
    | "STRIKEOUT"
    | "GROUNDOUT"
    | "FLYOUT"
    | "LINEOUT"
    | "DOUBLE_PLAY";
  rbi: number;
  runsScored: string[]; // playerIds who scored
  batterReachesBase: boolean;
  baseReached: 1 | 2 | 3 | 4 | null; // 4 = HR (doesn't stay on base)
};

// ─────────────────────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalize(r: number): number {
  return (r - 50) / 50;
}

function sigmoid(x: number, k = 2.5): number {
  return 1 / (1 + Math.exp(-x * k));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function rand(): number {
  return Math.random();
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Lineup building
// ─────────────────────────────────────────────────────────────────────────────

function buildLineup(team: SimTeam): SimPlayer[] {
  const hitters = team.players.filter(
    (p) => !["SP", "RP", "CL"].includes(p.position)
  );

  // Sort candidates by composite score for lineup slot logic
  const scored = hitters.map((p) => ({
    player: p,
    obpScore: (p.contact + p.eye) / 2,
    powerScore: (p.contact + p.power) / 2,
    speedScore: (p.speed + p.eye) / 2,
  }));

  scored.sort((a, b) => b.obpScore - a.obpScore);
  const lineup: SimPlayer[] = [];

  // Slots 1-2: best OBP/speed
  const speedLeaders = [...scored].sort(
    (a, b) => b.speedScore - a.speedScore
  );
  lineup.push(speedLeaders[0].player);
  speedLeaders.splice(0, 1);
  scored.splice(
    scored.findIndex((s) => s.player.id === lineup[0].id),
    1
  );
  lineup.push(speedLeaders[0].player);

  // Remove slot 2 from remaining pool
  const remaining = scored.filter(
    (s) => !lineup.map((p) => p.id).includes(s.player.id)
  );

  // Slots 3-4: best contact + power
  const powerLeaders = [...remaining].sort(
    (a, b) => b.powerScore - a.powerScore
  );
  lineup.push(powerLeaders[0].player);
  lineup.push(powerLeaders[1].player);

  // Slot 5: highest power
  const slot5Pool = remaining.filter(
    (s) => !lineup.map((p) => p.id).includes(s.player.id)
  );
  const slot5 = [...slot5Pool].sort((a, b) => b.player.power - a.player.power)[0];
  lineup.push(slot5.player);

  // Slots 6-9: remaining sorted by contact desc
  const tail = slot5Pool
    .filter((s) => s.player.id !== slot5.player.id)
    .sort((a, b) => b.player.contact - a.player.contact)
    .slice(0, 4)
    .map((s) => s.player);

  lineup.push(...tail);

  // Ensure exactly 9
  while (lineup.length < 9) {
    const extra = hitters.find((p) => !lineup.includes(p));
    if (!extra) break;
    lineup.push(extra);
  }

  return lineup.slice(0, 9);
}

function selectStarter(team: SimTeam): SimPlayer | null {
  const starters = team.players.filter((p) => p.position === "SP");
  if (starters.length === 0) return team.players.find((p) => p.position === "RP") ?? null;
  return starters.sort(
    (a, b) =>
      (b.velocity + b.movement + b.control) / 3 -
      (a.velocity + a.movement + a.control) / 3
  )[0];
}

function buildBullpen(team: SimTeam): SimPlayer[] {
  const relievers = team.players
    .filter((p) => p.position === "RP" || p.position === "CL")
    .sort((a, b) => {
      if (a.position === "CL") return 1;
      if (b.position === "CL") return -1;
      return (b.velocity + b.movement) / 2 - (a.velocity + a.movement) / 2;
    });
  return relievers;
}

// ─────────────────────────────────────────────────────────────────────────────
// At-bat resolution (sigmoid math)
// ─────────────────────────────────────────────────────────────────────────────

function resolveAtBat(batter: SimPlayer, pitcher: SimPlayer): AtBatResult {
  // Step 1: Contact resolution
  const contactScore =
    normalize(batter.contact) * 0.4 -
    normalize(pitcher.movement) * 0.3 -
    normalize(pitcher.control) * 0.3;
  const contactProb = sigmoid(contactScore + 0.35); // ~73% contact at avg

  if (rand() > contactProb) {
    // No contact → walk or strikeout
    const walkScore =
      normalize(batter.eye) * 0.5 - normalize(pitcher.control) * 0.5;
    const walkProb = sigmoid(walkScore - 0.8); // ~8% at avg
    if (rand() < walkProb) {
      return { type: "WALK", rbi: 0, runsScored: [], batterReachesBase: true, baseReached: 1 };
    }
    return { type: "STRIKEOUT", rbi: 0, runsScored: [], batterReachesBase: false, baseReached: null };
  }

  // Step 2: Hit vs. out (ball in play)
  const babipScore =
    normalize(batter.contact) * 0.5 -
    normalize(pitcher.movement) * 0.3 -
    normalize(pitcher.velocity) * 0.2;
  const hitProb = sigmoid(babipScore - 0.8); // ~30% BABIP at avg

  if (rand() > hitProb) {
    // Out in play
    const outType = weightedPick(
      ["GROUNDOUT", "FLYOUT", "LINEOUT"] as const,
      [55, 35, 10]
    );
    return { type: outType, rbi: 0, runsScored: [], batterReachesBase: false, baseReached: null };
  }

  // Step 3: Hit type
  const powerScore =
    normalize(batter.power) * 0.6 - normalize(pitcher.velocity) * 0.4;

  const hrChance = clamp(0.05 + powerScore * 0.1, 0.01, 0.2);
  const tripleChance = clamp(0.03 + normalize(batter.speed) * 0.02, 0.005, 0.06);
  const doubleChance = clamp(0.2 + powerScore * 0.05, 0.1, 0.32);
  const singleChance = Math.max(0.01, 1 - hrChance - tripleChance - doubleChance);

  const hitType = weightedPick(
    ["HOME_RUN", "TRIPLE", "DOUBLE", "SINGLE"] as const,
    [hrChance, tripleChance, doubleChance, singleChance]
  );

  const baseReached: 1 | 2 | 3 | 4 =
    hitType === "SINGLE" ? 1 : hitType === "DOUBLE" ? 2 : hitType === "TRIPLE" ? 3 : 4;

  return {
    type: hitType,
    rbi: 0, // calculated after runner advancement
    runsScored: [],
    batterReachesBase: hitType !== "HOME_RUN",
    baseReached,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Base runner advancement
// ─────────────────────────────────────────────────────────────────────────────

function advanceRunners(
  state: GameState,
  result: AtBatResult,
  batter: SimPlayer
): { newBases: (string | null)[]; runs: number; scoringPlayers: string[] } {
  const bases = [...state.bases]; // [1B, 2B, 3B]
  let runs = 0;
  const scoringPlayers: string[] = [];

  switch (result.type) {
    case "HOME_RUN": {
      // Everyone scores
      for (const runner of bases) {
        if (runner) {
          scoringPlayers.push(runner);
          runs++;
        }
      }
      scoringPlayers.push(batter.id); // batter scores
      runs++;
      return { newBases: [null, null, null], runs, scoringPlayers };
    }

    case "TRIPLE": {
      for (const runner of bases) {
        if (runner) {
          scoringPlayers.push(runner);
          runs++;
        }
      }
      return { newBases: [null, null, batter.id], runs, scoringPlayers };
    }

    case "DOUBLE": {
      // Runners on 2nd and 3rd score; runner on 1st goes to 3rd
      if (bases[2]) { scoringPlayers.push(bases[2]); runs++; }
      if (bases[1]) { scoringPlayers.push(bases[1]); runs++; }
      const runnerFrom1st = bases[0];
      return {
        newBases: [null, batter.id, runnerFrom1st ?? null],
        runs,
        scoringPlayers,
      };
    }

    case "SINGLE": {
      // Runners on 2nd/3rd score; runner on 1st advances to 2nd (or 3rd if fast)
      if (bases[2]) { scoringPlayers.push(bases[2]); runs++; }
      if (bases[1]) { scoringPlayers.push(bases[1]); runs++; }
      const advancedFrom1 = bases[0];
      const goesToThird = advancedFrom1 && rand() < 0.25; // 25% chance to take extra base
      return {
        newBases: [
          batter.id,
          goesToThird ? null : advancedFrom1,
          goesToThird ? advancedFrom1 : null,
        ],
        runs,
        scoringPlayers,
      };
    }

    case "WALK": {
      // Force-advance only
      if (!bases[0]) return { newBases: [batter.id, bases[1], bases[2]], runs: 0, scoringPlayers };
      if (!bases[1]) return { newBases: [batter.id, bases[0], bases[2]], runs: 0, scoringPlayers };
      if (!bases[2]) return { newBases: [batter.id, bases[0], bases[1]], runs: 0, scoringPlayers };
      // Bases loaded walk — runner on 3rd scores
      scoringPlayers.push(bases[2]!);
      return {
        newBases: [batter.id, bases[0], bases[1]],
        runs: 1,
        scoringPlayers,
      };
    }

    case "GROUNDOUT": {
      // Double play check: runner on 1st, <2 outs
      if (bases[0] && state.outs < 2 && rand() < 0.15) {
        result.type = "DOUBLE_PLAY" as any;
        // Runner on 1st out, batter out (2 outs added externally)
        const newBases: (string | null)[] = [null, bases[1], bases[2]];
        // Sac: runners advance 1 base if forced? For simplicity, no extra advancement on DP
        return { newBases, runs: 0, scoringPlayers };
      }
      // Sac fly logic is in flyout — groundout: advance runners only if forced
      // Runner on 3rd scores on groundout with <2 outs (15% of the time)
      if (bases[2] && state.outs < 2 && rand() < 0.15) {
        scoringPlayers.push(bases[2]);
        runs++;
        return { newBases: [bases[0], bases[1], null], runs, scoringPlayers };
      }
      return { newBases: bases, runs: 0, scoringPlayers };
    }

    case "FLYOUT": {
      // Sac fly: runner on 3rd scores with <2 outs
      if (bases[2] && state.outs < 2) {
        scoringPlayers.push(bases[2]);
        runs++;
        return { newBases: [bases[0], bases[1], null], runs, scoringPlayers };
      }
      return { newBases: bases, runs: 0, scoringPlayers };
    }

    default:
      return { newBases: bases, runs: 0, scoringPlayers };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stolen base attempt
// ─────────────────────────────────────────────────────────────────────────────

function attemptStolenBase(
  state: GameState,
  runner: SimPlayer,
  pitcher: SimPlayer,
  log: SimGameLog[],
  homeTeam: string,
  awayTeam: string
): { success: boolean; caught: boolean } {
  const successProb = clamp(
    (runner.speed - pitcher.control * 0.3) / 100 + 0.5,
    0.4,
    0.8
  );
  const success = rand() < successProb;
  const ctx: NarrativeContext = {
    batterName: runner.lastName,
    pitcherName: pitcher.lastName,
    inning: state.inning,
    isTop: state.isTop,
    outs: state.outs,
    runnersOn: encodeRunners(state.bases),
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    homeTeam,
    awayTeam,
  };

  log.push({
    inning: state.inning,
    isTop: state.isTop,
    sequence: state.sequence++,
    eventType: success ? "STOLEN_BASE" : "CAUGHT_STEALING",
    text: generateNarrative(success ? "STOLEN_BASE" : "CAUGHT_STEALING", ctx),
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    outs: state.outs,
    runnersOn: encodeRunners(state.bases),
    batterId: runner.id,
    pitcherId: pitcher.id,
  });

  return { success, caught: !success };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function encodeRunners(bases: (string | null)[]): string {
  return [bases[0] ? "1" : "0", bases[1] ? "1" : "0", bases[2] ? "1" : "0"].join("");
}

function playerName(p: SimPlayer): string {
  return p.lastName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main simulation
// ─────────────────────────────────────────────────────────────────────────────

export function simulateGame(homeTeam: SimTeam, awayTeam: SimTeam): GameResult {
  // Build lineups
  const homeLineup = buildLineup(homeTeam);
  const awayLineup = buildLineup(awayTeam);
  const homeStarter = selectStarter(homeTeam);
  const awayStarter = selectStarter(awayTeam);
  const homeBullpen = buildBullpen(homeTeam);
  const awayBullpen = buildBullpen(awayTeam);

  // Batter box scores
  const homeBatters = new Map<string, BatterBoxScore>();
  const awayBatters = new Map<string, BatterBoxScore>();

  homeLineup.forEach((p, i) => {
    homeBatters.set(p.id, { playerId: p.id, lineupSlot: i + 1, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, rbi: 0, walks: 0, strikeouts: 0, runs: 0, stolenBases: 0, caughtStealing: 0 });
  });
  awayLineup.forEach((p, i) => {
    awayBatters.set(p.id, { playerId: p.id, lineupSlot: i + 1, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, rbi: 0, walks: 0, strikeouts: 0, runs: 0, stolenBases: 0, caughtStealing: 0 });
  });

  // Pitcher states
  const homePitcherStates: PitcherState[] = [];
  const awayPitcherStates: PitcherState[] = [];

  const initPitcherState = (p: SimPlayer, isStarter: boolean): PitcherState => ({
    player: p,
    outsPitched: 0,
    earnedRuns: 0,
    isStarter,
  });

  let homeCurrentPitcher: PitcherState | null = homeStarter
    ? initPitcherState(homeStarter, true)
    : null;
  let awayCurrentPitcher: PitcherState | null = awayStarter
    ? initPitcherState(awayStarter, true)
    : null;

  if (homeCurrentPitcher) homePitcherStates.push(homeCurrentPitcher);
  if (awayCurrentPitcher) awayPitcherStates.push(awayCurrentPitcher);

  let homeBullpenIdx = 0;
  let awayBullpenIdx = 0;

  const state: GameState = {
    inning: 1,
    isTop: true,
    outs: 0,
    bases: [null, null, null],
    homeScore: 0,
    awayScore: 0,
    log: [],
    sequence: 0,
  };

  // Lineup position trackers
  let awayLineupIdx = 0;
  let homeLineupIdx = 0;

  // Win/loss tracking
  let lastLeadChange = { inning: 1, isTop: true, pitcherId: "" };

  const getWinningPitcher = () => {
    const homeWin = state.homeScore > state.awayScore;
    const winnerPitchers = homeWin ? homePitcherStates : awayPitcherStates;
    return winnerPitchers[winnerPitchers.length - 1];
  };

  const getLosingPitcher = () => {
    const homeWin = state.homeScore > state.awayScore;
    const loserPitchers = homeWin ? awayPitcherStates : homePitcherStates;
    return loserPitchers[loserPitchers.length - 1];
  };

  const getSavePitcher = () => {
    const homeWin = state.homeScore > state.awayScore;
    const winnerPitchers = homeWin ? homePitcherStates : awayPitcherStates;
    if (winnerPitchers.length < 2) return null;
    const last = winnerPitchers[winnerPitchers.length - 1];
    const margin = Math.abs(state.homeScore - state.awayScore);
    return margin <= 3 ? last : null;
  };

  // Pitching change helper
  function changePitcher(isHome: boolean, ctx: NarrativeContext): PitcherState | null {
    const bullpen = isHome ? homeBullpen : awayBullpen;
    const bullpenIdxRef = isHome ? { v: homeBullpenIdx } : { v: awayBullpenIdx };
    const pitcherStates = isHome ? homePitcherStates : awayPitcherStates;

    if (bullpenIdxRef.v >= bullpen.length) return null;

    const newPitcher = initPitcherState(bullpen[bullpenIdxRef.v], false);
    bullpenIdxRef.v++;
    if (isHome) homeBullpenIdx = bullpenIdxRef.v;
    else awayBullpenIdx = bullpenIdxRef.v;

    pitcherStates.push(newPitcher);

    ctx.pitcherName = newPitcher.player.lastName;
    state.log.push({
      inning: state.inning,
      isTop: state.isTop,
      sequence: state.sequence++,
      eventType: "PITCHING_CHANGE",
      text: generateNarrative("PITCHING_CHANGE", ctx),
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      outs: state.outs,
      runnersOn: encodeRunners(state.bases),
      batterId: null,
      pitcherId: newPitcher.player.id,
    });

    return newPitcher;
  }

  // ── Main game loop ──────────────────────────────────────────────────────────

  while (true) {
    const isGameOver =
      state.inning > 9 && state.homeScore !== state.awayScore;
    if (isGameOver) break;
    if (state.inning > 12) break; // max extras

    const isTop = state.isTop;
    const battingTeam = isTop ? awayTeam : homeTeam;
    const fieldingTeam = isTop ? homeTeam : awayTeam;
    const lineup = isTop ? awayLineup : homeLineup;
    const lineupIdxRef = isTop
      ? { v: awayLineupIdx }
      : { v: homeLineupIdx };

    // Determine current pitcher for fielding team
    let currentPitcherState = isTop ? homeCurrentPitcher : awayCurrentPitcher;

    const ctx: NarrativeContext = {
      batterName: "",
      pitcherName: currentPitcherState?.player.lastName ?? "Unknown",
      inning: state.inning,
      isTop,
      outs: state.outs,
      runnersOn: encodeRunners(state.bases),
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
    };

    // Inning start
    state.log.push({
      inning: state.inning,
      isTop,
      sequence: state.sequence++,
      eventType: "INNING_START",
      text: generateNarrative("INNING_START", ctx),
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      outs: 0,
      runnersOn: "000",
      batterId: null,
      pitcherId: currentPitcherState?.player.id ?? null,
    });

    state.outs = 0;
    state.bases = [null, null, null];

    // ── Half-inning loop ──────────────────────────────────────────────────────
    while (state.outs < 3) {
      const batter = lineup[lineupIdxRef.v % 9];
      lineupIdxRef.v++;

      // Pitcher fatigue check
      if (currentPitcherState) {
        const fatigueOuts = Math.round((currentPitcherState.player.stamina / 10) * 3);
        const shouldChange =
          (currentPitcherState.isStarter &&
            currentPitcherState.outsPitched >= fatigueOuts &&
            currentPitcherState.outsPitched >= 15) || // min 5 innings
          (!currentPitcherState.isStarter && currentPitcherState.outsPitched >= 3) ||
          currentPitcherState.earnedRuns >= 6;

        if (shouldChange) {
          ctx.batterName = playerName(batter);
          const newState = changePitcher(isTop ? false : true, ctx);
          if (newState) {
            currentPitcherState = newState;
            if (isTop) homeCurrentPitcher = newState;
            else awayCurrentPitcher = newState;
          }
        }
      }

      // CL entry logic: 9th inning+, winning by 1-3
      if (!currentPitcherState?.isStarter) {
        const lead = isTop
          ? state.homeScore - state.awayScore
          : state.awayScore - state.homeScore;
        const cl = fieldingTeam.players.find((p) => p.position === "CL");
        const isInClose = state.inning >= 9 && lead > 0 && lead <= 3;
        if (
          cl &&
          isInClose &&
          currentPitcherState?.player.id !== cl.id &&
          !homePitcherStates.concat(awayPitcherStates).some((ps) => ps.player.id === cl.id)
        ) {
          ctx.batterName = playerName(batter);
          const newState = changePitcher(isTop ? false : true, ctx);
          if (newState) {
            currentPitcherState = newState;
            if (isTop) homeCurrentPitcher = newState;
            else awayCurrentPitcher = newState;
          }
        }
      }

      if (!currentPitcherState) break;

      const pitcher = currentPitcherState.player;
      ctx.batterName = playerName(batter);
      ctx.pitcherName = playerName(pitcher);
      ctx.outs = state.outs;
      ctx.runnersOn = encodeRunners(state.bases);

      // Resolve at-bat
      const result = resolveAtBat(batter, pitcher);

      // Advance runners
      const { newBases, runs, scoringPlayers } = advanceRunners(state, result, batter);

      // Update scores
      if (isTop) {
        state.awayScore += runs;
      } else {
        state.homeScore += runs;
      }

      // Track RBI and runs
      result.rbi = runs;
      result.runsScored = scoringPlayers;

      // Update batter stat
      const batterStats = isTop
        ? awayBatters.get(batter.id)
        : homeBatters.get(batter.id);

      if (batterStats) {
        if (result.type !== "WALK") batterStats.atBats++;
        if (result.type === "WALK") batterStats.walks++;
        if (result.type === "STRIKEOUT") batterStats.strikeouts++;
        if (
          ["SINGLE", "DOUBLE", "TRIPLE", "HOME_RUN"].includes(result.type)
        ) {
          batterStats.hits++;
          if (result.type === "DOUBLE") batterStats.doubles++;
          if (result.type === "TRIPLE") batterStats.triples++;
          if (result.type === "HOME_RUN") batterStats.homeRuns++;
        }
        batterStats.rbi += result.rbi;
      }

      // Update pitcher stat
      currentPitcherState.earnedRuns += runs;

      // Update run scorers in batter stats
      for (const scorerId of scoringPlayers) {
        const scorerStats = isTop
          ? awayBatters.get(scorerId)
          : homeBatters.get(scorerId);
        if (scorerStats) scorerStats.runs++;
        else {
          // scorer is on the other team (shouldn't happen) or pitcher
        }
      }

      // Generate narrative
      const eventType = (result.type === "DOUBLE_PLAY" as any) ? "GROUNDOUT" : result.type;
      state.log.push({
        inning: state.inning,
        isTop,
        sequence: state.sequence++,
        eventType,
        text: generateNarrative(eventType, { ...ctx, homeScore: state.homeScore, awayScore: state.awayScore }),
        homeScore: state.homeScore,
        awayScore: state.awayScore,
        outs: state.outs,
        runnersOn: encodeRunners(state.bases),
        batterId: batter.id,
        pitcherId: pitcher.id,
      });

      // Advance outs
      if (
        ["STRIKEOUT", "GROUNDOUT", "FLYOUT", "LINEOUT"].includes(result.type)
      ) {
        state.outs++;
        currentPitcherState.outsPitched++;
      } else if ((result.type as string) === "DOUBLE_PLAY") {
        state.outs += 2;
        currentPitcherState.outsPitched += 2;
      } else {
        // Reached base: pitcher counts 0 outs but threw a pitch
        // Stolen base attempt for runner on 1st
        if (
          result.batterReachesBase &&
          result.baseReached === 1 &&
          rand() < 0.2 &&
          batter.speed > 70
        ) {
          const { success, caught } = attemptStolenBase(
            state,
            batter,
            pitcher,
            state.log,
            homeTeam.name,
            awayTeam.name
          );
          if (success) {
            if (batterStats) batterStats.stolenBases++;
            // Advance from 1st to 2nd
            if (newBases[0] === batter.id) {
              newBases[1] = batter.id;
              newBases[0] = null;
            }
          } else if (caught) {
            if (batterStats) batterStats.caughtStealing++;
            state.outs++;
            currentPitcherState.outsPitched++;
            // Remove from base
            if (newBases[0] === batter.id) newBases[0] = null;
          }
        }
      }

      // Update bases
      state.bases = newBases;

      // Walk-off check in bottom of 9th+
      if (!isTop && state.inning >= 9 && state.homeScore > state.awayScore) {
        break;
      }
    }

    // Inning end
    ctx.outs = state.outs;
    ctx.runnersOn = encodeRunners(state.bases);
    state.log.push({
      inning: state.inning,
      isTop,
      sequence: state.sequence++,
      eventType: "INNING_END",
      text: generateNarrative("INNING_END", ctx),
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      outs: state.outs,
      runnersOn: "000",
      batterId: null,
      pitcherId: currentPitcherState?.player.id ?? null,
    });

    // Save lineup position
    if (isTop) awayLineupIdx = lineupIdxRef.v;
    else homeLineupIdx = lineupIdxRef.v;

    // Flip half-inning
    if (isTop) {
      state.isTop = false;
    } else {
      state.isTop = true;
      state.inning++;
    }
  }

  // Game end narrative
  const finalCtx: NarrativeContext = {
    batterName: "",
    pitcherName: "",
    inning: state.inning,
    isTop: state.isTop,
    outs: state.outs,
    runnersOn: "000",
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
  };
  state.log.push({
    inning: state.inning,
    isTop: state.isTop,
    sequence: state.sequence++,
    eventType: "GAME_END",
    text: generateNarrative("GAME_END", finalCtx),
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    outs: state.outs,
    runnersOn: "000",
    batterId: null,
    pitcherId: null,
  });

  // Assign W/L/S
  const winnerState = getWinningPitcher();
  const loserState = getLosingPitcher();
  const saveState = getSavePitcher();

  if (winnerState) {
    if (saveState && saveState.player.id !== winnerState.player.id) {
      saveState.earnedRuns; // no-op reference to keep the object
    }
  }

  // Build pitcher box scores
  const buildPitcherBoxScores = (states: PitcherState[]): PitcherBoxScore[] => {
    return states.map((ps, idx) => {
      const isWinner = winnerState?.player.id === ps.player.id;
      const isLoser = loserState?.player.id === ps.player.id;
      const isSave = saveState?.player.id === ps.player.id && !isWinner;
      return {
        playerId: ps.player.id,
        isStarter: ps.isStarter,
        outsPitched: ps.outsPitched,
        hitsAllowed: 0, // tallied from log — simplified here
        earnedRuns: ps.earnedRuns,
        walksAllowed: 0,
        strikeouts: 0,
        homeRunsAllowed: 0,
        win: isWinner && !isSave,
        loss: isLoser,
        save: isSave,
        holdEarned: !isWinner && !isLoser && !isSave && idx < states.length - 1,
      };
    });
  };

  // Tally pitcher stats from log
  const tallyPitcherStats = (
    states: PitcherState[],
    boxScores: PitcherBoxScore[]
  ) => {
    for (const entry of state.log) {
      if (!entry.pitcherId) continue;
      const idx = states.findIndex((ps) => ps.player.id === entry.pitcherId);
      if (idx < 0) continue;
      const bs = boxScores[idx];
      if (!bs) continue;
      if (entry.eventType === "SINGLE") { bs.hitsAllowed++; }
      if (entry.eventType === "DOUBLE") { bs.hitsAllowed++; }
      if (entry.eventType === "TRIPLE") { bs.hitsAllowed++; }
      if (entry.eventType === "HOME_RUN") { bs.hitsAllowed++; bs.homeRunsAllowed++; }
      if (entry.eventType === "WALK") bs.walksAllowed++;
      if (entry.eventType === "STRIKEOUT") bs.strikeouts++;
    }
  };

  const homePitcherBoxScores = buildPitcherBoxScores(homePitcherStates);
  const awayPitcherBoxScores = buildPitcherBoxScores(awayPitcherStates);
  tallyPitcherStats(homePitcherStates, homePitcherBoxScores);
  tallyPitcherStats(awayPitcherStates, awayPitcherBoxScores);

  return {
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    inningsPlayed: state.inning,
    log: state.log,
    homeBatters: Array.from(homeBatters.values()),
    awayBatters: Array.from(awayBatters.values()),
    homePitchers: homePitcherBoxScores,
    awayPitchers: awayPitcherBoxScores,
  };
}
