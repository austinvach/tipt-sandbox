const BASE = "/api";

export interface FilmInfo {
  title: string;
  year: number;
  duration: number;
  description: string;
  thumbnail: string;
  price: string;
  currency: string;
}

export interface StreamResult {
  url: string;
  title: string;
  year: number;
  duration: number;
}

export async function fetchFilmInfo(): Promise<FilmInfo> {
  const res = await fetch(`${BASE}/theater/info`);
  if (!res.ok) throw new Error("Failed to fetch film info");
  return res.json();
}

export async function probeExtension(timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener("mpp:extension", handler);
      resolve(false);
    }, timeoutMs);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "response") {
        clearTimeout(timer);
        window.removeEventListener("mpp:extension", handler);
        resolve(true);
      }
    };

    window.addEventListener("mpp:extension", handler);
    window.dispatchEvent(
      new CustomEvent("mpp:extension", {
        detail: {
          type: "request",
          paymentMethods: ["lightning"],
          intents: ["charge"],
        },
      })
    );
  });
}

export async function unlockStream(): Promise<StreamResult> {
  const r1 = await fetch(`${BASE}/theater/stream`);

  if (r1.ok) {
    return r1.json();
  }

  if (r1.status !== 402) {
    throw new Error(`Unexpected response: ${r1.status}`);
  }

  const challenge = r1.headers.get("WWW-Authenticate");
  if (!challenge) throw new Error("No payment challenge received from server");

  const id = challenge.match(/id="([^"]+)"/)?.[1];
  const reqB64 = challenge.match(/request="([^"]+)"/)?.[1];
  if (!id || !reqB64) throw new Error("Could not parse payment challenge");

  let challengeData: unknown;
  try {
    challengeData = JSON.parse(atob(reqB64));
  } catch {
    throw new Error("Could not decode payment challenge payload");
  }

  const credential = await new Promise<{ ph: string; preimage: string }>(
    (resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Payment timed out after 90 seconds")),
        90_000
      );

      const handler = (e: Event) => {
        clearTimeout(timer);
        const detail = (e as CustomEvent).detail ?? {};
        resolve({
          ph: detail.paymentHash ?? detail.ph ?? "",
          preimage: detail.preimage ?? "",
        });
      };

      window.addEventListener("mpp:credential", handler, { once: true });

      window.dispatchEvent(
        new CustomEvent("mpp:challenge", {
          detail: { id, challenge: challengeData },
        })
      );
    }
  );

  const r2 = await fetch(`${BASE}/theater/stream`, {
    headers: {
      Authorization: `Payment id="${id}", ph="${credential.ph}", preimage="${credential.preimage}"`,
    },
  });

  if (!r2.ok) {
    throw new Error(`Stream unlock failed: ${r2.status} ${r2.statusText}`);
  }

  return r2.json();
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
}
