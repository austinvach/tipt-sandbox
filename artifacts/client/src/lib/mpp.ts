import {
  createLightningMppExtensionClient,
  probeLightningMppExtension,
} from "lightning-mpp-extension-sdk";

const BASE = "/api";
const UPSTREAM_BASE = "https://mpptheater.replit.app/api";

export interface FilmInfo {
  id: string;
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

function normalizeFilm(raw: unknown): FilmInfo | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const film = raw as Partial<FilmInfo>;
  if (!film.id || !film.title) {
    return null;
  }

  return {
    id: film.id,
    title: film.title,
    year: typeof film.year === "number" ? film.year : 0,
    duration: typeof film.duration === "number" ? film.duration : 0,
    description: film.description ?? "",
    thumbnail: film.thumbnail ?? "",
    price: film.price ?? "",
    currency: film.currency ?? "",
  };
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: string; message?: string };
      return data.error || data.message || fallback;
    }

    const text = await response.text();
    if (text.trim()) {
      return text;
    }
  } catch {
    // If the body cannot be parsed, return a generic fallback.
  }

  return fallback;
}

export async function fetchFilms(limit = 5): Promise<FilmInfo[]> {
  const safeLimit = Math.max(1, Math.min(5, Math.floor(limit)));
  const targets = [
    `${BASE}/titles`,
    `${UPSTREAM_BASE}/titles`,
  ];
  let lastError = "Failed to fetch film list";

  for (const target of targets) {
    try {
      const res = await fetch(target);
      if (!res.ok) {
        const detail = await parseErrorMessage(res, `HTTP ${res.status}`);
        lastError = `Failed to fetch film list (${res.status}): ${detail}`;
        continue;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const body = await res.text();
        if (body.startsWith("<!DOCTYPE") || body.startsWith("<html")) {
          lastError = "API returned HTML instead of JSON. Ensure api-server is running and /api is proxied to it.";
          continue;
        }
      }

      const payload = await res.json();
      if (Array.isArray(payload)) {
        const films = payload
          .map((film) => normalizeFilm(film))
          .filter((film): film is FilmInfo => film !== null)
          .slice(0, safeLimit);

        if (!films.length) {
          lastError = "No films available";
          continue;
        }
        return films;
      }

      const single = normalizeFilm(payload);
      if (single) {
        return [single];
      }

      lastError = "Received invalid film payload";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError);
}

export async function fetchFilmInfo(): Promise<FilmInfo> {
  const films = await fetchFilms(1);
  const first = films[0];
  if (!first) {
    throw new Error("No films available");
  }
  return first;
}

export async function probeExtension(timeoutMs = 1500): Promise<boolean> {
  console.log("[mpp] probeExtension: probing via SDK");
  try {
    const response = await probeLightningMppExtension({ timeoutMs });
    console.log("[mpp] probeExtension: extension responded", response);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[mpp] probeExtension: failed", message);
    return false;
  }
}

export async function unlockStream(filmId: string): Promise<StreamResult> {
  console.log("[mpp] unlockStream: requesting paid stream via SDK client", { filmId });
  const client = createLightningMppExtensionClient({
    polyfill: false,
    extensionProbeTimeoutMs: 1500,
  });

  const targets = [
    `${BASE}/stream?id=${encodeURIComponent(filmId)}`,
    `${UPSTREAM_BASE}/stream?id=${encodeURIComponent(filmId)}`,
  ];

  let lastError = "Stream unlock failed";
  const failures: string[] = [];
  for (const target of targets) {
    try {
      const response = await client.fetch(target, {
        method: "GET",
      });
      if (!response.ok) {
        const detail = await parseErrorMessage(response, response.statusText);
        lastError = `Stream unlock failed: ${response.status} ${detail}`;
        failures.push(`${target}: ${lastError}`);
        continue;
      }

      const result = (await response.json()) as StreamResult;
      console.log("[mpp] unlockStream: success! URL:", result.url);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = `Stream unlock failed: ${message}`;
      failures.push(`${target}: ${message}`);
    }
  }

  const hasMissingWwwAuth = failures.some((failure) => failure.includes("Missing WWW-Authenticate header"));
  if (hasMissingWwwAuth) {
    throw new Error(`${lastError}. Ensure /api/stream is reachable and proxies the upstream payment challenge response.`);
  }

  throw new Error(lastError);
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
