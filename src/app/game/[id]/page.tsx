"use client";

import { trpc } from "@/trpc/client";

type Props = { params: { id: string } };

export default function GamePage({ params }: Props) {
  const { data: game, isLoading } = trpc.game.getById.useQuery({ gameId: params.id });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Loading game...</p>
      </div>
    );
  }

  if (!game) {
    return <p className="text-gray-400">Game not found.</p>;
  }

  const isPending = game.status !== "COMPLETED";

  return (
    <div className="space-y-6">
      {/* Scoreboard header */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center justify-between">
          <TeamScore
            name={`${game.awayTeam.city} ${game.awayTeam.name}`}
            abbr={game.awayTeam.abbreviation}
            color={game.awayTeam.primaryColor}
            score={game.awayScore}
          />
          <div className="text-center">
            {isPending ? (
              <div className="text-sm text-gray-400">
                <div className="text-lg font-mono text-amber-400">SCHEDULED</div>
                <div className="mt-1 text-xs">
                  {new Date(game.scheduledAt).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-semibold uppercase text-green-400">Final</div>
                {game.inningsPlayed && game.inningsPlayed > 9 && (
                  <div className="text-xs text-gray-500">({game.inningsPlayed} inn.)</div>
                )}
              </div>
            )}
          </div>
          <TeamScore
            name={`${game.homeTeam.city} ${game.homeTeam.name}`}
            abbr={game.homeTeam.abbreviation}
            color={game.homeTeam.primaryColor}
            score={game.homeScore}
            isHome
          />
        </div>
      </div>

      {/* Box score */}
      {!isPending && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BoxScore
            title={`${game.awayTeam.city} ${game.awayTeam.name} — Batting`}
            batters={game.batterStats.filter((b) => b.teamId === game.awayTeamId)}
            pitchers={game.pitcherStats.filter((p) => p.teamId === game.awayTeamId)}
          />
          <BoxScore
            title={`${game.homeTeam.city} ${game.homeTeam.name} — Batting`}
            batters={game.batterStats.filter((b) => b.teamId === game.homeTeamId)}
            pitchers={game.pitcherStats.filter((p) => p.teamId === game.homeTeamId)}
          />
        </div>
      )}

      {/* Play-by-play */}
      {!isPending && game.log.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Play-by-Play
          </h2>
          <PlayByPlay
            log={game.log}
            homeAbbr={game.homeTeam.abbreviation}
            awayAbbr={game.awayTeam.abbreviation}
          />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeamScore({
  name,
  abbr,
  color,
  score,
  isHome = false,
}: {
  name: string;
  abbr: string;
  color: string;
  score: number | null;
  isHome?: boolean;
}) {
  return (
    <div className={`flex flex-col ${isHome ? "items-end" : "items-start"} gap-1`}>
      <div className="flex items-center gap-2">
        <div
          className="h-6 w-6 rounded-full border border-gray-600"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium text-gray-300">{abbr}</span>
      </div>
      <div className="text-xs text-gray-500">{name}</div>
      <div className="text-4xl font-bold font-mono text-white">{score ?? "–"}</div>
    </div>
  );
}

type BatterStat = {
  id: string;
  teamId: string;
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
  player: { firstName: string; lastName: string; position: string };
};

type PitcherStat = {
  id: string;
  teamId: string;
  isStarter: boolean;
  outsPitched: number;
  hitsAllowed: number;
  earnedRuns: number;
  walksAllowed: number;
  strikeouts: number;
  win: boolean;
  loss: boolean;
  save: boolean;
  player: { firstName: string; lastName: string };
};

function BoxScore({
  title,
  batters,
  pitchers,
}: {
  title: string;
  batters: BatterStat[];
  pitchers: PitcherStat[];
}) {
  const formatIP = (outs: number) => {
    const full = Math.floor(outs / 3);
    const rem = outs % 3;
    return rem === 0 ? `${full}.0` : `${full}.${rem}`;
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </h3>

      {/* Batting */}
      <div className="overflow-x-auto">
        <table className="stat-table mb-5">
          <thead>
            <tr>
              <th>Player</th>
              <th>AB</th>
              <th>H</th>
              <th>HR</th>
              <th>RBI</th>
              <th>BB</th>
              <th>K</th>
              <th>R</th>
            </tr>
          </thead>
          <tbody>
            {batters
              .sort((a, b) => a.lineupSlot - b.lineupSlot)
              .map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.player.firstName[0]}. {b.player.lastName}
                    <span className="ml-1 text-xs text-gray-500">{b.player.position}</span>
                  </td>
                  <td>{b.atBats}</td>
                  <td>{b.hits}</td>
                  <td>{b.homeRuns}</td>
                  <td>{b.rbi}</td>
                  <td>{b.walks}</td>
                  <td>{b.strikeouts}</td>
                  <td>{b.runs}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pitching */}
      <div className="overflow-x-auto">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Pitcher</th>
              <th>IP</th>
              <th>H</th>
              <th>ER</th>
              <th>BB</th>
              <th>K</th>
              <th>Dec</th>
            </tr>
          </thead>
          <tbody>
            {pitchers
              .sort((a, b) => (b.isStarter ? 1 : 0) - (a.isStarter ? 1 : 0))
              .map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.player.firstName[0]}. {p.player.lastName}
                    <span className="ml-1 text-xs text-gray-500">
                      {p.isStarter ? "SP" : "RP"}
                    </span>
                  </td>
                  <td>{formatIP(p.outsPitched)}</td>
                  <td>{p.hitsAllowed}</td>
                  <td>{p.earnedRuns}</td>
                  <td>{p.walksAllowed}</td>
                  <td>{p.strikeouts}</td>
                  <td>
                    {p.win ? (
                      <span className="font-bold text-green-400">W</span>
                    ) : p.loss ? (
                      <span className="font-bold text-red-400">L</span>
                    ) : p.save ? (
                      <span className="font-bold text-amber-400">S</span>
                    ) : (
                      <span className="text-gray-600">–</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type LogEntry = {
  id: string;
  inning: number;
  isTop: boolean;
  sequence: number;
  eventType: string;
  text: string;
  homeScore: number;
  awayScore: number;
  outs: number;
  runnersOn: string;
};

function PlayByPlay({
  log,
  homeAbbr,
  awayAbbr,
}: {
  log: LogEntry[];
  homeAbbr: string;
  awayAbbr: string;
}) {
  // Group by inning + isTop
  const groups = new Map<string, LogEntry[]>();
  for (const entry of log) {
    const key = `${entry.inning}-${entry.isTop}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  return (
    <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
      {Array.from(groups.entries()).map(([key, entries]) => {
        const [inning, isTopStr] = key.split("-");
        const isTop = isTopStr === "true";
        const inningNum = parseInt(inning);
        const ordinals = [
          "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th",
          "10th", "11th", "12th",
        ];
        const ord = ordinals[inningNum - 1] ?? `${inningNum}th`;
        const battingTeam = isTop ? awayAbbr : homeAbbr;

        return (
          <div key={key}>
            {/* Inning header */}
            <div className="inning-header">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                {isTop ? "Top" : "Bot"} {ord} — {battingTeam} batting
              </span>
            </div>

            {/* Events */}
            {entries
              .filter(
                (e) =>
                  e.eventType !== "INNING_START" &&
                  e.eventType !== "INNING_END" &&
                  e.eventType !== "GAME_END"
              )
              .map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 rounded px-2 py-1 text-sm ${
                    isScoreEvent(entry.eventType)
                      ? "bg-green-900/20 text-green-300"
                      : isOutEvent(entry.eventType)
                      ? "text-gray-400"
                      : "text-gray-200"
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-xs font-mono text-gray-600 w-8 text-right">
                    {entry.outs}o
                  </span>
                  <span className="flex-1">{entry.text}</span>
                  {isScoreEvent(entry.eventType) && (
                    <span className="shrink-0 text-xs font-mono text-green-400">
                      {awayAbbr} {entry.awayScore} – {homeAbbr} {entry.homeScore}
                    </span>
                  )}
                </div>
              ))}

            {/* Inning summary */}
            {entries.find((e) => e.eventType === "INNING_END") && (
              <div className="px-2 py-1 text-xs text-gray-600 italic">
                {entries.find((e) => e.eventType === "INNING_END")?.text}
              </div>
            )}
          </div>
        );
      })}

      {/* Game end */}
      {log.find((e) => e.eventType === "GAME_END") && (
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-center text-sm font-semibold text-white">
          {log.find((e) => e.eventType === "GAME_END")?.text}
        </div>
      )}
    </div>
  );
}

function isScoreEvent(type: string) {
  return ["SINGLE", "DOUBLE", "TRIPLE", "HOME_RUN", "WALK", "ERROR"].includes(type);
}
function isOutEvent(type: string) {
  return ["STRIKEOUT", "GROUNDOUT", "FLYOUT", "LINEOUT"].includes(type);
}
