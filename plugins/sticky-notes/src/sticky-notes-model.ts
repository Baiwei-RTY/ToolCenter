export const STICKY_NOTES_SCHEMA_VERSION = 2;
export const DEFAULT_TITLE = "本周安排";
export const TITLE_MAX_LENGTH = 120;
export const BODY_MAX_LENGTH = 4_000;
export const TODO_MAX_LENGTH = 120;
export const TODO_MAX_ITEMS = 50;
export const SPLIT_MIN_PERCENT = 28;
export const SPLIT_MAX_PERCENT = 64;
export const DEFAULT_SPLIT_PERCENT = 46.5;

export interface StickyTodo {
  readonly id: string;
  readonly text: string;
  readonly completed: boolean;
}

export interface StickyNotesDocument {
  readonly schemaVersion: typeof STICKY_NOTES_SCHEMA_VERSION;
  readonly title: string;
  readonly body: string;
  readonly splitPercent: number;
  readonly todos: readonly StickyTodo[];
}

export function createEmptyDocument(): StickyNotesDocument {
  return {
    schemaVersion: STICKY_NOTES_SCHEMA_VERSION,
    title: DEFAULT_TITLE,
    body: "",
    splitPercent: DEFAULT_SPLIT_PERCENT,
    todos: [],
  };
}

export function normalizeDocument(value: unknown): StickyNotesDocument {
  if (!isRecord(value)) {
    return createEmptyDocument();
  }

  const title =
    typeof value.title === "string"
      ? value.title.slice(0, TITLE_MAX_LENGTH)
      : DEFAULT_TITLE;
  const bodySource =
    typeof value.body === "string"
      ? value.body
      : typeof value.note === "string"
        ? value.note
        : "";
  const body = bodySource.slice(0, BODY_MAX_LENGTH);
  const splitPercent = normalizeSplitPercent(value.splitPercent);
  const sourceTodos = Array.isArray(value.todos) ? value.todos : [];
  const usedIds = new Set<string>();
  const todos: StickyTodo[] = [];

  for (const [index, candidate] of sourceTodos.entries()) {
    if (todos.length >= TODO_MAX_ITEMS) {
      break;
    }
    if (!isRecord(candidate)) {
      continue;
    }

    const text =
      typeof candidate.text === "string"
        ? candidate.text.trim().slice(0, TODO_MAX_LENGTH)
        : "";
    if (text.length === 0) {
      continue;
    }

    const requestedId =
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim().slice(0, 80)
        : `migrated-${index + 1}`;
    const id = uniqueId(requestedId, usedIds);
    usedIds.add(id);
    todos.push({
      id,
      text,
      completed: candidate.completed === true,
    });
  }

  return {
    schemaVersion: STICKY_NOTES_SCHEMA_VERSION,
    title,
    body,
    splitPercent,
    todos,
  };
}

export function setTitle(
  document: StickyNotesDocument,
  title: string,
): StickyNotesDocument {
  const limitedTitle = title.slice(0, TITLE_MAX_LENGTH);
  if (limitedTitle === document.title) {
    return document;
  }
  return { ...document, title: limitedTitle };
}

export function setBody(
  document: StickyNotesDocument,
  body: string,
): StickyNotesDocument {
  const limitedBody = body.slice(0, BODY_MAX_LENGTH);
  if (limitedBody === document.body) {
    return document;
  }
  return { ...document, body: limitedBody };
}

export function setSplitPercent(
  document: StickyNotesDocument,
  splitPercent: number,
): StickyNotesDocument {
  const normalized = normalizeSplitPercent(splitPercent);
  if (normalized === document.splitPercent) {
    return document;
  }
  return { ...document, splitPercent: normalized };
}

export function addTodo(
  document: StickyNotesDocument,
  text: string,
  id: string,
): StickyNotesDocument {
  const normalizedText = text.trim().slice(0, TODO_MAX_LENGTH);
  if (normalizedText.length === 0 || document.todos.length >= TODO_MAX_ITEMS) {
    return document;
  }

  const usedIds = new Set(document.todos.map((todo) => todo.id));
  const normalizedId = uniqueId(id.trim().slice(0, 80) || "todo", usedIds);
  return {
    ...document,
    todos: [
      ...document.todos,
      {
        id: normalizedId,
        text: normalizedText,
        completed: false,
      },
    ],
  };
}

export function toggleTodo(
  document: StickyNotesDocument,
  todoId: string,
): StickyNotesDocument {
  const index = document.todos.findIndex((todo) => todo.id === todoId);
  if (index < 0) {
    return document;
  }

  return {
    ...document,
    todos: document.todos.map((todo, todoIndex) =>
      todoIndex === index ? { ...todo, completed: !todo.completed } : todo,
    ),
  };
}

export function removeTodo(
  document: StickyNotesDocument,
  todoId: string,
): StickyNotesDocument {
  if (!document.todos.some((todo) => todo.id === todoId)) {
    return document;
  }
  return {
    ...document,
    todos: document.todos.filter((todo) => todo.id !== todoId),
  };
}

export function reorderTodo(
  document: StickyNotesDocument,
  sourceId: string,
  targetId: string,
  after: boolean,
): StickyNotesDocument {
  if (sourceId === targetId) {
    return document;
  }

  const source = document.todos.find((todo) => todo.id === sourceId);
  if (!source || !document.todos.some((todo) => todo.id === targetId)) {
    return document;
  }

  const todos = document.todos.filter((todo) => todo.id !== sourceId);
  const targetIndex = todos.findIndex((todo) => todo.id === targetId);
  todos.splice(targetIndex + (after ? 1 : 0), 0, source);

  if (todos.every((todo, index) => todo.id === document.todos[index]?.id)) {
    return document;
  }
  return { ...document, todos };
}

export function remainingTodoCount(document: StickyNotesDocument): number {
  return document.todos.filter((todo) => !todo.completed).length;
}

export function storageKeyForInstance(instanceId: string): string {
  // Keep the established key so version 1 documents can be migrated in place.
  return `widget.${instanceId}.v1`;
}

function normalizeSplitPercent(value: unknown): number {
  const requested = typeof value === "number" && Number.isFinite(value)
    ? value
    : DEFAULT_SPLIT_PERCENT;
  const clamped = Math.min(SPLIT_MAX_PERCENT, Math.max(SPLIT_MIN_PERCENT, requested));
  return Math.round(clamped * 10) / 10;
}

function uniqueId(requestedId: string, usedIds: ReadonlySet<string>): string {
  if (!usedIds.has(requestedId)) {
    return requestedId;
  }

  let suffix = 2;
  while (usedIds.has(`${requestedId}-${suffix}`)) {
    suffix += 1;
  }
  return `${requestedId}-${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
