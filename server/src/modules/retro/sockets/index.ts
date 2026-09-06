import type { Server, Socket } from "socket.io";

export function registerRetroSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("board:join", ({ boardId }: { boardId?: string }) => {
      if (typeof boardId === "string") socket.join(boardId);
    });
  });
}
