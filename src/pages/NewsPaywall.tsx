import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Lock, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { fetchFilmInfo, probeExtension, unlockStream, type FilmInfo } from "@/lib/mpp";

const ARTICLE_PARAGRAPHS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, nibh sit amet tincidunt efficitur, eros orci varius ipsum, in pretium justo sem vel nisl. Curabitur volutpat ante at vehicula viverra.",
  "Praesent aliquam lacus non nunc bibendum, eu suscipit justo tristique. Nunc ultricies commodo mauris, non faucibus lacus consequat vitae. Quisque malesuada imperdiet augue, ac porttitor neque pellentesque et.",
  "Aenean non tortor ut enim congue pretium. Pellentesque convallis dapibus orci, vel pharetra sem tempor non. Morbi auctor, eros in porta feugiat, nibh libero maximus velit, at ultrices arcu odio id ipsum.",
  "Integer ultricies magna sed risus tincidunt, vitae venenatis urna molestie. Proin viverra luctus tortor, nec fermentum mauris iaculis in. Integer facilisis, arcu ut dignissim gravida, turpis nisi facilisis risus, et gravida nisl dui at orci.",
  "Aliquam erat volutpat. Suspendisse potenti. Donec ultricies, est at tristique blandit, nibh dolor porttitor neque, non semper erat sapien ac erat. Nulla facilisi. Suspendisse luctus, sapien at malesuada aliquet, urna arcu suscipit augue, quis interdum metus quam in velit.",
  "Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Phasellus suscipit nisi et ornare malesuada. Sed ac sem vel erat gravida dictum ut at lectus. Nunc faucibus magna id ligula tincidunt porttitor.",
  "Mauris tincidunt diam vitae nisl vehicula, nec rhoncus lorem feugiat. Fusce vel justo nec velit varius tincidunt. Donec at sem vel sapien egestas faucibus quis sed nulla. Nam id odio ac nisi fringilla semper.",
  "Nam volutpat, nunc in eleifend aliquam, massa lectus pellentesque quam, vitae sodales ipsum est nec orci. Nunc rutrum elit et nunc dictum, vel scelerisque tortor convallis. Nulla in sapien id orci tincidunt sodales non quis eros.",
];

export default function NewsPaywall() {
  const [film, setFilm] = useState<FilmInfo | null>(null);
  const [hasExtension, setHasExtension] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPaywallInfo() {
      try {
        const [filmInfo, extensionDetected] = await Promise.all([
          fetchFilmInfo(),
          probeExtension(),
        ]);

        if (!cancelled) {
          setFilm(filmInfo);
          setHasExtension(extensionDetected);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    loadPaywallInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePaywallPayment() {
    if (!film) {
      return;
    }

    setIsPaying(true);
    setPaymentError("");

    try {
      await unlockStream(film.id);
      setIsUnlocked(true);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader pageTitle="News Article Paywall" />

      <main className="px-6 py-10">
        <article className="relative mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 md:p-8 overflow-hidden">
          <header className="mb-6 border-b border-border pb-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Sandbox News</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">Lightning Payments Reshape Digital News Access</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              A demonstration of a hard paywall overlay for premium article access.
            </p>
          </header>

          <div className={`space-y-4 text-[15px] leading-7 text-muted-foreground transition ${isUnlocked ? "" : "blur-[1.5px]"}`}>
            {ARTICLE_PARAGRAPHS.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {!isUnlocked && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 backdrop-blur-sm p-6">
              <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Lock className="h-5 w-5" />
                </div>

                <h2 className="text-xl font-semibold">Premium story locked</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {loadError
                    ? "Unable to load paywall pricing right now."
                    : film
                      ? `Pay ${film.currency === "BTC" ? "₿" : ""}${film.price} to dismiss this paywall and continue reading the full article.`
                      : "Loading live paywall pricing..."}
                </p>

                {hasExtension === false && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <span>
                      MPP browser extension not detected. Install a compatible Lightning wallet extension to pay.
                      <a
                        href="https://github.com/buildonspark/mppx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Learn more <ExternalLink className="h-3 w-3" />
                      </a>
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePaywallPayment}
                  disabled={isPaying || !film || hasExtension !== true || !!loadError}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for payment approval...
                    </>
                  ) : (
                    "Pay To Unlock"
                  )}
                </button>

                {paymentError && (
                  <p className="mt-3 text-xs text-destructive leading-relaxed">{paymentError}</p>
                )}

                {loadError && (
                  <p className="mt-3 text-xs text-destructive leading-relaxed">{loadError}</p>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                  This uses a live 402 challenge and requires a real payment via the TIPT extension.
                </p>
              </div>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}