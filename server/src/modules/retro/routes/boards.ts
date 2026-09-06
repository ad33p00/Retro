import { Router } from "express";
import type { Server } from "socket.io";
import {
  ActionItemError,
  addActionItem,
  deleteActionItem,
  updateActionItem,
} from "../services/actionItems.js";
import {
  addCard,
  CardError,
  deleteCard,
  editCard,
  groupCards,
  moveCard,
  renameGroup,
  ungroupCard,
} from "../services/cards.js";
import {
  BoardError,
  closeBoard,
  createBoard,
  getBoardState,
  getParticipant,
  joinBoard,
  setLocked,
  startTimer,
  stopTimer,
} from "../services/boards.js";
import { castVote, retractVote, VoteError } from "../services/votes.js";
import { exportCsv, exportMarkdown } from "../services/export.js";
import { TEMPLATES } from "../types.js";

function respondCardError(res: import("express").Response, err: unknown): void {
  if (err instanceof CardError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  throw err;
}

function respondVoteError(res: import("express").Response, err: unknown): void {
  if (err instanceof VoteError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  throw err;
}

function respondBoardError(res: import("express").Response, err: unknown): void {
  if (err instanceof BoardError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  throw err;
}

function respondActionItemError(res: import("express").Response, err: unknown): void {
  if (err instanceof ActionItemError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  throw err;
}

export function createBoardsRouter(io: Server): Router {
  const boardsRouter = Router();

  boardsRouter.get("/templates", (_req, res) => {
    res.json(TEMPLATES);
  });

  boardsRouter.post("/", (req, res) => {
    const { name, template } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!TEMPLATES.some((t) => t.id === template)) {
      return res.status(400).json({ error: "invalid template" });
    }

    const board = createBoard({
      name: name.trim().slice(0, 100),
      template,
    });

    res.status(201).json(board);
  });

  boardsRouter.get("/:id", (req, res) => {
    const state = getBoardState(req.params.id);
    if (!state) return res.status(404).json({ error: "board not found" });
    res.json(state);
  });

  boardsRouter.get("/:id/export", (req, res) => {
    const state = getBoardState(req.params.id);
    if (!state) return res.status(404).json({ error: "board not found" });

    const format = req.query.format === "csv" ? "csv" : "md";
    const content = format === "csv" ? exportCsv(state) : exportMarkdown(state);

    const safeName = state.board.name.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || "board";
    const mimeType = format === "csv" ? "text/csv" : "text/markdown";

    res.setHeader("Content-Type", `${mimeType}; charset=utf-8`);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.${format}"`);
    res.send(content);
  });

  boardsRouter.post("/:id/participants", (req, res) => {
    const { displayName } = req.body ?? {};
    try {
      const participant = joinBoard(
        req.params.id,
        typeof displayName === "string" && displayName.trim() ? displayName.trim().slice(0, 60) : null
      );
      io.to(req.params.id).emit("participant:joined", participant);
      res.status(201).json(participant);
    } catch {
      res.status(404).json({ error: "board not found" });
    }
  });

  boardsRouter.get("/:id/participants/:participantId", (req, res) => {
    const participant = getParticipant(req.params.id, req.params.participantId);
    if (!participant) return res.status(404).json({ error: "participant not found" });
    res.json(participant);
  });

  boardsRouter.post("/:id/cards", (req, res) => {
    const { columnId, participantId, text } = req.body ?? {};
    if (typeof columnId !== "string" || typeof participantId !== "string" || typeof text !== "string") {
      return res.status(400).json({ error: "columnId, participantId and text are required" });
    }
    try {
      const card = addCard(req.params.id, columnId, participantId, text);
      io.to(req.params.id).emit("card:added", card);
      res.status(201).json(card);
    } catch (err) {
      respondCardError(res, err);
    }
  });

  boardsRouter.patch("/:id/cards/:cardId", (req, res) => {
    const { participantId, text } = req.body ?? {};
    if (typeof participantId !== "string" || typeof text !== "string") {
      return res.status(400).json({ error: "participantId and text are required" });
    }
    try {
      const card = editCard(req.params.id, req.params.cardId, participantId, text);
      io.to(req.params.id).emit("card:edited", card);
      res.json(card);
    } catch (err) {
      respondCardError(res, err);
    }
  });

  boardsRouter.patch("/:id/cards/:cardId/move", (req, res) => {
    const { columnId } = req.body ?? {};
    if (typeof columnId !== "string") {
      return res.status(400).json({ error: "columnId is required" });
    }
    try {
      const card = moveCard(req.params.id, req.params.cardId, columnId);
      io.to(req.params.id).emit("card:moved", card);
      res.json(card);
    } catch (err) {
      respondCardError(res, err);
    }
  });

  boardsRouter.patch("/:id/cards/:cardId/group", (req, res) => {
    const { targetCardId } = req.body ?? {};
    if (typeof targetCardId !== "string") {
      return res.status(400).json({ error: "targetCardId is required" });
    }
    try {
      const updated = groupCards(req.params.id, req.params.cardId, targetCardId);
      updated.forEach((card) => io.to(req.params.id).emit("card:edited", card));
      res.json(updated);
    } catch (err) {
      respondCardError(res, err);
    }
  });

  boardsRouter.delete("/:id/cards/:cardId/group", (req, res) => {
    try {
      const updated = ungroupCard(req.params.id, req.params.cardId);
      updated.forEach((card) => io.to(req.params.id).emit("card:edited", card));
      res.json(updated);
    } catch (err) {
      respondCardError(res, err);
    }
  });

  boardsRouter.patch("/:id/groups/:groupId", (req, res) => {
    const { name } = req.body ?? {};
    if (typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    try {
      const group = renameGroup(req.params.id, req.params.groupId, name);
      io.to(req.params.id).emit("group:renamed", group);
      res.json(group);
    } catch (err) {
      respondCardError(res, err);
    }
  });

  boardsRouter.delete("/:id/cards/:cardId", (req, res) => {
    const { participantId } = req.query;
    if (typeof participantId !== "string") {
      return res.status(400).json({ error: "participantId is required" });
    }
    try {
      deleteCard(req.params.id, req.params.cardId, participantId);
      io.to(req.params.id).emit("card:deleted", { cardId: req.params.cardId });
      res.status(204).end();
    } catch (err) {
      respondCardError(res, err);
    }
  });

  boardsRouter.post("/:id/cards/:cardId/votes", (req, res) => {
    const { participantId } = req.body ?? {};
    if (typeof participantId !== "string") {
      return res.status(400).json({ error: "participantId is required" });
    }
    try {
      const vote = castVote(req.params.id, req.params.cardId, participantId);
      io.to(req.params.id).emit("vote:cast", vote);
      res.status(201).json(vote);
    } catch (err) {
      respondVoteError(res, err);
    }
  });

  boardsRouter.delete("/:id/cards/:cardId/votes", (req, res) => {
    const { participantId } = req.query;
    if (typeof participantId !== "string") {
      return res.status(400).json({ error: "participantId is required" });
    }
    try {
      const vote = retractVote(req.params.id, req.params.cardId, participantId);
      io.to(req.params.id).emit("vote:retracted", { id: vote.id });
      res.json({ id: vote.id });
    } catch (err) {
      respondVoteError(res, err);
    }
  });

  boardsRouter.patch("/:id/lock", (req, res) => {
    const { participantId, locked } = req.body ?? {};
    if (typeof participantId !== "string" || typeof locked !== "boolean") {
      return res.status(400).json({ error: "participantId and locked are required" });
    }
    try {
      const board = setLocked(req.params.id, participantId, locked);
      io.to(req.params.id).emit("board:updated", board);
      res.json(board);
    } catch (err) {
      respondBoardError(res, err);
    }
  });

  boardsRouter.post("/:id/timer/start", (req, res) => {
    const { participantId, durationSeconds } = req.body ?? {};
    if (typeof participantId !== "string" || typeof durationSeconds !== "number") {
      return res.status(400).json({ error: "participantId and durationSeconds are required" });
    }
    try {
      const board = startTimer(req.params.id, participantId, durationSeconds);
      io.to(req.params.id).emit("board:updated", board);
      res.json(board);
    } catch (err) {
      respondBoardError(res, err);
    }
  });

  boardsRouter.post("/:id/timer/stop", (req, res) => {
    const { participantId } = req.body ?? {};
    if (typeof participantId !== "string") {
      return res.status(400).json({ error: "participantId is required" });
    }
    try {
      const board = stopTimer(req.params.id, participantId);
      io.to(req.params.id).emit("board:updated", board);
      res.json(board);
    } catch (err) {
      respondBoardError(res, err);
    }
  });

  boardsRouter.post("/:id/close", async (req, res) => {
    const { participantId, clickupListId } = req.body ?? {};
    if (typeof participantId !== "string") {
      return res.status(400).json({ error: "participantId is required" });
    }
    try {
      const board = await closeBoard(
        req.params.id,
        participantId,
        typeof clickupListId === "string" ? clickupListId : undefined
      );
      io.to(req.params.id).emit("board:updated", board);
      res.json(board);
    } catch (err) {
      respondBoardError(res, err);
    }
  });

  boardsRouter.post("/:id/action-items", (req, res) => {
    const { text, assignee } = req.body ?? {};
    if (typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }
    try {
      const item = addActionItem(req.params.id, text, typeof assignee === "string" ? assignee : null);
      io.to(req.params.id).emit("actionItem:added", item);
      res.status(201).json(item);
    } catch (err) {
      respondActionItemError(res, err);
    }
  });

  boardsRouter.patch("/:id/action-items/:itemId", (req, res) => {
    const { text, assignee, status } = req.body ?? {};
    try {
      const item = updateActionItem(req.params.id, req.params.itemId, {
        text: typeof text === "string" ? text : undefined,
        assignee: assignee === undefined ? undefined : typeof assignee === "string" ? assignee : null,
        status: status === "todo" || status === "done" ? status : undefined,
      });
      io.to(req.params.id).emit("actionItem:updated", item);
      res.json(item);
    } catch (err) {
      respondActionItemError(res, err);
    }
  });

  boardsRouter.delete("/:id/action-items/:itemId", (req, res) => {
    try {
      deleteActionItem(req.params.id, req.params.itemId);
      io.to(req.params.id).emit("actionItem:deleted", { id: req.params.itemId });
      res.status(204).end();
    } catch (err) {
      respondActionItemError(res, err);
    }
  });

  return boardsRouter;
}
