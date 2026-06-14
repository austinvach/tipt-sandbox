import { useState, useEffect, useRef } from "react";
import { fetchFilmInfo, unlockStream, probeExtension, formatDuration, type FilmInfo, type StreamResult } from "@/lib/mpp";
import { Zap, Clock, Calendar, AlertTriangle, Loader2, Play, X, ExternalLink } from "lucide-react";

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; info: FilmInfo; hasExtension: boolean | null }
  | { kind: "paying" }
  | { kind: "playing"; stream: StreamResult }
  | { kind: "error"; message: string };

export default function Theater() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [info, hasExtension] = await Promise.all([
          fetchFilmInfo(),
          probeExtension(),
        ]);
        if (!cancelled) {
          setPhase({ kind: "ready", info, hasExtension });
        }
      } catch (err) {
        if (!cancelled) {
          setPhase({ kind: "error", message: String(err) });
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function handleWatch() {
    setPhase((prev) => {
      if (prev.kind !== "ready") return prev;
      return { kind: "paying" };
    });
    try {
      const stream = await unlockStream();
      setPhase({ kind: "playing", stream });
      setTimeout(() => videoRef.current?.play(), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPhase((prev) => {
        const info = (prev as { info?: FilmInfo }).info;
        if (info) return { kind: "ready", info, hasExtension: null };
        return { kind: "error", message: msg };
      });
      // Show error toast — re-fetch info then show error overlay
      setPhase({ kind: "error", message: msg });
      setTimeout(async () => {
        try {
          const info = await fetchFilmInfo();
          setPhase({ kind: "ready", info, hasExtension: null });
        } catch { /* keep error */ }
      }, 4000);
    }
  }

  function handleClose() {
    videoRef.current?.pause();
    setPhase({ kind: "loading" });
    // Reload info
    fetchFilmInfo()
      .then((info) => setPhase({ kind: "ready", info, hasExtension: null }))
      .catch((err) => setPhase({ kind: "error", message: String(err) }));
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-semibold tracking-tight text-foreground text-lg">MPP Theater</span>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          Powered by Lightning Network
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        {phase.kind === "loading" && (
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading film info...</p>
          </div>
        )}

        {phase.kind === "error" && (
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{phase.message}</p>
            <button
              onClick={() => {
                setPhase({ kind: "loading" });
                fetchFilmInfo()
                  .then((info) => setPhase({ kind: "ready", info, hasExtension: null }))
                  .catch((err) => setPhase({ kind: "error", message: String(err) }));
              }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-accent transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {(phase.kind === "ready" || phase.kind === "paying") && (
          <FilmCard
            info={phase.kind === "ready" ? phase.info : null}
            hasExtension={phase.kind === "ready" ? phase.hasExtension : null}
            paying={phase.kind === "paying"}
            onWatch={handleWatch}
          />
        )}

        {phase.kind === "playing" && (
          <VideoPlayer
            stream={phase.stream}
            videoRef={videoRef}
            onClose={handleClose}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        Payments secured by the Lightning Network &middot; No account required
      </footer>
    </div>
  );
}

function FilmCard({
  info,
  hasExtension,
  paying,
  onWatch,
}: {
  info: FilmInfo | null;
  hasExtension: boolean | null;
  paying: boolean;
  onWatch: () => void;
}) {
  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-xl">
        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-muted overflow-hidden">
          {info?.thumbnail ? (
            <img
              src={info.thumbnail}
              alt={info.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          )}
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
        </div>

        {/* Info */}
        <div className="p-6 space-y-4">
          {info ? (
            <>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {info.title}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {info.year}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(info.duration)}
                  </span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {info.description}
              </p>

              {/* Price banner */}
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Price to watch</p>
                  <p className="text-sm font-semibold text-foreground">
                    {info.price} {info.currency}
                  </p>
                </div>
              </div>

              {/* Extension warning */}
              {hasExtension === false && (
                <div className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-medium">MPP browser extension not detected.</span>{" "}
                    Install a compatible Lightning wallet extension to pay.{" "}
                    <a
                      href="https://github.com/buildonspark/mppx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Learn more <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Watch button — only shown when extension is detected */}
              {hasExtension === true && (
                <>
                  <button
                    onClick={onWatch}
                    disabled={paying}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Waiting for payment...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" strokeWidth={2.5} />
                        Pay &amp; Watch
                      </>
                    )}
                  </button>

                  {paying && (
                    <p className="text-center text-xs text-muted-foreground">
                      Approve the payment in your Lightning wallet extension
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="space-y-3 animate-pulse">
              <div className="h-7 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-16 bg-muted rounded" />
              <div className="h-12 bg-muted rounded" />
              <div className="h-12 bg-muted rounded" />
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        No subscription. No account. Pay once, watch instantly.
      </p>
    </div>
  );
}

function VideoPlayer({
  stream,
  videoRef,
  onClose,
}: {
  stream: StreamResult;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClose: () => void;
}) {
  return (
    <div className="w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{stream.title}</h2>
          <p className="text-sm text-muted-foreground">{stream.year} &middot; {formatDuration(stream.duration)}</p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border border-border shadow-2xl bg-black aspect-video">
        <video
          ref={videoRef}
          src={stream.url}
          controls
          autoPlay
          className="w-full h-full"
        >
          Your browser does not support the video element.
        </video>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="w-3.5 h-3.5 text-primary" />
        Payment confirmed &middot; Enjoy the film
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Having trouble?</span>{" "}
        You can also{" "}
        <a
          href={stream.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          open in a new tab <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
