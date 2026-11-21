import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDb } from "./lib/db.js";

const db = openDb(config.dbPath);
const app = createApp(db);
const server = app.listen(config.port, "0.0.0.0", () => console.log(`Attentive on http://localhost:${config.port}`));

const stop = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
