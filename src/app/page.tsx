"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";

export default function HomePage() {
  const { data: leagues, isLoading } = trpc.league.getAll.useQuery();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!leagues || leagues.length === 0) {
    return <NewGameSetup />;
  }

  // Show the first league's dashboard
  const league = leagues[0];
  return <LeagueDashboard league={league} />;
}

// ─── New Game Setup ────────────────────────────────────────────────────────────

function NewGameSetup() {
  const [form, setForm] = useState({
    leagueName: "Sandlot Dynasty League",
    userTeamName: "Ironclads",
    userTeamCity: "New Carthage",
    userTeamAbbreviation: "NCI",
    userTeamPrimaryColor: "#1a3a6b",
    userTeamSecondaryColor: "#c8a84b",
  });
  const [isCreating, setIsCreating] = useState(false);

  const createLeague = trpc.league.createNew.useMutation({
    onSuccess: () => window.location.reload(),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    createLeague.mutate(form);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-8">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">⚾</div>
          <h1 className="text-2xl font-bold text-white">Start Your Dynasty</h1>
          <p className="mt-2 text-sm text-gray-400">
            A fictional 16-team league will be generated. You manage one franchise.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="League Name"
            value={form.leagueName}
            onChange={(v) => setForm((f) => ({ ...f, leagueName: v }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Team City"
              value={form.userTeamCity}
              onChange={(v) => setForm((f) => ({ ...f, userTeamCity: v }))}
            />
            <Field
              label="Team Name"
              value={form.userTeamName}
              onChange={(v) => setForm((f) => ({ ...f, userTeamName: v }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field
              label="Abbreviation"
              value={form.userTeamAbbreviation}
              onChange={(v) =>
                setForm((f) => ({ ...f, userTeamAbbreviation: v.slice(0, 3).toUpperCase() }))
              }
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Primary Color
              </label>
              <input
                type="color"
                value={form.userTeamPrimaryColor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, userTeamPrimaryColor: e.target.value }))
                }
                className="h-9 w-full cursor-pointer rounded border border-gray-700 bg-gray-800 p-0.5"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                Secondary Color
              </label>
              <input
                type="color"
                value={form.userTeamSecondaryColor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, userTeamSecondaryColor: e.target.value }))
                }
                className="h-9 w-full cursor-pointer rounded border border-gray-700 bg-gray-800 p-0.5"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isCreating}
            className="mt-2 w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? "Generating League..." : "Start Season 1"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
      />
    </div>
  );
}

// ─── League Dashboard ─────────────────────────────────────────────────────────

type LeagueTeam = {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  isUserTeam: boolean;
  budget: number;
};

type League = {
  id: string;
  name: string;
  currentYear: number;
  salaryCap: number;
  luxuryTaxThreshold: number;
  luxuryTaxRate: number;
  minSalary: number;
  maxSalary: number;
  teams: LeagueTeam[];
  createdAt: Date;
};

function LeagueDashboard({ league }: { league: League }) {
  const { data } = trpc.league.getWithStandings.useQuery({ leagueId: league.id });

  const userTeam = league.teams.find((t: LeagueTeam) => t.isUserTeam);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{league.name}</h1>
          <p className="text-sm text-gray-400">Season {data?.league.currentYear ?? 1}</p>
        </div>
        {userTeam && (
          <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2">
            <div
              className="h-8 w-8 rounded-full border-2 border-gray-600"
              style={{ backgroundColor: userTeam.primaryColor }}
            />
            <div>
              <div className="text-sm font-semibold text-white">
                {userTeam.city} {userTeam.name}
              </div>
              <div className="text-xs text-gray-400">Your Franchise</div>
            </div>
          </div>
        )}
      </div>

      {/* Standings */}
      {data?.currentSeason?.standings && (
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Standings
          </h2>
          <table className="stat-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>PCT</th>
                <th>RS</th>
                <th>RA</th>
              </tr>
            </thead>
            <tbody>
              {data.currentSeason.standings.map((s, i) => {
                const pct =
                  s.wins + s.losses > 0
                    ? (s.wins / (s.wins + s.losses)).toFixed(3).replace(/^0/, "")
                    : ".000";
                const isUser = s.team.isUserTeam;
                return (
                  <tr key={s.id} className={isUser ? "text-green-400" : ""}>
                    <td className={isUser ? "text-green-400 font-bold" : ""}>
                      {i + 1}. {s.team.city} {s.team.name}
                    </td>
                    <td>{s.wins}</td>
                    <td>{s.losses}</td>
                    <td>{pct}</td>
                    <td>{s.runsScored}</td>
                    <td>{s.runsAllowed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "My Roster", href: "/roster", icon: "👤" },
          { label: "Schedule", href: "/schedule", icon: "📅" },
          { label: "Standings", href: "/standings", icon: "🏆" },
          { label: "Leaders", href: "/leaders", icon: "📊" },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 p-5 text-center transition-colors hover:border-green-700 hover:bg-gray-800"
          >
            <span className="text-2xl">{card.icon}</span>
            <span className="text-sm font-medium text-gray-200">{card.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-4xl">⚾</div>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
