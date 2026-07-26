import type { WidgetProps } from "@tool-center/plugin-contract";
import { useState, type FormEvent } from "react";

import {
  NOTE_MAX_LENGTH,
  remainingTodoCount,
  TODO_MAX_ITEMS,
  TODO_MAX_LENGTH,
} from "./sticky-notes-model";
import "./styles.css";
import { useStickyNotes } from "./use-sticky-notes";

type ActivePane = "note" | "todos";

export default function StickyNotesWidget({ context, widget }: WidgetProps) {
  const notes = useStickyNotes(context, widget.instanceId, widget.visible);
  const [activePane, setActivePane] = useState<ActivePane>("note");
  const [todoDraft, setTodoDraft] = useState("");
  const tabPrefix = `sticky-notes-${widget.instanceId}`;

  if (!widget.visible) {
    return <section className="plugin-sticky-notes" aria-hidden="true" />;
  }

  if (notes.loadStatus === "loading") {
    return (
      <WidgetState
        size={widget.size}
        title="正在打开便签"
        detail="正在读取这个小组件保存的内容…"
      />
    );
  }

  if (notes.loadStatus === "error") {
    return (
      <WidgetState
        size={widget.size}
        title="无法打开便签"
        detail={notes.errorMessage ?? "请稍后重试。"}
        action="重新读取"
        onAction={notes.retryLoad}
      />
    );
  }

  const remaining = remainingTodoCount(notes.document);
  const todoLimitReached = notes.document.todos.length >= TODO_MAX_ITEMS;
  const submitTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (notes.addTodoItem(todoDraft)) {
      setTodoDraft("");
    }
  };

  return (
    <section
      className={`plugin-sticky-notes plugin-sticky-notes--${widget.size}`}
      aria-label="桌面便签"
    >
      <header className="plugin-sticky-notes__header">
        <strong>桌面便签</strong>
        <div className="plugin-sticky-notes__status" aria-live="polite">
          {widget.locked ? <span>位置已锁定</span> : null}
          <SaveStatus
            status={notes.saveStatus}
            hasError={notes.saveStatus === "error"}
            onRetry={notes.retrySave}
          />
        </div>
      </header>

      <div className="plugin-sticky-notes__tabs" role="tablist" aria-label="便签内容">
        <button
          id={`${tabPrefix}-note-tab`}
          type="button"
          role="tab"
          aria-selected={activePane === "note"}
          aria-controls={`${tabPrefix}-note-panel`}
          onClick={() => setActivePane("note")}
        >
          便签
        </button>
        <button
          id={`${tabPrefix}-todos-tab`}
          type="button"
          role="tab"
          aria-selected={activePane === "todos"}
          aria-controls={`${tabPrefix}-todos-panel`}
          onClick={() => setActivePane("todos")}
        >
          待办
          {remaining > 0 ? <span>{remaining}</span> : null}
        </button>
      </div>

      <div className="plugin-sticky-notes__body">
        <section
          id={`${tabPrefix}-note-panel`}
          className="plugin-sticky-notes__panel plugin-sticky-notes__note"
          role="tabpanel"
          aria-labelledby={`${tabPrefix}-note-tab`}
          data-active={activePane === "note"}
        >
          <label htmlFor={`${tabPrefix}-note-input`}>便签内容</label>
          <textarea
            id={`${tabPrefix}-note-input`}
            value={notes.document.note}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="在这里随手记下内容…"
            onChange={(event) => notes.setNoteText(event.target.value)}
            onBlur={notes.flush}
          />
        </section>

        <section
          id={`${tabPrefix}-todos-panel`}
          className="plugin-sticky-notes__panel plugin-sticky-notes__todos"
          role="tabpanel"
          aria-labelledby={`${tabPrefix}-todos-tab`}
          data-active={activePane === "todos"}
        >
          <form className="plugin-sticky-notes__todo-form" onSubmit={submitTodo}>
            <label htmlFor={`${tabPrefix}-todo-input`}>新增待办</label>
            <input
              id={`${tabPrefix}-todo-input`}
              value={todoDraft}
              maxLength={TODO_MAX_LENGTH}
              placeholder={todoLimitReached ? "已达到 50 项上限" : "添加一项待办"}
              disabled={todoLimitReached}
              onChange={(event) => setTodoDraft(event.target.value)}
            />
            <button
              type="submit"
              disabled={todoLimitReached || todoDraft.trim().length === 0}
            >
              添加
            </button>
          </form>

          {notes.document.todos.length === 0 ? (
            <p className="plugin-sticky-notes__empty">还没有待办事项</p>
          ) : (
            <ul className="plugin-sticky-notes__todo-list">
              {notes.document.todos.map((todo) => (
                <li
                  key={todo.id}
                  className={todo.completed ? "plugin-sticky-notes__todo--completed" : ""}
                >
                  <button
                    className="plugin-sticky-notes__todo-toggle"
                    type="button"
                    aria-pressed={todo.completed}
                    aria-label={`${todo.completed ? "标记为未完成" : "标记为已完成"}：${todo.text}`}
                    onClick={() => notes.toggleTodoItem(todo.id)}
                  >
                    <span className="plugin-sticky-notes__check" aria-hidden="true" />
                    <span>{todo.text}</span>
                  </button>
                  <button
                    className="plugin-sticky-notes__todo-delete"
                    type="button"
                    aria-label={`删除待办：${todo.text}`}
                    onClick={() => notes.removeTodoItem(todo.id)}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {notes.errorMessage && notes.saveStatus === "error" ? (
        <div className="plugin-sticky-notes__save-error" role="alert">
          {notes.errorMessage}
        </div>
      ) : null}
    </section>
  );
}

function SaveStatus({
  status,
  hasError,
  onRetry,
}: {
  readonly status: "idle" | "saving" | "saved" | "error";
  readonly hasError: boolean;
  readonly onRetry: () => void;
}) {
  if (hasError) {
    return (
      <button type="button" onClick={onRetry}>
        保存失败，重试
      </button>
    );
  }

  return (
    <span>
      {status === "saving" ? "保存中…" : status === "saved" ? "已保存" : "本地保存"}
    </span>
  );
}

function WidgetState({
  size,
  title,
  detail,
  action,
  onAction,
}: {
  readonly size: "small" | "medium" | "wide";
  readonly title: string;
  readonly detail: string;
  readonly action?: string;
  readonly onAction?: () => void;
}) {
  return (
    <section
      className={`plugin-sticky-notes plugin-sticky-notes--${size} plugin-sticky-notes--state`}
      aria-label="桌面便签状态"
    >
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {action && onAction ? (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </section>
  );
}
