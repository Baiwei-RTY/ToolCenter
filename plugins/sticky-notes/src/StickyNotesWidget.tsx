import type { WidgetProps } from "@tool-center/plugin-contract";
import { useState, type FormEvent } from "react";

import {
  NOTE_MAX_LENGTH,
  TODO_MAX_ITEMS,
  TODO_MAX_LENGTH,
} from "./sticky-notes-model";
import "./styles.css";
import { useStickyNotes } from "./use-sticky-notes";

export default function StickyNotesWidget({ context, widget }: WidgetProps) {
  const notes = useStickyNotes(context, widget.instanceId, widget.visible);
  const [todoDraft, setTodoDraft] = useState("");
  const [isAddingTodo, setIsAddingTodo] = useState(false);
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

  const todoLimitReached = notes.document.todos.length >= TODO_MAX_ITEMS;
  const submitTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (notes.addTodoItem(todoDraft)) {
      setTodoDraft("");
      setIsAddingTodo(false);
    }
  };

  return (
    <section
      className={`plugin-sticky-notes plugin-sticky-notes--${widget.size}`}
      aria-label="桌面便签"
    >
      <main className="plugin-sticky-notes__workspace">
        <label
          className="plugin-sticky-notes__visually-hidden"
          htmlFor={`${tabPrefix}-note-input`}
        >
          便签内容
        </label>
        <textarea
          id={`${tabPrefix}-note-input`}
          className="plugin-sticky-notes__editor"
          value={notes.document.note}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="随手记下内容…"
          onChange={(event) => notes.setNoteText(event.target.value)}
          onBlur={notes.flush}
        />

        {notes.document.todos.length > 0 ? (
          <ul className="plugin-sticky-notes__checklist" aria-label="便签清单">
            {notes.document.todos.map((todo) => (
              <li
                key={todo.id}
                className={todo.completed ? "plugin-sticky-notes__item--completed" : ""}
              >
                <label className="plugin-sticky-notes__item-toggle">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    aria-label={`${todo.completed ? "标记为未完成" : "标记为已完成"}：${todo.text}`}
                    onChange={() => notes.toggleTodoItem(todo.id)}
                  />
                  <span>{todo.text}</span>
                </label>
                <button
                  className="plugin-sticky-notes__item-delete"
                  type="button"
                  aria-label={`删除清单项：${todo.text}`}
                  onClick={() => notes.removeTodoItem(todo.id)}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      <footer className="plugin-sticky-notes__toolbar">
        {isAddingTodo ? (
          <form className="plugin-sticky-notes__composer" onSubmit={submitTodo}>
            <label
              className="plugin-sticky-notes__visually-hidden"
              htmlFor={`${tabPrefix}-todo-input`}
            >
              新增清单项
            </label>
            <input
              id={`${tabPrefix}-todo-input`}
              autoFocus
              value={todoDraft}
              maxLength={TODO_MAX_LENGTH}
              placeholder="写下清单项…"
              onChange={(event) => setTodoDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setTodoDraft("");
                  setIsAddingTodo(false);
                }
              }}
            />
            <button
              type="submit"
              disabled={todoDraft.trim().length === 0}
            >
              添加
            </button>
            <button
              type="button"
              onClick={() => {
                setTodoDraft("");
                setIsAddingTodo(false);
              }}
            >
              取消
            </button>
          </form>
        ) : (
          <button
            className="plugin-sticky-notes__add-item"
            type="button"
            disabled={todoLimitReached}
            onClick={() => setIsAddingTodo(true)}
          >
            {todoLimitReached ? "清单已满" : "添加清单项"}
          </button>
        )}

        {!isAddingTodo ? (
          <div className="plugin-sticky-notes__status" aria-live="polite">
            <SaveStatus
              status={notes.saveStatus}
              hasError={notes.saveStatus === "error"}
              onRetry={notes.retrySave}
            />
          </div>
        ) : null}
      </footer>

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
      {status === "saving" ? "保存中…" : status === "saved" ? "已保存" : "本地"}
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
