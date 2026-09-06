export type TemplateId = "went-well-wrong-action" | "start-stop-continue" | "mad-sad-glad";

export interface TemplateDef {
  id: TemplateId;
  name: string;
  columns: string[];
}

export interface Board {
  id: string;
  name: string;
  template: TemplateId;
  created_at: number;
  locked: 0 | 1;
  pin_hash: string | null;
  timer_ends_at: number | null;
  completed_at: number | null;
}

export interface Column {
  id: string;
  board_id: string;
  title: string;
  order_index: number;
}

export interface Card {
  id: string;
  column_id: string;
  author_participant_id: string | null;
  text: string;
  group_id: string | null;
  created_at: number;
}

export interface Group {
  id: string;
  board_id: string;
  name: string;
}

export interface Vote {
  id: string;
  card_id: string;
  participant_id: string;
}

export interface ActionItem {
  id: string;
  board_id: string;
  text: string;
  assignee: string | null;
  status: "todo" | "done";
}

export interface Participant {
  id: string;
  board_id: string;
  display_name: string | null;
  color: string;
  is_facilitator: 0 | 1;
}

export interface BoardSummary extends Board {
  team_size: number;
  card_count: number;
}

export interface BoardState {
  board: Board;
  columns: Column[];
  cards: Card[];
  groups: Group[];
  votes: Vote[];
  actionItems: ActionItem[];
  participants: Participant[];
}

export interface SprintOption {
  id: string;
  name: string;
  startDate: number | null;
  dueDate: number | null;
  isCurrent: boolean;
}
