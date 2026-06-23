import { Router } from "express";

const router = Router();
const UPSTREAM = "https://mpptheater.replit.app/api";

type UpstreamFilm = {
  id: string;
  title: string;
  year: number;
  duration: number;
  description?: string;
  thumbnail?: string;
  price: string;
  currency: string;
};

function normalizeFilm(film: UpstreamFilm) {
  return {
    id: film.id,
    title: film.title,
    year: film.year,
    duration: film.duration,
    description: film.description ?? "",
    thumbnail: film.thumbnail ?? "",
    price: film.price,
    currency: film.currency,
  };
}

router.get("/titles", async (req, res) => {
  try {
    const requestedLimitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 5;
    const requestedLimit = Number.isFinite(requestedLimitRaw) ? Math.max(1, Math.min(5, Math.floor(requestedLimitRaw))) : 5;
    const upstream = await fetch(`${UPSTREAM}/titles`);

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "Upstream error" });
      return;
    }

    const films = (await upstream.json()) as UpstreamFilm[];
    const limitedFilms = films.slice(0, requestedLimit).map(normalizeFilm);
    res.status(200).json(limitedFilms);
  } catch (err) {
    req.log.error({ err }, "titles proxy failed");
    res.status(502).json({ error: "Failed to fetch film info" });
  }
});

router.get("/stream", async (req, res) => {
  try {
    const requestedId = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!requestedId) {
      res.status(400).json({ error: "Missing required query parameter: id" });
      return;
    }
    const authHeader = req.headers["authorization"];
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const upstream = await fetch(`${UPSTREAM}/stream?id=${encodeURIComponent(requestedId)}`, {
      headers,
    });

    if (upstream.status === 402) {
      const wwwAuth = upstream.headers.get("WWW-Authenticate");
      if (wwwAuth) {
        res.setHeader("WWW-Authenticate", wwwAuth);
      }
      res.status(402).json({ error: "Payment required" });
      return;
    }

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "Upstream error" });
      return;
    }

    const data = await upstream.json();
    res.status(200).json(data);
  } catch (err) {
    req.log.error({ err }, "stream proxy failed");
    res.status(502).json({ error: "Failed to contact stream endpoint" });
  }
});

export default router;
