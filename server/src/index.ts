import cors from "cors";
import express from "express";
import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

try {
  process.loadEnvFile();
} catch {
  // no .env file present — env vars may be supplied by the environment instead
}

import "../db/index.js";
import { registerRetroModule } from "./modules/retro/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Each module owns its own /api/<module> namespace and socket handlers.
registerRetroModule(app, io);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// In production the client build is served alongside the API from the same origin.
// Compiled location is dist/src/index.js, so this resolves to <repo>/client/dist.
const clientDist = path.join(__dirname, "../../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
