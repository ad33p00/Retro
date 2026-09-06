export type TemplateId = "went-well-wrong-action" | "start-stop-continue" | "mad-sad-glad";

export interface TemplateDef {
  id: TemplateId;
  name: string;
  columns: string[];
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "went-well-wrong-action",
    name: "Went Well / Went Wrong / Action Items",
    columns: ["Went Well", "Went Wrong", "Action Items"],
  },
  {
    id: "start-stop-continue",
    name: "Start / Stop / Continue",
    columns: ["Start", "Stop", "Continue"],
  },
  {
    id: "mad-sad-glad",
    name: "Mad / Sad / Glad",
    columns: ["Mad", "Sad", "Glad"],
  },
];

export interface BoardRow {
  id: string;
  name: string;
  template: TemplateId;
  created_at: number;
  locked: 0 | 1;
  pin_hash: string | null;
  timer_ends_at: number | null;
  completed_at: number | null;
}

export interface ColumnRow {
  id: string;
  board_id: string;
  title: string;
  order_index: number;
}

export interface CardRow {
  id: string;
  column_id: string;
  author_participant_id: string | null;
  text: string;
  group_id: string | null;
  created_at: number;
}

export interface GroupRow {
  id: string;
  board_id: string;
  name: string;
}

export interface VoteRow {
  id: string;
  card_id: string;
  participant_id: string;
}

export interface ActionItemRow {
  id: string;
  board_id: string;
  text: string;
  assignee: string | null;
  status: "todo" | "done";
}

export interface ParticipantRow {
  id: string;
  board_id: string;
  display_name: string | null;
  color: string;
  is_facilitator: 0 | 1;
}

export interface BoardState {
  board: BoardRow;
  columns: ColumnRow[];
  cards: CardRow[];
  groups: GroupRow[];
  votes: VoteRow[];
  actionItems: ActionItemRow[];
  participants: ParticipantRow[];
}
