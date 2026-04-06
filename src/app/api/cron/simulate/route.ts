import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { simulateGame, type SimTeam } from "@/server/services/gameSimulator";
import { getCurrentGameWindow } from "@/server/services/seasonScheduler";

/**
 * POST /api/cron/simulate
 *
 * Called by Railway cron at 11am, 2pm, 5pm, and 8pm ET.
 * Simulates all games scheduled within ±30 minutes of the current time.
 *
 * Protected by a bearer token matching the CRON_SECRET env var.
 */
export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { start, end } = getCurrentGameWindow(now);

  // Find all scheduled games in the current window
  const games = await db.game.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: start, lte: end },
    },
    include: {
      homeTeam: {
        include: {
          contracts: {
            where: { isActive: true, rosterStatus: "ACTIVE" },
            include: { player: true },
          },
        },
      },
      awayTeam: {
        include: {
          contracts: {
            where: { isActive: true, rosterStatus: "ACTIVE" },
            include: { player: true },
          },
        },
      },
    },
  });

  if (games.length === 0) {
    return NextResponse.json({ simulated: 0, message: "No games in window" });
  }

  const results: { gameId: string; score: string; error?: string }[] = [];

  for (const game of games) {
    try {
      const toSimTeam = (team: typeof game.homeTeam): SimTeam => ({
        id: team.id,
        name: team.name,
        city: team.city,
        players: team.contracts.map((c) => ({
          id: c.player.id,
          firstName: c.player.firstName,
          lastName: c.player.lastName,
          position: c.player.position,
          contact: c.player.contact,
          power: c.player.power,
          eye: c.player.eye,
          speed: c.player.speed,
          velocity: c.player.velocity,
          movement: c.player.movement,
          control: c.player.control,
          stamina: c.player.stamina,
          glove: c.player.glove,
          arm: c.player.arm,
          clutch: c.player.clutch,
          durability: c.player.durability,
        })),
      });

      const result = simulateGame(toSimTeam(game.homeTeam), toSimTeam(game.awayTeam));

      await db.$transaction(async (tx) => {
        await tx.game.update({
          where: { id: game.id },
          data: {
            status: "COMPLETED",
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            inningsPlayed: result.inningsPlayed,
            simulatedAt: now,
          },
        });

        await tx.gameLog.createMany({
          data: result.log.map((entry) => ({
            gameId: game.id,
            inning: entry.inning,
            isTop: entry.isTop,
            sequence: entry.sequence,
            eventType: entry.eventType as any,
            text: entry.text,
            homeScore: entry.homeScore,
            awayScore: entry.awayScore,
            outs: entry.outs,
            runnersOn: entry.runnersOn,
            batterId: entry.batterId,
            pitcherId: entry.pitcherId,
          })),
        });

        await tx.batterGameStat.createMany({
          data: [
            ...result.homeBatters.map((b) => ({
              ...b,
              gameId: game.id,
              teamId: game.homeTeamId,
            })),
            ...result.awayBatters.map((b) => ({
              ...b,
              gameId: game.id,
              teamId: game.awayTeamId,
            })),
          ],
        });

        await tx.pitcherGameStat.createMany({
          data: [
            ...result.homePitchers.map((p) => ({
              ...p,
              gameId: game.id,
              teamId: game.homeTeamId,
            })),
            ...result.awayPitchers.map((p) => ({
              ...p,
              gameId: game.id,
              teamId: game.awayTeamId,
            })),
          ],
        });

        // Update standings
        const homeWin = result.homeScore > result.awayScore;
        const seasonId = game.seasonId;

        await tx.teamStanding.updateMany({
          where: { teamId: game.homeTeamId, seasonId },
          data: {
            wins: { increment: homeWin ? 1 : 0 },
            losses: { increment: homeWin ? 0 : 1 },
            runsScored: { increment: result.homeScore },
            runsAllowed: { increment: result.awayScore },
          },
        });

        await tx.teamStanding.updateMany({
          where: { teamId: game.awayTeamId, seasonId },
          data: {
            wins: { increment: homeWin ? 0 : 1 },
            losses: { increment: homeWin ? 1 : 0 },
            runsScored: { increment: result.awayScore },
            runsAllowed: { increment: result.homeScore },
          },
        });
      });

      results.push({
        gameId: game.id,
        score: `${game.awayTeam.city} ${result.awayScore}, ${game.homeTeam.city} ${result.homeScore}`,
      });
    } catch (err) {
      console.error(`Error simulating game ${game.id}:`, err);
      results.push({
        gameId: game.id,
        score: "ERROR",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    simulated: results.filter((r) => !r.error).length,
    errors: results.filter((r) => r.error).length,
    results,
  });
}
