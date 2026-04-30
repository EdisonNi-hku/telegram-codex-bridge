export interface ConsoleProductAppModel {
  title: string;
  currentProject: string;
  currentSession: string;
  currentModel: string;
  currentMode: string;
  status: "online" | "running";
  projects: ConsoleProductProject[];
  commands: string[];
  modelOptions: string[];
  modeOptions: string[];
  timeline: ConsoleProductTimelineItem[];
  runCard: ConsoleProductRunCard;
  diffCard: ConsoleProductDiffCard;
  approvalCard: ConsoleProductApprovalCard;
  composer: ConsoleProductComposer;
}

export interface ConsoleProductProject {
  name: string;
  branch: string;
  hint: string;
  expanded: boolean;
  sessions: ConsoleProductSession[];
}

export interface ConsoleProductSession {
  title: string;
  age: string;
  active?: boolean;
}

export interface ConsoleProductTimelineItem {
  role: "user" | "assistant";
  body: string;
  time: string;
}

export interface ConsoleProductRunCard {
  title: string;
  status: string;
  progressLabel: string;
  progressPercent: number;
  steps: ConsoleProductRunStep[];
  cancelLabel: string;
}

export interface ConsoleProductRunStep {
  label: string;
  state: "done" | "active" | "pending";
}

export interface ConsoleProductDiffCard {
  filename: string;
  added: number;
  removed: number;
  lines: ConsoleProductDiffLine[];
  actions: string[];
}

export interface ConsoleProductDiffLine {
  number: string;
  kind: "add" | "remove" | "context";
  text: string;
}

export interface ConsoleProductApprovalCard {
  title: string;
  items: ConsoleProductApprovalItem[];
  actions: string[];
}

export interface ConsoleProductApprovalItem {
  title: string;
  detail: string;
}

export interface ConsoleProductComposer {
  placeholder: string;
  controls: string[];
}
