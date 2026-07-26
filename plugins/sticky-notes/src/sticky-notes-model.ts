export const STICKY_NOTES_SCHEMA_VERSION = 1;
export const NOTE_MAX_LENGTH = 4_000;
export const TODO_MAX_LENGTH = 120;
export const TODO_MAX_ITEMS = 50;

export interface StickyTodo {
  readonly id: string;
  readonly text: string;
  readonly completed: boolean;
}

export interface StickyNotesDocument {
  readonly schemaVersion: typeof STICKY_NOTES_SCHEMA_VERSION;
  readonly note: string;
  readonly todos: readonly StickyTodo[];
}

export function createEmptyDocument(): StickyNotesDocument {
  return {
    schemaVersion: STICKY_NOTES_SCHEMA_VERSION,
    note: "",
    todos: [],
  };
}

export function normalizeDocument(value: unknown): StickyNotesDocument {
  if (!isRecord(value)) {
    return createEmptyDocument();
  }

  const note = typeof value.note === "string" ? value.note.slice(0, NOTE_MAX_LENGTH) : "";
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
    note,
    todos,
  };
}

export function setNote(
  document: StickyNotesDocument,
  note: string,
): StickyNotesDocument {
  const limitedNote = note.slice(0, NOTE_MAX_LENGTH);
  if (limitedNote === document.note) {
    return document;
  }
  return { ...document, note: limitedNote };
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

export function remainingTodoCount(document: StickyNotesDocument): number {
  return document.todos.filter((todo) => !todo.completed).length;
}

export function storageKeyForInstance(instanceId: string): string {
  return `widget.${instanceId}.v1`;
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
