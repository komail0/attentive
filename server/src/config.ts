import fs from "node:fs";
import path from "node:path";

// Load a .env file from the working directory or the repo root, if there is one.
for (const f of [path.resolve(".env"), path.resolve("..", ".env")]) {
  if (fs.existsSync(f)) {
    process.loadEnvFile(f);
    break;
  }
}

const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production");
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  isProd,
  secret: process.env.SESSION_SECRET ?? "dev-only-secret-change-me",
  dbPath: process.env.DATABASE_PATH ?? path.resolve("data/attentive.db"),
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  /** Pin counts below this are shown to the lecturer as "a few", so one student cannot be guessed. */
  threshold: 3,
  cookieName: "att_session",
  sessionDays: 7,
} as const;
