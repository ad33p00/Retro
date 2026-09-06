import { BoardState } from "../types.js";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportMarkdown(state: BoardState): string {
  const participantsById = new Map(state.participants.map((p) => [p.id, p]));
  const groupsById = new Map(state.groups.map((g) => [g.id, g]));

  const lines: string[] = [`# ${state.board.name}`, ""];

  for (const column of state.columns) {
    lines.push(`## ${column.title}`, "");
    const cards = state.cards.filter((c) => c.column_id === column.id);

    if (cards.length === 0) {
      lines.push("_No cards_", "");
      continue;
    }

    for (const card of cards) {
      const voteCount = state.votes.filter((v) => v.card_id === card.id).length;
      const author = card.author_participant_id
        ? participantsById.get(card.author_participant_id)?.display_name ?? "Anonymous"
        : "Anonymous";
      const groupName = card.group_id ? groupsById.get(card.group_id)?.name : undefined;
      const groupSuffix = card.group_id ? ` (grouped: ${groupName || "Untitled group"})` : "";
      lines.push(`- ${card.text} — *${author}*, ${voteCount} vote${voteCount === 1 ? "" : "s"}${groupSuffix}`);
    }
    lines.push("");
  }

  lines.push("## Action Item Tracker", "");
  if (state.actionItems.length === 0) {
    lines.push("_No action items_");
  } else {
    for (const item of state.actionItems) {
      const box = item.status === "done" ? "[x]" : "[ ]";
      const assignee = item.assignee ? ` — ${item.assignee}` : "";
      lines.push(`- ${box} ${item.text}${assignee}`);
    }
  }

  return lines.join("\n");
}

export function exportCsv(state: BoardState): string {
  const participantsById = new Map(state.participants.map((p) => [p.id, p]));
  const groupsById = new Map(state.groups.map((g) => [g.id, g]));
  const columnsById = new Map(state.columns.map((c) => [c.id, c]));

  const rows: string[] = ["type,column,text,author,votes,group,assignee,status"];

  for (const card of state.cards) {
    const column = columnsById.get(card.column_id);
    const voteCount = state.votes.filter((v) => v.card_id === card.id).length;
    const author = card.author_participant_id
      ? participantsById.get(card.author_participant_id)?.display_name ?? "Anonymous"
      : "Anonymous";
    const groupName = card.group_id ? groupsById.get(card.group_id)?.name ?? "" : "";

    rows.push(
      ["card", column?.title ?? "", card.text, author, String(voteCount), groupName, "", ""]
        .map(csvEscape)
        .join(",")
    );
  }

  for (const item of state.actionItems) {
    rows.push(
      ["action_item", "", item.text, "", "", "", item.assignee ?? "", item.status].map(csvEscape).join(",")
    );
  }

  return rows.join("\n");
}
