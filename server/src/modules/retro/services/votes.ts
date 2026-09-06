import { nanoid } from "nanoid";
import { db } from "../../../../db/index.js";
import { BoardRow, VoteRow } from "../types.js";
import { getCardInBoard } from "./cards.js";
import { getParticipant } from "./boards.js";

export class VoteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getBoard(boardId: string): BoardRow | undefined {
  return db.prepare(`SELECT * FROM boards WHERE id = ?`).get(boardId) as BoardRow | undefined;
}

function requireOpenBoard(boardId: string): BoardRow {
  const board = getBoard(boardId);
  if (!board) throw new VoteError(404, "board not found");
  if (board.completed_at) throw new VoteError(403, "this retro has been closed");
  return board;
}

export function castVote(boardId: string, cardId: string, participantId: string): VoteRow {
  requireOpenBoard(boardId);

  const card = getCardInBoard(cardId, boardId);
  if (!card) throw new VoteError(404, "card not found");

  const participant = getParticipant(boardId, participantId);
  if (!participant) throw new VoteError(404, "participant not found");

  if (card.author_participant_id === participantId) {
    throw new VoteError(403, "cannot vote on your own card");
  }

  const existing = db
    .prepare(`SELECT * FROM votes WHERE card_id = ? AND participant_id = ?`)
    .get(cardId, participantId) as VoteRow | undefined;
  if (existing) throw new VoteError(409, "already voted on this card");

  const id = nanoid();
  db.prepare(`INSERT INTO votes (id, card_id, participant_id) VALUES (?, ?, ?)`).run(id, cardId, participantId);
  return db.prepare(`SELECT * FROM votes WHERE id = ?`).get(id) as VoteRow;
}

export function retractVote(boardId: string, cardId: string, participantId: string): VoteRow {
  requireOpenBoard(boardId);
  const card = getCardInBoard(cardId, boardId);
  if (!card) throw new VoteError(404, "card not found");

  const vote = db
    .prepare(`SELECT * FROM votes WHERE card_id = ? AND participant_id = ? LIMIT 1`)
    .get(cardId, participantId) as VoteRow | undefined;
  if (!vote) throw new VoteError(404, "no vote to retract");

  db.prepare(`DELETE FROM votes WHERE id = ?`).run(vote.id);
  return vote;
}
