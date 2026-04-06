import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { simulateGame, type SimTeam } from "../services/gameSimulator";
import { getCurrentGameWindow } from "../services/seasonScheduler";

export const gameRouter = createTRPCRouter({
  /**
   * Get a single completed game with full play-by-play log and box score.
   */
  getById: publicProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const game = await ctx.db.game.findUniqueOrThrow({
        where: { id: input.gameId },
        include: {
          homeTeam: true,
          awayTeam: true,
          log: {
            orderBy: [{ inning: "asc" }, { sequence: "asc" }],
          },
          batterStats: {
            include: { player: true },
            orderBy: { lineupSlot: "asc" },
          },
          pitcherStats: {
            include: { player: true },
          },
        },
      });
      return game;
    }),

  /**
   * Get the schedule for a team — upcoming + recent games.
   */
  getTeamSchedule: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const upcoming = await ctx.db.game.findMany({
        where: {
          OR: [{ homeTeamId: input.teamId }, { awayTeamId: input.teamId }],
          status: "SCHEDULED",
        },
        orderBy: { scheduledAt: "asc" },
        take: input.limit,
        include: { homeTeam: true, awayTeam: true },
      });

      const recent = await ctx.db.game.findMany({
        where: {
          OR: [{ homeTeamId: input.teamId }, { awayTeamId: input.teamId }],
          status: "COMPLETED",
        },
        orderBy: { scheduledAt: "desc" },
        take: 10,
        include: { homeTeam: true, awayTeam: true },
      });

      return { upcoming, recent };
    }),

  /**
   * Get today's full league scoreboard (all games scheduled for ±12h of now).
   */
  getScoreboard: publicProcedure
    .input(z.object({ seasonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const end = new Date(now.getTime() + 12 * 60 * 60 * 1000);

      return ctx.db.game.findMany({
        where: {
          seasonId: input.seasonId,
          scheduledAt: { gte: start, lte: end },
        },
        orderBy: { scheduledAt: "asc" },
        include: { homeTeam: true, awayTeam: true },
      });
    }),

  /**
   * Manually trigger simulation of a single game (dev/testing only).
   * In production, the cron endpoint handles this.
   */
  simulateSingle: publicProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db.game.findUniqueOrThrow({
        where: { id: input.gameId },
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

      if (game.status === "COMPLETED") {
        throw new Error("Game already completed");
      }

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

      await ctx.db.$transaction(async (tx) => {
        // Update game record
        await tx.game.update({
          where: { id: input.gameId },
          data: {
            status: "COMPLETED",
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            inningsPlayed: result.inningsPlayed,
            simulatedAt: new Date(),
          },
        });

        // Insert play-by-play log
        await tx.gameLog.createMany({
          data: result.log.map((entry) => ({
            gameId: input.gameId,
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

        // Insert batter box scores
        await tx.batterGameStat.createMany({
          data: [
            ...result.homeBatters.map((b) => ({ ...b, gameId: input.gameId, teamId: game.homeTeamId })),
            ...result.awayBatters.map((b) => ({ ...b, gameId: input.gameId, teamId: game.awayTeamId })),
          ],
        });

        // Insert pitcher box scores
        await tx.pitcherGameStat.createMany({
          data: [
            ...result.homePitchers.map((p) => ({ ...p, gameId: input.gameId, teamId: game.homeTeamId })),
            ...result.awayPitchers.map((p) => ({ ...p, gameId: input.gameId, teamId: game.awayTeamId })),
          ],
        });

        // Update standings
        const homeWin = result.homeScore > result.awayScore;
        await tx.teamStanding.updateMany({
          where: {
            teamId: game.homeTeamId,
            season: { games: { some: { id: input.gameId } } },
          },
          data: {
            wins: { increment: homeWin ? 1 : 0 },
            losses: { increment: homeWin ? 0 : 1 },
            runsScored: { increment: result.homeScore },
            runsAllowed: { increment: result.awayScore },
          },
        });
        await tx.teamStanding.updateMany({
          where: {
            teamId: game.awayTeamId,
            season: { games: { some: { id: input.gameId } } },
          },
          data: {
            wins: { increment: homeWin ? 0 : 1 },
            losses: { increment: homeWin ? 1 : 0 },
            runsScored: { increment: result.awayScore },
            runsAllowed: { increment: result.homeScore },
          },
        });

        // Upsert season batting stats
        for (const batter of [...result.homeBatters, ...result.awayBatters]) {
          const teamId = result.homeBatters.includes(batter) ? game.homeTeamId : game.awayTeamId;
          const existing = await tx.batterSeasonStat.findFirst({
            where: { playerId: batter.playerId, season: { games: { some: { id: input.gameId } } } },
          });

          if (existing) {
            const newAB = existing.atBats + batter.atBats;
            const newH = existing.hits + batter.hits;
            const newTB =
              (existing.hits - existing.doubles - existing.triples - existing.homeRuns) +
              (batter.hits - batter.doubles - batter.triples - batter.homeRuns) +
              (existing.doubles + batter.doubles) * 2 +
              (existing.triples + batter.triples) * 3 +
              (existing.homeRuns + batter.homeRuns) * 4;
            const newWalks = existing.walks + batter.walks;
            const newPA = newAB + newWalks;

            await tx.batterSeasonStat.update({
              where: { id: existing.id },
              data: {
                games: { increment: 1 },
                atBats: { increment: batter.atBats },
                hits: { increment: batter.hits },
                doubles: { increment: batter.doubles },
                triples: { increment: batter.triples },
                homeRuns: { increment: batter.homeRuns },
                rbi: { increment: batter.rbi },
                walks: { increment: batter.walks },
                strikeouts: { increment: batter.strikeouts },
                runs: { increment: batter.runs },
                stolenBases: { increment: batter.stolenBases },
                caughtStealing: { increment: batter.caughtStealing },
                avg: newAB > 0 ? newH / newAB : 0,
                obp: newPA > 0 ? (newH + newWalks) / newPA : 0,
                slg: newAB > 0 ? newTB / newAB : 0,
                ops: newPA > 0 && newAB > 0
                  ? (newH + newWalks) / newPA + newTB / newAB
                  : 0,
              },
            });
          } else {
            const tb =
              (batter.hits - batter.doubles - batter.triples - batter.homeRuns) +
              batter.doubles * 2 + batter.triples * 3 + batter.homeRuns * 4;
            const pa = batter.atBats + batter.walks;
            await tx.batterSeasonStat.create({
              data: {
                playerId: batter.playerId,
                seasonId: game.seasonId,
                teamId,
                games: 1,
                atBats: batter.atBats,
                hits: batter.hits,
                doubles: batter.doubles,
                triples: batter.triples,
                homeRuns: batter.homeRuns,
                rbi: batter.rbi,
                walks: batter.walks,
                strikeouts: batter.strikeouts,
                runs: batter.runs,
                stolenBases: batter.stolenBases,
                caughtStealing: batter.caughtStealing,
                avg: batter.atBats > 0 ? batter.hits / batter.atBats : 0,
                obp: pa > 0 ? (batter.hits + batter.walks) / pa : 0,
                slg: batter.atBats > 0 ? tb / batter.atBats : 0,
                ops: pa > 0 && batter.atBats > 0
                  ? (batter.hits + batter.walks) / pa + tb / batter.atBats
                  : 0,
              },
            });
          }
        }

        // Upsert season pitching stats
        for (const pitcher of [...result.homePitchers, ...result.awayPitchers]) {
          const teamId = result.homePitchers.includes(pitcher) ? game.homeTeamId : game.awayTeamId;
          const existing = await tx.pitcherSeasonStat.findFirst({
            where: { playerId: pitcher.playerId, season: { games: { some: { id: input.gameId } } } },
          });

          const ip = pitcher.outsPitched;
          if (existing) {
            const totalOuts = existing.outsPitched + ip;
            const totalER = existing.earnedRuns + pitcher.earnedRuns;
            const totalBB = existing.walksAllowed + pitcher.walksAllowed;
            const totalH = existing.hitsAllowed + pitcher.hitsAllowed;
            const inningsFull = totalOuts / 3;
            await tx.pitcherSeasonStat.update({
              where: { id: existing.id },
              data: {
                games: { increment: 1 },
                gamesStarted: { increment: pitcher.isStarter ? 1 : 0 },
                outsPitched: { increment: ip },
                hitsAllowed: { increment: pitcher.hitsAllowed },
                earnedRuns: { increment: pitcher.earnedRuns },
                walksAllowed: { increment: pitcher.walksAllowed },
                strikeouts: { increment: pitcher.strikeouts },
                homeRunsAllowed: { increment: pitcher.homeRunsAllowed },
                wins: { increment: pitcher.win ? 1 : 0 },
                losses: { increment: pitcher.loss ? 1 : 0 },
                saves: { increment: pitcher.save ? 1 : 0 },
                holds: { increment: pitcher.holdEarned ? 1 : 0 },
                era: inningsFull > 0 ? (totalER * 9) / inningsFull : 0,
                whip: inningsFull > 0 ? (totalBB + totalH) / inningsFull : 0,
              },
            });
          } else {
            const inningsFull = ip / 3;
            await tx.pitcherSeasonStat.create({
              data: {
                playerId: pitcher.playerId,
                seasonId: game.seasonId,
                teamId,
                games: 1,
                gamesStarted: pitcher.isStarter ? 1 : 0,
                outsPitched: ip,
                hitsAllowed: pitcher.hitsAllowed,
                earnedRuns: pitcher.earnedRuns,
                walksAllowed: pitcher.walksAllowed,
                strikeouts: pitcher.strikeouts,
                homeRunsAllowed: pitcher.homeRunsAllowed,
                wins: pitcher.win ? 1 : 0,
                losses: pitcher.loss ? 1 : 0,
                saves: pitcher.save ? 1 : 0,
                holds: pitcher.holdEarned ? 1 : 0,
                era: inningsFull > 0 ? (pitcher.earnedRuns * 9) / inningsFull : 0,
                whip:
                  inningsFull > 0
                    ? (pitcher.walksAllowed + pitcher.hitsAllowed) / inningsFull
                    : 0,
              },
            });
          }
        }
      });

      return {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        inningsPlayed: result.inningsPlayed,
        logEntries: result.log.length,
      };
    }),
});
