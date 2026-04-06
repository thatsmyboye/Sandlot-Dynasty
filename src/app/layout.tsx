import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/trpc/provider";

export const metadata: Metadata = {
  title: "Sandlot Dynasty",
  description: "Baseball franchise simulation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0e1a] text-gray-100">
        <TRPCProvider>
          <nav className="sticky top-0 z-50 border-b border-gray-800 bg-[#0a0e1a]/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
              <a href="/" className="flex items-center gap-2 font-bold text-white">
                <span className="text-green-400 text-lg">⚾</span>
                <span className="tracking-tight">Sandlot Dynasty</span>
              </a>
              <div className="flex items-center gap-1 text-sm">
                <NavLink href="/">Dashboard</NavLink>
                <NavLink href="/roster">Roster</NavLink>
                <NavLink href="/standings">Standings</NavLink>
                <NavLink href="/schedule">Schedule</NavLink>
                <NavLink href="/leaders">Leaders</NavLink>
              </div>
            </div>
          </nav>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </TRPCProvider>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-md px-3 py-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
    >
      {children}
    </a>
  );
}
