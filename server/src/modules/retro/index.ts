import type { Express } from "express";
import type { Server } from "socket.io";
import { createBoardsRouter } from "./routes/boards.js";
import { createSprintsRouter } from "./routes/sprints.js";
import { registerRetroSocketHandlers } from "./sockets/index.js";

export function registerRetroModule(app: Express, io: Server): void {
  app.use("/api/retro/boards", createBoardsRouter(io));
  app.use("/api/retro/sprints", createSprintsRouter());
  registerRetroSocketHandlers(io);
}
