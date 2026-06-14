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
  console.log("[mpp] probeExtension: sending mpp:extension request event");
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener("mpp:extension", handler);
      console.log("[mpp] probeExtension: timed out — no extension response");
      resolve(false);
    }, timeoutMs);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "response") {
        clearTimeout(timer);
        window.removeEventListener("mpp:extension", handler);
        console.log("[mpp] probeExtension: extension responded", detail);
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
  console.log("[mpp] unlockStream: step 1 — requesting stream (expecting 402)");
  const r1 = await fetch(`${BASE}/theater/stream`);
  console.log("[mpp] unlockStream: step 1 response status", r1.status);

  if (r1.ok) {
    console.log("[mpp] unlockStream: stream already unlocked (no payment needed)");
    return r1.json();
  }

  if (r1.status !== 402) {
    throw new Error(`Unexpected response: ${r1.status}`);
  }

  const challenge = r1.headers.get("WWW-Authenticate");
  console.log("[mpp] unlockStream: step 2 — got 402, WWW-Authenticate:", challenge);
  if (!challenge) throw new Error("No payment challenge received from server");

  const id = challenge.match(/id="([^"]+)"/)?.[1];
  const reqB64 = challenge.match(/request="([^"]+)"/)?.[1];
  console.log("[mpp] unlockStream: parsed challenge id:", id, "| base64 length:", reqB64?.length);
  if (!id || !reqB64) throw new Error("Could not parse payment challenge");

  let challengeData: unknown;
  try {
    challengeData = JSON.parse(atob(reqB64));
    console.log("[mpp] unlockStream: decoded challenge payload:", challengeData);
  } catch {
    throw new Error("Could not decode payment challenge payload");
  }

  console.log("[mpp] unlockStream: step 3 — dispatching mpp:challenge, waiting for mpp:credential...");
  const credential = await new Promise<{ ph: string; preimage: string }>(
    (resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Payment timed out after 90 seconds")),
        90_000
      );

      const handler = (e: Event) => {
        clearTimeout(timer);
        const detail = (e as CustomEvent).detail ?? {};
        console.log("[mpp] unlockStream: step 4 — mpp:credential received", detail);
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

  console.log("[mpp] unlockStream: step 5 — submitting proof | ph:", credential.ph, "| preimage:", credential.preimage);
  const r2 = await fetch(`${BASE}/theater/stream`, {
    headers: {
      Authorization: `Payment id="${id}", ph="${credential.ph}", preimage="${credential.preimage}"`,
    },
  });
  console.log("[mpp] unlockStream: step 5 response status", r2.status);

  if (!r2.ok) {
    throw new Error(`Stream unlock failed: ${r2.status} ${r2.statusText}`);
  }

  const result = await r2.json();
  console.log("[mpp] unlockStream: success — stream URL:", result.url);
  return result;
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
