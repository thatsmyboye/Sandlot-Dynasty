import { createTRPCRouter } from "../trpc";
import { leagueRouter } from "./league";
import { gameRouter } from "./game";
import { teamRouter } from "./team";
import { playerRouter } from "./player";

export const appRouter = createTRPCRouter({
  league: leagueRouter,
  game: gameRouter,
  team: teamRouter,
  player: playerRouter,
});

export type AppRouter = typeof appRouter;
