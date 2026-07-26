import { describe, expect, it } from "vitest";

import {
  addTodo,
  createEmptyDocument,
  normalizeDocument,
  NOTE_MAX_LENGTH,
  removeTodo,
  remainingTodoCount,
  setNote,
  storageKeyForInstance,
  TODO_MAX_ITEMS,
  TODO_MAX_LENGTH,
  toggleTodo,
} from "../src/sticky-notes-model";

describe("sticky notes model", () => {
  it("creates an empty versioned document for missing data", () => {
    expect(normalizeDocument(null)).toEqual(createEmptyDocument());
  });

  it("normalizes stored content and repairs duplicate todo ids", () => {
    const normalized = normalizeDocument({
      schemaVersion: 999,
      note: "n".repeat(NOTE_MAX_LENGTH + 10),
      todos: [
        { id: "same", text: "  第一项  ", completed: true },
        { id: "same", text: "第二项", completed: false },
        { id: "ignored", text: "   ", completed: false },
        "invalid",
        { id: "after-invalid", text: "损坏项之后", completed: false },
      ],
    });

    expect(normalized.schemaVersion).toBe(1);
    expect(normalized.note).toHaveLength(NOTE_MAX_LENGTH);
    expect(normalized.todos).toEqual([
      { id: "same", text: "第一项", completed: true },
      { id: "same-2", text: "第二项", completed: false },
      { id: "after-invalid", text: "损坏项之后", completed: false },
    ]);
  });

  it("adds, toggles, counts and removes todo items without mutating earlier state", () => {
    const empty = createEmptyDocument();
    const added = addTodo(empty, "  完成实验报告  ", "todo-1");
    const completed = toggleTodo(added, "todo-1");
    const removed = removeTodo(completed, "todo-1");

    expect(empty.todos).toHaveLength(0);
    expect(added.todos).toEqual([
      { id: "todo-1", text: "完成实验报告", completed: false },
    ]);
    expect(remainingTodoCount(added)).toBe(1);
    expect(completed.todos[0]?.completed).toBe(true);
    expect(remainingTodoCount(completed)).toBe(0);
    expect(removed.todos).toHaveLength(0);
  });

  it("enforces text and item limits", () => {
    let document = setNote(createEmptyDocument(), "n".repeat(NOTE_MAX_LENGTH + 1));
    expect(document.note).toHaveLength(NOTE_MAX_LENGTH);

    for (let index = 0; index < TODO_MAX_ITEMS + 2; index += 1) {
      document = addTodo(
        document,
        `t${index}`.repeat(TODO_MAX_LENGTH),
        `todo-${index}`,
      );
    }

    expect(document.todos).toHaveLength(TODO_MAX_ITEMS);
    expect(document.todos[0]?.text.length).toBe(TODO_MAX_LENGTH);
  });

  it("uses a stable per-instance storage key", () => {
    expect(storageKeyForInstance("w123abc")).toBe("widget.w123abc.v1");
  });
});
