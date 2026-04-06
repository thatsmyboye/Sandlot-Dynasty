import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const playerRouter = createTRPCRouter({
  /**
   * Get a player profile with full career stats and rating history.
   */
  getProfile: publicProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUniqueOrThrow({
        where: { id: input.playerId },
        include: {
          contracts: {
            where: { isActive: true },
            include: { team: true },
          },
          ratingHistory: { orderBy: { seasonYear: "asc" } },
          batterSeasonStats: {
            include: { season: true },
            orderBy: { season: { year: "asc" } },
          },
          pitcherSeasonStats: {
            include: { season: true },
            orderBy: { season: { year: "asc" } },
          },
          awards: {
            include: { season: true },
          },
        },
      });
      return player;
    }),

  /**
   * League-wide leaderboard — batting.
   */
  getBattingLeaders: publicProcedure
    .input(
      z.object({
        seasonId: z.string(),
        stat: z.enum(["avg", "homeRuns", "rbi", "ops", "stolenBases"]),
        limit: z.number().min(1).max(50).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const orderBy = { [input.stat]: "desc" as const };
      return ctx.db.batterSeasonStat.findMany({
        where: {
          seasonId: input.seasonId,
          atBats: { gte: 50 }, // minimum PA filter
        },
        include: {
          player: { select: { firstName: true, lastName: true, position: true } },
        },
        orderBy,
        take: input.limit,
      });
    }),

  /**
   * League-wide leaderboard — pitching.
   */
  getPitchingLeaders: publicProcedure
    .input(
      z.object({
        seasonId: z.string(),
        stat: z.enum(["era", "strikeouts", "wins", "whip", "saves"]),
        limit: z.number().min(1).max(50).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const orderBy =
        input.stat === "era" || input.stat === "whip"
          ? { [input.stat]: "asc" as const }
          : { [input.stat]: "desc" as const };

      return ctx.db.pitcherSeasonStat.findMany({
        where: {
          seasonId: input.seasonId,
          outsPitched: { gte: 27 }, // 9 IP minimum
        },
        include: {
          player: { select: { firstName: true, lastName: true, position: true } },
        },
        orderBy,
        take: input.limit,
      });
    }),
});
