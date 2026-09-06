import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { ActionItem, Board, Card, Group, Participant, Vote } from "../lib/types";

interface BoardSocketHandlers {
  onCardAdded: (card: Card) => void;
  onCardEdited: (card: Card) => void;
  onCardDeleted: (cardId: string) => void;
  onCardMoved: (card: Card) => void;
  onParticipantJoined: (participant: Participant) => void;
  onVoteCast: (vote: Vote) => void;
  onVoteRetracted: (voteId: string) => void;
  onGroupRenamed: (group: Group) => void;
  onBoardUpdated: (board: Board) => void;
  onActionItemAdded: (item: ActionItem) => void;
  onActionItemUpdated: (item: ActionItem) => void;
  onActionItemDeleted: (itemId: string) => void;
}

export function useBoardSocket(
  boardId: string | undefined,
  participantId: string | undefined,
  handlers: BoardSocketHandlers
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!boardId || !participantId) return;

    const socket: Socket = io();

    socket.on("connect", () => {
      socket.emit("board:join", { boardId, participantId });
    });
    socket.on("card:added", (card: Card) => handlersRef.current.onCardAdded(card));
    socket.on("card:edited", (card: Card) => handlersRef.current.onCardEdited(card));
    socket.on("card:deleted", ({ cardId }: { cardId: string }) => handlersRef.current.onCardDeleted(cardId));
    socket.on("card:moved", (card: Card) => handlersRef.current.onCardMoved(card));
    socket.on("participant:joined", (participant: Participant) =>
      handlersRef.current.onParticipantJoined(participant)
    );
    socket.on("vote:cast", (vote: Vote) => handlersRef.current.onVoteCast(vote));
    socket.on("vote:retracted", ({ id }: { id: string }) => handlersRef.current.onVoteRetracted(id));
    socket.on("group:renamed", (group: Group) => handlersRef.current.onGroupRenamed(group));
    socket.on("board:updated", (board: Board) => handlersRef.current.onBoardUpdated(board));
    socket.on("actionItem:added", (item: ActionItem) => handlersRef.current.onActionItemAdded(item));
    socket.on("actionItem:updated", (item: ActionItem) => handlersRef.current.onActionItemUpdated(item));
    socket.on("actionItem:deleted", ({ id }: { id: string }) => handlersRef.current.onActionItemDeleted(id));

    return () => {
      socket.disconnect();
    };
  }, [boardId, participantId]);
}
