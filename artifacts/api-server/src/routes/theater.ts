import { Router } from "express";

const router = Router();
const UPSTREAM = "https://mpptheater.replit.app/api";

router.get("/theater/info", async (req, res) => {
  try {
    const upstream = await fetch(`${UPSTREAM}/theater/info`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error({ err }, "theater/info proxy failed");
    res.status(502).json({ error: "Failed to fetch film info" });
  }
});

router.get("/theater/stream", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const upstream = await fetch(`${UPSTREAM}/theater/stream`, { headers });

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
    req.log.error({ err }, "theater/stream proxy failed");
    res.status(502).json({ error: "Failed to contact stream endpoint" });
  }
});

export default router;
