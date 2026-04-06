import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const teamRouter = createTRPCRouter({
  /**
   * Get full team roster with contracts and current ratings.
   */
  getRoster: publicProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contracts = await ctx.db.contract.findMany({
        where: { teamId: input.teamId, isActive: true },
        include: { player: true },
        orderBy: [{ rosterStatus: "asc" }, { player: { position: "asc" } }],
      });

      const team = await ctx.db.team.findUniqueOrThrow({
        where: { id: input.teamId },
      });

      // Compute current payroll
      const activePayroll = contracts
        .filter((c) => c.isActive)
        .reduce((sum, c) => sum + c.salary, 0);

      return { team, contracts, activePayroll };
    }),

  /**
   * Get team payroll details vs. league salary cap.
   */
  getFinancials: publicProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUniqueOrThrow({
        where: { id: input.teamId },
        include: { league: true },
      });

      const contracts = await ctx.db.contract.findMany({
        where: { teamId: input.teamId, isActive: true },
        include: { player: { select: { firstName: true, lastName: true, position: true } } },
        orderBy: { salary: "desc" },
      });

      const payroll = contracts.reduce((sum, c) => sum + c.salary, 0);
      const cap = team.league.salaryCap;
      const luxuryThreshold = team.league.luxuryTaxThreshold;
      const luxuryOwed =
        payroll > luxuryThreshold
          ? Math.round((payroll - luxuryThreshold) * team.league.luxuryTaxRate)
          : 0;
      const capSpace = cap - payroll;

      return {
        team,
        contracts,
        payroll,
        cap,
        capSpace,
        luxuryThreshold,
        luxuryOwed,
        overLuxury: payroll > luxuryThreshold,
        overCap: payroll > cap,
      };
    }),

  /**
   * Get season stats for all players on a team.
   */
  getSeasonStats: publicProcedure
    .input(z.object({ teamId: z.string(), seasonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const batting = await ctx.db.batterSeasonStat.findMany({
        where: { teamId: input.teamId, seasonId: input.seasonId },
        include: { player: true },
        orderBy: { ops: "desc" },
      });

      const pitching = await ctx.db.pitcherSeasonStat.findMany({
        where: { teamId: input.teamId, seasonId: input.seasonId },
        include: { player: true },
        orderBy: { era: "asc" },
      });

      return { batting, pitching };
    }),
});
