import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import helmet from "helmet";
import type { DB } from "./lib/db.js";
import { authRouter } from "./routes/auth.js";
import { sessionsRouter } from "./routes/sessions.js";
import { studentRouter } from "./routes/student.js";

export function createApp(db: DB, clientDist = path.resolve(import.meta.dirname, "../../client/dist")) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          frameAncestors: ["'none'"],
          // Off on purpose: this makes a browser load scripts over https even on a plain http address (a phone on the same Wi-Fi), leaving a blank page. Turn it on behind an https proxy.
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "50kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter(db));
  app.use("/api/sessions", sessionsRouter(db));
  app.use("/api/s", studentRouter(db));
  app.use("/api", (_req, res) => void res.status(404).json({ error: "not_found" }));

  if (fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  // Last resort: never leak internals, never crash the process.
  app.use((err: Error & { status?: number; type?: string; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === "entity.parse.failed") return void res.status(400).json({ error: "invalid_json" });
    if (err.type === "entity.too.large") return void res.status(413).json({ error: "too_large" });
    if (err.code === "LIMIT_FILE_SIZE") return void res.status(413).json({ error: "file_too_large" });
    if (process.env.NODE_ENV !== "test") console.error(err);
    res.status(500).json({ error: "server_error" });
  });
  return app;
}
