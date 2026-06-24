import { Link } from "wouter";
import { Film, Wallet, Newspaper } from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface Tile {
  slug: string;
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: "live" | "coming-soon";
  accent: string;
}

const tiles: Tile[] = [
  {
    slug: "vod",
    href: "/vod",
    label: "Video On-Demand",
    description:
      "Pay-per-view streaming gated by a Lightning invoice. One payment, instant access.",
    icon: <Film className="w-7 h-7" />,
    status: "live",
    accent: "from-green-600/20 to-green-600/5 border-green-600/30",
  },
  {
    slug: "sdk-demo",
    href: "/sdk-demo",
    label: "SDK Payment Playground",
    description:
      "Interactive Lightning Address and LNURL checkout simulation using the TIPT extension bridge.",
    icon: <Wallet className="w-7 h-7" />,
    status: "live",
    accent: "from-cyan-600/20 to-cyan-600/5 border-cyan-600/30",
  },
  {
    slug: "news-paywall",
    href: "/news-paywall",
    label: "News Article Paywall",
    description:
      "Long-form article content gated by a paywall overlay that requires payment before reading.",
    icon: <Newspaper className="w-7 h-7" />,
    status: "live",
    accent: "from-orange-600/20 to-orange-600/5 border-orange-600/30",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Hero */}
      <section className="px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          TIPT SANDBOX
        </h1>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto text-base leading-relaxed">
          Interactive demos for Lightning-native payments over HTTP 402.
        </p>
      </section>

      {/* Tile grid */}
      <main className="flex-1 px-6 pb-16">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
          {tiles.map((tile) => (
            <TileCard key={tile.slug} tile={tile} />
          ))}
        </div>
      </main>
    </div>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const inner = (
    <div
      className={`group relative rounded-2xl border bg-gradient-to-br p-6 flex flex-col gap-4 transition-all duration-200 h-full ${tile.accent} ${
        tile.status === "live"
          ? "hover:scale-[1.02] hover:shadow-xl cursor-pointer"
          : "opacity-60 cursor-default"
      }`}
    >
      {/* Status badge */}
      <div className="flex items-start justify-between">
        <div
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            tile.status === "live"
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {tile.status === "live" ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live
            </>
          ) : (
            "Coming soon"
          )}
        </div>
        <div
          className={`${
            tile.status === "live" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {tile.icon}
        </div>
      </div>

      {/* Text */}
      <div className="flex-1">
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          {tile.label}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {tile.description}
        </p>
      </div>

      {/* CTA */}
      {tile.status === "live" && (
        <div className="flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
          Try demo
          <span className="text-base">→</span>
        </div>
      )}
    </div>
  );

  if (tile.status === "live") {
    return <Link href={tile.href}>{inner}</Link>;
  }
  return <div>{inner}</div>;
}
