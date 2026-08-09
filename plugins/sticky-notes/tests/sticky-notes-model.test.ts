import { describe, expect, it } from "vitest";

import {
  addTodo,
  BODY_MAX_LENGTH,
  createEmptyDocument,
  DEFAULT_SPLIT_PERCENT,
  DEFAULT_TITLE,
  normalizeDocument,
  removeTodo,
  remainingTodoCount,
  reorderTodo,
  setBody,
  setSplitPercent,
  setTitle,
  SPLIT_MAX_PERCENT,
  SPLIT_MIN_PERCENT,
  storageKeyForInstance,
  TITLE_MAX_LENGTH,
  TODO_MAX_ITEMS,
  TODO_MAX_LENGTH,
  toggleTodo,
} from "../src/sticky-notes-model";

describe("sticky notes model", () => {
  it("creates an empty versioned document for missing data", () => {
    expect(normalizeDocument(null)).toEqual(createEmptyDocument());
  });

  it("migrates version 1 note content without losing text or todos", () => {
    const normalized = normalizeDocument({
      schemaVersion: 1,
      note: "旧版正文",
      todos: [
        { id: "same", text: "  第一项  ", completed: true },
        { id: "same", text: "第二项", completed: false },
        { id: "ignored", text: "   ", completed: false },
        "invalid",
        { id: "after-invalid", text: "损坏项之后", completed: false },
      ],
    });

    expect(normalized).toMatchObject({
      schemaVersion: 2,
      title: DEFAULT_TITLE,
      body: "旧版正文",
      splitPercent: DEFAULT_SPLIT_PERCENT,
    });
    expect(normalized.todos).toEqual([
      { id: "same", text: "第一项", completed: true },
      { id: "same-2", text: "第二项", completed: false },
      { id: "after-invalid", text: "损坏项之后", completed: false },
    ]);
  });

  it("normalizes current title, body and split values", () => {
    const normalized = normalizeDocument({
      schemaVersion: 999,
      title: "t".repeat(TITLE_MAX_LENGTH + 10),
      body: "b".repeat(BODY_MAX_LENGTH + 10),
      splitPercent: 999,
      todos: [],
    });

    expect(normalized.schemaVersion).toBe(2);
    expect(normalized.title).toHaveLength(TITLE_MAX_LENGTH);
    expect(normalized.body).toHaveLength(BODY_MAX_LENGTH);
    expect(normalized.splitPercent).toBe(SPLIT_MAX_PERCENT);
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

  it("reorders todo items before or after the target", () => {
    let document = createEmptyDocument();
    document = addTodo(document, "第一项", "todo-1");
    document = addTodo(document, "第二项", "todo-2");
    document = addTodo(document, "第三项", "todo-3");

    const movedAfter = reorderTodo(document, "todo-1", "todo-3", true);
    expect(movedAfter.todos.map((todo) => todo.id)).toEqual([
      "todo-2",
      "todo-3",
      "todo-1",
    ]);

    const movedBefore = reorderTodo(movedAfter, "todo-1", "todo-2", false);
    expect(movedBefore.todos.map((todo) => todo.id)).toEqual([
      "todo-1",
      "todo-2",
      "todo-3",
    ]);
    expect(reorderTodo(document, "missing", "todo-2", false)).toBe(document);
  });

  it("enforces title, body, split and todo limits", () => {
    let document = setTitle(createEmptyDocument(), "t".repeat(TITLE_MAX_LENGTH + 1));
    document = setBody(document, "b".repeat(BODY_MAX_LENGTH + 1));
    document = setSplitPercent(document, SPLIT_MIN_PERCENT - 20);

    expect(document.title).toHaveLength(TITLE_MAX_LENGTH);
    expect(document.body).toHaveLength(BODY_MAX_LENGTH);
    expect(document.splitPercent).toBe(SPLIT_MIN_PERCENT);

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

  it("uses the established per-instance key for in-place migration", () => {
    expect(storageKeyForInstance("w123abc")).toBe("widget.w123abc.v1");
  });
});
