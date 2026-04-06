import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { generateLeague } from "../services/leagueGenerator";
import { buildSeasonSchedule, nextMonday } from "../services/seasonScheduler";

export const leagueRouter = createTRPCRouter({
  /**
   * Return all basic league + team info.
   */
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.league.findMany({
      include: {
        teams: {
          select: {
            id: true,
            name: true,
            city: true,
            abbreviation: true,
            primaryColor: true,
            secondaryColor: true,
            isUserTeam: true,
            budget: true,
          },
        },
      },
    });
  }),

  /**
   * Get a single league with current standings.
   */
  getWithStandings: publicProcedure
    .input(z.object({ leagueId: z.string() }))
    .query(async ({ ctx, input }) => {
      const league = await ctx.db.league.findUniqueOrThrow({
        where: { id: input.leagueId },
        include: { teams: true },
      });

      const currentSeason = await ctx.db.season.findFirst({
        where: { leagueId: input.leagueId },
        orderBy: { year: "desc" },
        include: {
          standings: {
            include: { team: true },
            orderBy: { wins: "desc" },
          },
        },
      });

      return { league, currentSeason };
    }),

  /**
   * Bootstrap: create a new league with generated teams + season schedule.
   * Called once when the user starts a new game.
   */
  createNew: publicProcedure
    .input(
      z.object({
        leagueName: z.string().min(2).max(60),
        userTeamName: z.string().min(2).max(40),
        userTeamCity: z.string().min(2).max(40),
        userTeamAbbreviation: z.string().min(2).max(3),
        userTeamPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        userTeamSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentYear = 1;
      const generatedTeams = generateLeague(currentYear);

      return ctx.db.$transaction(async (tx) => {
        // Create league
        const league = await tx.league.create({
          data: { name: input.leagueName, currentYear },
        });

        // Create season
        const season = await tx.season.create({
          data: { leagueId: league.id, year: currentYear, status: "OFFSEASON" },
        });

        // Create all 16 teams + rosters
        const teamIds: string[] = [];

        for (let i = 0; i < generatedTeams.length; i++) {
          const genTeam = generatedTeams[i];
          const isUser = i === 0; // first team is user's team

          const teamData = isUser
            ? {
                name: input.userTeamName,
                city: input.userTeamCity,
                abbreviation: input.userTeamAbbreviation.toUpperCase(),
                primaryColor: input.userTeamPrimaryColor,
                secondaryColor: input.userTeamSecondaryColor,
                logoSeed: `${input.userTeamAbbreviation}-user`,
              }
            : {
                name: genTeam.name,
                city: genTeam.city,
                abbreviation: genTeam.abbreviation,
                primaryColor: genTeam.primaryColor,
                secondaryColor: genTeam.secondaryColor,
                logoSeed: genTeam.logoSeed,
              };

          const team = await tx.team.create({
            data: {
              ...teamData,
              leagueId: league.id,
              isUserTeam: isUser,
            },
          });
          teamIds.push(team.id);

          // Create standings row
          await tx.teamStanding.create({
            data: { teamId: team.id, seasonId: season.id },
          });

          // Create players + contracts
          for (const genPlayer of genTeam.roster) {
            const player = await tx.player.create({
              data: {
                firstName: genPlayer.firstName,
                lastName: genPlayer.lastName,
                position: genPlayer.position,
                birthYear: genPlayer.birthYear,
                bats: genPlayer.bats,
                throws: genPlayer.throws,
                potential: genPlayer.potential,
                contact: genPlayer.contact,
                power: genPlayer.power,
                eye: genPlayer.eye,
                speed: genPlayer.speed,
                velocity: genPlayer.velocity,
                movement: genPlayer.movement,
                control: genPlayer.control,
                stamina: genPlayer.stamina,
                glove: genPlayer.glove,
                arm: genPlayer.arm,
                clutch: genPlayer.clutch,
                durability: genPlayer.durability,
                coachability: genPlayer.coachability,
                developmentStage: genPlayer.developmentStage,
              },
            });

            // Rating snapshot for season 1
            await tx.playerRatingSnapshot.create({
              data: {
                playerId: player.id,
                seasonYear: currentYear,
                contact: genPlayer.contact,
                power: genPlayer.power,
                eye: genPlayer.eye,
                speed: genPlayer.speed,
                velocity: genPlayer.velocity,
                movement: genPlayer.movement,
                control: genPlayer.control,
                stamina: genPlayer.stamina,
                glove: genPlayer.glove,
                arm: genPlayer.arm,
                clutch: genPlayer.clutch,
                durability: genPlayer.durability,
                coachability: genPlayer.coachability,
                developmentStage: genPlayer.developmentStage,
              },
            });

            await tx.contract.create({
              data: {
                playerId: player.id,
                teamId: team.id,
                salary: genPlayer.salary,
                yearsTotal: genPlayer.isProspect ? 7 : 1,
                yearsRemaining: genPlayer.isProspect ? 7 : 1,
                rosterStatus: genPlayer.isProspect ? "MINORS" : "ACTIVE",
                isProspect: genPlayer.isProspect,
                acquiredVia: "DRAFT",
              },
            });
          }
        }

        // Build and insert the 162-game schedule
        const startDate = nextMonday(new Date());
        const scheduledGames = buildSeasonSchedule(teamIds, currentYear, startDate);

        await tx.game.createMany({
          data: scheduledGames.map((g) => ({
            seasonId: season.id,
            homeTeamId: g.homeTeamId,
            awayTeamId: g.awayTeamId,
            scheduledAt: g.scheduledAt,
            status: "SCHEDULED",
          })),
        });

        // Transition season to active
        await tx.season.update({
          where: { id: season.id },
          data: { status: "IN_PROGRESS" },
        });

        return { leagueId: league.id, seasonId: season.id };
      });
    }),
});
