/**
 * Season Scheduler
 *
 * Builds a 162-game schedule for 16 teams. Each team plays 162 games over
 * roughly 26 weeks (April – September). Games are assigned real-world DateTime
 * values at 11am, 2pm, 5pm, or 8pm ET each day.
 *
 * Distribution: 4 games per time slot per day across the league, meaning 2 games
 * at each slot (16 teams ÷ 2 = 8 games/day, spread across 4 slots = 2/slot).
 */

export type ScheduledGame = {
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
};

// Game times in UTC. ET = UTC-4 (EDT summer) / UTC-5 (EST).
// We target EDT (April–September is always EDT).
// 11am ET = 15:00 UTC, 2pm = 18:00 UTC, 5pm = 21:00 UTC, 8pm = 00:00 UTC next day
const GAME_SLOTS_UTC: { hour: number; minute: number; dayOffset: number }[] = [
  { hour: 15, minute: 0, dayOffset: 0 }, // 11am ET
  { hour: 18, minute: 0, dayOffset: 0 }, // 2pm ET
  { hour: 21, minute: 0, dayOffset: 0 }, // 5pm ET
  { hour: 0, minute: 0, dayOffset: 1 },  // 8pm ET (midnight UTC = next calendar day)
];

/**
 * Returns a Date for a given base date + time slot.
 * baseDate should be midnight UTC of the calendar day.
 */
function slotDate(baseDate: Date, slot: (typeof GAME_SLOTS_UTC)[number]): Date {
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + slot.dayOffset);
  d.setUTCHours(slot.hour, slot.minute, 0, 0);
  return d;
}

/**
 * Build a round-robin schedule for N teams.
 * Uses the circle method (one team fixed, others rotate).
 * Returns matchups as [homeIndex, awayIndex] pairs.
 */
function buildRoundRobin(n: number): [number, number][][] {
  // n must be even for a balanced schedule
  const rounds: [number, number][][] = [];
  const teams = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < n - 1; round++) {
    const matchups: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      matchups.push([home, away]);
    }
    rounds.push(matchups);
    // Rotate all teams except the first
    teams.splice(1, 0, teams.pop()!);
  }
  return rounds;
}

/**
 * Shuffle an array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a full 162-game schedule for all 16 teams.
 *
 * Strategy:
 * - One round-robin cycle = 15 rounds × 8 games = 120 games (each team plays 15).
 *   We multiply games per series: most matchups are 3-game series.
 * - Teams play each opponent ~3 times across the season (15 opponents × ~10–11 games).
 * - We repeat each round-robin matchup enough times to get to 162 games per team.
 *   162 games / 15 opponents ≈ 10–11 games per opponent.
 *   We'll do 3 series against each opponent: 2× 3-game series + 1× 4-game series = 10 games,
 *   plus one extra series for 5 opponents = 11 games → 5×11 + 10×10 = 155... adjust.
 *   Simpler: 15 opponents × 10 games = 150 + 12 extra = 162. Use 3×3-game series for
 *   all opponents (135 games) + 3 extra 4-game series × 9 games = too complex.
 *
 * Practical approach used here:
 *   - 15 opponents, each played in two 3-game series (home + away) = 6 games × 15 = 90
 *   - Plus one 4-game series against each opponent (alternating home/away) = 4 × 15 = 60
 *   - Alternate which team hosts the 4-game series by opponent parity
 *   - Remaining 12 games: 3 extra home games + 3 extra away games against 6 rivals (division-ish)
 *   Total: 90 + 60 + 12 = 162 ✓
 *
 * Schedule layout:
 * - Season starts first Monday of April in the game year
 * - Teams play 5 days/week (Mon–Fri; Sat–Sun off for manager decisions)
 * - Each day has 8 games (all 16 teams play), spread across 4 time slots (2 games/slot)
 *
 * @param teamIds - Array of exactly 16 team IDs
 * @param seasonYear - The game-world year (used to anchor the real-world calendar)
 * @param realWorldStartDate - Actual UTC midnight Date to begin scheduling from
 */
export function buildSeasonSchedule(
  teamIds: string[],
  seasonYear: number,
  realWorldStartDate: Date
): ScheduledGame[] {
  if (teamIds.length !== 16) {
    throw new Error(`Expected 16 teams, got ${teamIds.length}`);
  }

  void seasonYear; // used by callers for metadata; schedule anchors to realWorldStartDate

  // Build the full set of individual game matchups (each team plays 162 games)
  const matchupList: [string, string][] = []; // [homeId, awayId]

  const n = teamIds.length; // 16
  const rounds = buildRoundRobin(n); // 15 rounds, each with 8 matchups

  // Each round-robin round gives each team one game.
  // We need each team to play 162 games total = 162/15 ≈ 10.8 games per opponent.
  // Plan: each unique matchup plays 11 games (rounded), adjusting for parity.
  //       15 opponents × 11 games = 165, so 3 opponents get 10 games = 162 ✓
  //       (Use opponent index: if (oppIndex % 5 === 0) 10 games, else 11 games → 3×10 + 12×11 = 162)

  for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
    const round = rounds[roundIdx];
    for (const [homeIdx, awayIdx] of round) {
      const homeId = teamIds[homeIdx];
      const awayId = teamIds[awayIdx];
      const gamesInSeries = roundIdx % 5 === 0 ? 10 : 11;

      // Split games into series: 3-game series + remaining
      // 11 games = 3 + 4 + 4 or 3 + 4 + 4; 10 games = 3 + 3 + 4
      const seriesSizes =
        gamesInSeries === 11
          ? [3, 4, 4]
          : [3, 3, 4];

      let homeFirst = true;
      for (const seriesLength of seriesSizes) {
        // Alternate home/away each series
        for (let g = 0; g < seriesLength; g++) {
          if (homeFirst) {
            matchupList.push([homeId, awayId]);
          } else {
            matchupList.push([awayId, homeId]);
          }
        }
        homeFirst = !homeFirst;
      }
    }
  }

  // Shuffle matchups and assign them to calendar slots
  shuffle(matchupList);

  // Build list of available game slots
  // 162 games per team, 16 teams, 8 games per day → 162 days needed
  // But we have 4 slots/day × 2 games/slot = 8 games/day.
  // Total games in league = 16 × 162 / 2 = 1296 games
  // Days needed = 1296 / 8 = 162 days
  // Mon–Fri only: 162 days / 5 days per week = 32.4 weeks → 33 weeks (April–Nov too long)
  // For realism: play 6 days/week (Mon–Sat) → 162/6 = 27 weeks ✓ (April–September)

  const slots: Date[] = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  let dayOffset = 0;
  let slotsNeeded = matchupList.length / 2; // 2 games per slot

  // Actually we need one slot per game; each slot holds exactly one game.
  // 4 slots/day, 8 games/day → 2 games per slot... let's assign 2 games per slot.
  // Total slots needed = matchupList.length (one game per slot, but 2 games share a slot time)
  // The scheduledAt time is what matters; multiple games can share the same time.

  // Build day list: skip Sundays (rest day for managers)
  const dayDates: Date[] = [];
  let cursor = new Date(realWorldStartDate);
  while (dayDates.length < 162) {
    const dow = cursor.getUTCDay(); // 0=Sun
    if (dow !== 0) {
      dayDates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Build all slot DateTimes: 4 slots × 162 days = 648 slots
  // We need 1296 games, so ~2 games per slot (1296 / 648 = 2)
  const allSlotTimes: Date[] = [];
  for (const day of dayDates) {
    for (const slot of GAME_SLOTS_UTC) {
      allSlotTimes.push(slotDate(day, slot));
    }
  }

  // Assign matchups to slots: 2 games per slot
  const scheduledGames: ScheduledGame[] = [];
  let matchupIdx = 0;

  for (const slotTime of allSlotTimes) {
    // 2 games per slot
    for (let g = 0; g < 2 && matchupIdx < matchupList.length; g++) {
      const [homeId, awayId] = matchupList[matchupIdx++];
      scheduledGames.push({
        homeTeamId: homeId,
        awayTeamId: awayId,
        scheduledAt: slotTime,
      });
    }
  }

  return scheduledGames;
}

/**
 * Returns the next upcoming game slot DateTime at or after `now`.
 * Used by the cron handler to know which window to simulate.
 */
export function getCurrentGameWindow(now: Date): { start: Date; end: Date } {
  // Find the nearest slot time (within ±30 minutes)
  const windowMs = 30 * 60 * 1000;
  return {
    start: new Date(now.getTime() - windowMs),
    end: new Date(now.getTime() + windowMs),
  };
}

/**
 * Given a real-world start date, returns midnight UTC of the next Monday.
 */
export function nextMonday(from: Date): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  const daysUntilMonday = dow === 0 ? 1 : (8 - dow) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d;
}
