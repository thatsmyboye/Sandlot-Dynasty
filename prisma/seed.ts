/**
 * Database seed script.
 *
 * Run with: npm run db:seed
 *
 * Creates a complete Season 1:
 *   - 1 league
 *   - 16 teams (all AI-controlled by default)
 *   - 35 players per team (25 active roster + 10 prospects)
 *   - Full 162-game schedule with real-world timestamps
 *   - Standing rows for all teams
 *   - Draft pick rows for Round 1-5
 */

import { PrismaClient } from "@prisma/client";
import { generateLeague } from "../src/server/services/leagueGenerator";
import { buildSeasonSchedule, nextMonday } from "../src/server/services/seasonScheduler";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Check if already seeded
  const existing = await db.league.count();
  if (existing > 0) {
    console.log("Database already seeded. Run `prisma migrate reset` to start fresh.");
    return;
  }

  const currentYear = 1;

  // Create league
  const league = await db.league.create({
    data: {
      name: "Sandlot Dynasty League",
      currentYear,
      salaryCap: 150_000,
      luxuryTaxThreshold: 185_000,
      luxuryTaxRate: 0.5,
      minSalary: 720,
      maxSalary: 40_000,
    },
  });
  console.log(`Created league: ${league.name} (${league.id})`);

  // Create season
  const season = await db.season.create({
    data: { leagueId: league.id, year: currentYear, status: "OFFSEASON" },
  });
  console.log(`Created Season ${currentYear}`);

  // Generate all 16 teams
  const generatedTeams = generateLeague(currentYear);
  const teamIds: string[] = [];
  let totalPlayers = 0;

  for (const genTeam of generatedTeams) {
    const team = await db.team.create({
      data: {
        leagueId: league.id,
        name: genTeam.name,
        city: genTeam.city,
        abbreviation: genTeam.abbreviation,
        primaryColor: genTeam.primaryColor,
        secondaryColor: genTeam.secondaryColor,
        logoSeed: genTeam.logoSeed,
        isUserTeam: false,
        budget: 150_000,
      },
    });
    teamIds.push(team.id);

    // Standing row
    await db.teamStanding.create({
      data: { teamId: team.id, seasonId: season.id },
    });

    // Players + contracts
    for (const genPlayer of genTeam.roster) {
      const player = await db.player.create({
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

      // Rating snapshot
      await db.playerRatingSnapshot.create({
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

      await db.contract.create({
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
      totalPlayers++;
    }

    process.stdout.write(`  Created ${team.city} ${team.name} (${genTeam.roster.length} players)\n`);
  }

  // Draft picks (5 rounds × 16 teams = 80 picks)
  const draftPickData = [];
  for (let round = 1; round <= 5; round++) {
    for (let pick = 1; pick <= 16; pick++) {
      const overallPick = (round - 1) * 16 + pick;
      const teamIdx = pick - 1;
      draftPickData.push({
        seasonId: season.id,
        round,
        pickNumber: overallPick,
        originalTeamId: teamIds[teamIdx],
        currentTeamId: teamIds[teamIdx],
      });
    }
  }
  await db.draftPick.createMany({ data: draftPickData });
  console.log(`Created ${draftPickData.length} draft picks`);

  // Build 162-game schedule
  const startDate = nextMonday(new Date());
  const scheduledGames = buildSeasonSchedule(teamIds, currentYear, startDate);

  await db.game.createMany({
    data: scheduledGames.map((g) => ({
      seasonId: season.id,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      scheduledAt: g.scheduledAt,
      status: "SCHEDULED",
    })),
  });
  console.log(`Scheduled ${scheduledGames.length} games`);

  // Activate season
  await db.season.update({
    where: { id: season.id },
    data: { status: "IN_PROGRESS" },
  });
  await db.league.update({
    where: { id: league.id },
    data: { currentYear },
  });

  console.log(
    `\nSeed complete.\n  League: ${league.id}\n  Season: ${season.id}\n  Teams: ${teamIds.length}\n  Players: ${totalPlayers}\n  Games: ${scheduledGames.length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
