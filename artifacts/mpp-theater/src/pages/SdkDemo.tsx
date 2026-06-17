import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { createLightningMppExtensionClient } from "lightning-mpp-extension-sdk";

type LogEntry = {
  id: string;
  name: string;
  payload: string;
};

function stringify(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function toBase64Url(value: string): string {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeDemoPaidFetch(invoice: string, amountSats: number, endpoint: string) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    if (requestUrl !== endpoint) {
      return fetch(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const authorization = headers.get("Authorization");

    if (!authorization) {
      const request = {
        amount: String(amountSats),
        currency: "BTC",
        description: "TIPT SDK sandbox demo payment",
        methodDetails: {
          invoice,
          network: "mainnet",
        },
      };

      return new Response(JSON.stringify({ error: "payment required" }), {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Payment id="${crypto.randomUUID()}", realm="${window.location.host || "localhost"}", method="lightning", intent="charge", request="${toBase64Url(JSON.stringify(request))}"`,
        },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, endpoint, authorization }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
}

export default function SdkDemo() {
  const [invoice, setInvoice] = useState("");
  const [amountSats, setAmountSats] = useState("100");
  const [status, setStatus] = useState("Checking for the TIPT extension...");
  const [statusTone, setStatusTone] = useState<"idle" | "pending" | "success" | "error">("pending");
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState("No payment attempted yet.");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const endpoint = useMemo(() => "https://demo.tipt.local/paid-resource", []);

  function addLog(name: string, payload: unknown) {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        payload: stringify(payload),
      },
      ...prev,
    ]);
  }

  useEffect(() => {
    let seenResponse = false;

    const extensionHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (detail.type !== "response") {
        return;
      }

      seenResponse = true;
      setStatusTone("success");
      setStatus(`${detail.name || "TIPT extension"} detected`);
      addLog("mpp:extension", detail);
    };

    const challengeHandler = (event: Event) => {
      setStatusTone("pending");
      setStatus("Extension challenge dispatched. Waiting for approval.");
      addLog("mpp:challenge", (event as CustomEvent).detail ?? {});
    };

    const credentialHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (detail.approved === false) {
        setStatusTone("error");
        setStatus(detail.error || "Extension declined the payment.");
      } else {
        setStatusTone("success");
        setStatus("Extension returned a payment credential.");
      }
      addLog("mpp:credential", detail);
    };

    window.addEventListener("mpp:extension", extensionHandler);
    window.addEventListener("mpp:challenge", challengeHandler);
    window.addEventListener("mpp:credential", credentialHandler);

    window.dispatchEvent(
      new CustomEvent("mpp:extension", {
        detail: {
          type: "request",
          paymentMethods: ["lightning"],
          intents: ["charge"],
        },
      }),
    );

    const timer = window.setTimeout(() => {
      if (!seenResponse) {
        setStatusTone("error");
        setStatus("No TIPT extension response detected yet.");
        addLog("probe", "No extension response received within 1.5 seconds.");
      }
    }, 1500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mpp:extension", extensionHandler);
      window.removeEventListener("mpp:challenge", challengeHandler);
      window.removeEventListener("mpp:credential", credentialHandler);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const trimmedInvoice = invoice.trim();
    const parsedAmount = Number(amountSats);

    if (!trimmedInvoice) {
      setFormError("Paste a Lightning invoice first.");
      return;
    }

    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setFormError("Enter a whole-number amount in sats.");
      return;
    }

    const client = createLightningMppExtensionClient({
      polyfill: false,
      fetch: makeDemoPaidFetch(trimmedInvoice, parsedAmount, endpoint),
    });

    setBusy(true);
    setStatusTone("pending");
    setStatus("Creating a 402 challenge and routing it through the SDK.");
    addLog("demo", { endpoint, amountSats: parsedAmount });

    try {
      const response = await client.fetch(endpoint, { method: "GET" });
      const data = await response.json();
      setStatusTone("success");
      setStatus("Paid request completed through the TIPT extension.");
      setResult(stringify(data));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusTone("error");
      setStatus(message);
      setResult(stringify({ error: message }));
      addLog("error", message);
    } finally {
      setBusy(false);
    }
  }

  const statusClass = {
    idle: "bg-muted text-muted-foreground",
    pending: "bg-amber-500/15 text-amber-300",
    success: "bg-primary/15 text-primary",
    error: "bg-destructive/15 text-destructive",
  }[statusTone];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">TIPT SDK Sandbox</h1>
          <p className="text-xs text-muted-foreground">
            Fake 402 flow routed through the local SDK and TIPT extension.
          </p>
        </div>
        <Link href="/" className="text-sm text-primary hover:underline">
          Back to demos
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusClass}`}>
            {status}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2 text-sm">
              <span className="text-muted-foreground">Lightning invoice</span>
              <textarea
                className="min-h-40 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none"
                placeholder="Paste a fresh BOLT11 invoice."
                value={invoice}
                onChange={(event) => setInvoice(event.target.value)}
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="text-muted-foreground">Amount in sats</span>
              <input
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none"
                type="number"
                min="1"
                step="1"
                value={amountSats}
                onChange={(event) => setAmountSats(event.target.value)}
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Waiting for extension..." : "Run Sandbox Payment Demo"}
            </button>

            <div className="text-sm text-destructive min-h-5">{formError}</div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              This demo does not call a real backend. It creates a local <code>402 Payment Required</code>
              challenge and lets the SDK handle the extension handshake.
            </p>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-3">Result</h2>
            <pre className="overflow-auto rounded-xl border border-border bg-background p-4 text-xs whitespace-pre-wrap break-words">{result}</pre>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-3">Event Log</h2>
            <div className="space-y-3 max-h-[28rem] overflow-auto">
              {logs.length === 0 ? (
                <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  No extension traffic yet.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="text-sm font-medium text-foreground mb-2">{log.name}</div>
                    <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground">{log.payload}</pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
