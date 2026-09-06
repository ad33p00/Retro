import { nanoid } from "nanoid";
import { dbGet, dbRun } from "../../../../db/index.js";
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

async function getBoard(boardId: string): Promise<BoardRow | undefined> {
  return dbGet<BoardRow>(`SELECT * FROM boards WHERE id = ?`, [boardId]);
}

async function requireOpenBoard(boardId: string): Promise<BoardRow> {
  const board = await getBoard(boardId);
  if (!board) throw new VoteError(404, "board not found");
  if (board.completed_at) throw new VoteError(403, "this retro has been closed");
  return board;
}

export async function castVote(boardId: string, cardId: string, participantId: string): Promise<VoteRow> {
  await requireOpenBoard(boardId);

  const card = await getCardInBoard(cardId, boardId);
  if (!card) throw new VoteError(404, "card not found");

  const participant = await getParticipant(boardId, participantId);
  if (!participant) throw new VoteError(404, "participant not found");

  if (card.author_participant_id === participantId) {
    throw new VoteError(403, "cannot vote on your own card");
  }

  const existing = await dbGet<VoteRow>(`SELECT * FROM votes WHERE card_id = ? AND participant_id = ?`, [
    cardId,
    participantId,
  ]);
  if (existing) throw new VoteError(409, "already voted on this card");

  const id = nanoid();
  await dbRun(`INSERT INTO votes (id, card_id, participant_id) VALUES (?, ?, ?)`, [id, cardId, participantId]);
  return (await dbGet<VoteRow>(`SELECT * FROM votes WHERE id = ?`, [id]))!;
}

export async function retractVote(boardId: string, cardId: string, participantId: string): Promise<VoteRow> {
  await requireOpenBoard(boardId);
  const card = await getCardInBoard(cardId, boardId);
  if (!card) throw new VoteError(404, "card not found");

  const vote = await dbGet<VoteRow>(`SELECT * FROM votes WHERE card_id = ? AND participant_id = ? LIMIT 1`, [
    cardId,
    participantId,
  ]);
  if (!vote) throw new VoteError(404, "no vote to retract");

  await dbRun(`DELETE FROM votes WHERE id = ?`, [vote.id]);
  return vote;
}
