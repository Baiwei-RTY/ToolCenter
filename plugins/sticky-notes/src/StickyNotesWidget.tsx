import type { WidgetProps } from "@tool-center/plugin-contract";
import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import "@mdui/icons/add.js";
import "@mdui/icons/check-box.js";
import "@mdui/icons/check-box-outline-blank.js";
import "@mdui/icons/check-circle-outline.js";
import "@mdui/icons/delete-outline.js";
import "@mdui/icons/drag-indicator.js";

import {
  BODY_MAX_LENGTH,
  SPLIT_MAX_PERCENT,
  SPLIT_MIN_PERCENT,
  TITLE_MAX_LENGTH,
  TODO_MAX_ITEMS,
  TODO_MAX_LENGTH,
} from "./sticky-notes-model";
import "./styles.css";
import { useStickyNotes } from "./use-sticky-notes";

type IconName =
  | "add"
  | "checkboxChecked"
  | "checkboxEmpty"
  | "delete"
  | "drag"
  | "saved";

interface DropTarget {
  readonly id: string;
  readonly after: boolean;
}

function Icon({ name }: { readonly name: IconName }) {
  const tags: Record<IconName, string> = {
    add: "mdui-icon-add",
    checkboxChecked: "mdui-icon-check-box",
    checkboxEmpty: "mdui-icon-check-box-outline-blank",
    delete: "mdui-icon-delete-outline",
    drag: "mdui-icon-drag-indicator",
    saved: "mdui-icon-check-circle-outline",
  };

  return createElement(tags[name], {
    class: "plugin-sticky-notes__icon",
    "aria-hidden": "true",
  });
}

export default function StickyNotesWidget({ context, widget }: WidgetProps) {
  const notes = useStickyNotes(context, widget.instanceId, widget.visible);
  const [todoDraft, setTodoDraft] = useState("");
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [draggingId, setDraggingId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<DropTarget>();
  const resizeRef = useRef<{ cleanup(): void } | undefined>(undefined);
  const todoDragRef = useRef<{ cleanup(): void } | undefined>(undefined);
  const dropTargetRef = useRef<DropTarget | undefined>(undefined);
  const tabPrefix = `sticky-notes-${widget.instanceId}`;

  useEffect(
    () => () => {
      resizeRef.current?.cleanup();
      todoDragRef.current?.cleanup();
    },
    [],
  );

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
  const surfaceStyle = {
    "--sticky-split-position": `${notes.document.splitPercent}%`,
  } as CSSProperties;

  const submitTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (notes.addTodoItem(todoDraft)) {
      setTodoDraft("");
      setIsAddingTodo(false);
    }
  };

  const moveTodoByOffset = (todoId: string, offset: -1 | 1) => {
    const currentIndex = notes.document.todos.findIndex((todo) => todo.id === todoId);
    const target = notes.document.todos[currentIndex + offset];
    if (!target) return;
    notes.reorderTodoItem(todoId, target.id, offset > 0);
  };

  const startTodoDrag = (
    event: ReactMouseEvent<HTMLLIElement>,
    sourceId: string,
  ) => {
    if (
      event.button !== 0 ||
      (event.target instanceof Element && event.target.closest("button, input"))
    ) {
      return;
    }

    event.preventDefault();
    const startY = event.clientY;
    let active = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!active && Math.abs(moveEvent.clientY - startY) < 5) return;

      active = true;
      moveEvent.preventDefault();
      setDraggingId(sourceId);

      const targetRow = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest<HTMLElement>("[data-sticky-todo-id]");
      const targetId = targetRow?.dataset.stickyTodoId;

      if (!targetRow || !targetId || targetId === sourceId) {
        dropTargetRef.current = undefined;
        setDropTarget(undefined);
        return;
      }

      const rect = targetRow.getBoundingClientRect();
      const nextTarget = {
        id: targetId,
        after: moveEvent.clientY >= rect.top + rect.height / 2,
      } satisfies DropTarget;
      dropTargetRef.current = nextTarget;
      setDropTarget(nextTarget);
    };

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      todoDragRef.current = undefined;
    };

    const handleMouseUp = () => {
      const target = dropTargetRef.current;
      if (active && target) {
        notes.reorderTodoItem(sourceId, target.id, target.after);
      }
      cleanup();
      dropTargetRef.current = undefined;
      setDraggingId(undefined);
      setDropTarget(undefined);
    };

    todoDragRef.current?.cleanup();
    todoDragRef.current = { cleanup };
    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", handleMouseUp, { once: true });
  };

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.focus();
    const surfaceRect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!surfaceRect) return;

    const startY = event.clientY;
    const startPercent = notes.document.splitPercent;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaPercent = ((moveEvent.clientY - startY) / surfaceRect.height) * 100;
      notes.setSplitPosition(startPercent + deltaPercent);
    };

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      resizeRef.current = undefined;
    };

    const handleMouseUp = () => {
      cleanup();
      notes.flush();
    };

    resizeRef.current?.cleanup();
    resizeRef.current = { cleanup };
    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", handleMouseUp, { once: true });
  };

  const handleDividerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const next =
      event.key === "Home"
        ? SPLIT_MIN_PERCENT
        : event.key === "End"
          ? SPLIT_MAX_PERCENT
          : notes.document.splitPercent + (event.key === "ArrowDown" ? 2 : -2);
    notes.setSplitPosition(next);
    notes.flush();
  };

  return (
    <section
      className={`plugin-sticky-notes plugin-sticky-notes--${widget.size}`}
      style={surfaceStyle}
      aria-label="桌面便签"
    >
      <div className="plugin-sticky-notes__upper">
        <label
          className="plugin-sticky-notes__visually-hidden"
          htmlFor={`${tabPrefix}-title-input`}
        >
          便签标题
        </label>
        <input
          id={`${tabPrefix}-title-input`}
          className="plugin-sticky-notes__title"
          value={notes.document.title}
          maxLength={TITLE_MAX_LENGTH}
          spellCheck={false}
          aria-describedby={`${tabPrefix}-save-status`}
          onChange={(event) => notes.setTitleText(event.target.value)}
          onBlur={notes.flush}
        />

        <label
          className="plugin-sticky-notes__visually-hidden"
          htmlFor={`${tabPrefix}-body-input`}
        >
          便签正文
        </label>
        <textarea
          id={`${tabPrefix}-body-input`}
          className="plugin-sticky-notes__body"
          value={notes.document.body}
          maxLength={BODY_MAX_LENGTH}
          placeholder="随手记下内容…"
          spellCheck={false}
          aria-describedby={`${tabPrefix}-save-status`}
          onChange={(event) => notes.setBodyText(event.target.value)}
          onBlur={notes.flush}
        />
      </div>

      <div
        className="plugin-sticky-notes__splitter"
        role="separator"
        tabIndex={0}
        aria-label="调整正文与清单区域高度"
        aria-orientation="horizontal"
        aria-valuemin={SPLIT_MIN_PERCENT}
        aria-valuemax={SPLIT_MAX_PERCENT}
        aria-valuenow={Math.round(notes.document.splitPercent)}
        aria-valuetext={`上方区域占 ${Math.round(notes.document.splitPercent)}%`}
        title="按住并上下拖动调整区域高度"
        onMouseDown={startResize}
        onKeyDown={handleDividerKeyDown}
      />

      <div className="plugin-sticky-notes__lower">
        <ul className="plugin-sticky-notes__checklist" aria-label="便签清单">
          {notes.document.todos.map((todo) => {
            const dropClass =
              dropTarget?.id === todo.id
                ? dropTarget.after
                  ? " plugin-sticky-notes__item--drop-after"
                  : " plugin-sticky-notes__item--drop-before"
                : "";

            return (
              <li
                key={todo.id}
                className={`${todo.completed ? "plugin-sticky-notes__item--completed" : ""}${draggingId === todo.id ? " plugin-sticky-notes__item--dragging" : ""}${dropClass}`.trim()}
                data-sticky-todo-id={todo.id}
                tabIndex={0}
                aria-label={`${todo.text}。按住拖动调整顺序，或按 Alt 加上下方向键移动`}
                title="按住拖动调整顺序"
                onMouseDown={(event) => startTodoDrag(event, todo.id)}
                onKeyDown={(event) => {
                  if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) {
                    return;
                  }
                  event.preventDefault();
                  moveTodoByOffset(todo.id, event.key === "ArrowUp" ? -1 : 1);
                }}
              >
                <span className="plugin-sticky-notes__drag-handle" aria-hidden="true">
                  <Icon name="drag" />
                </span>
                <button
                  className="plugin-sticky-notes__checkbox"
                  type="button"
                  role="checkbox"
                  aria-checked={todo.completed}
                  aria-label={`${todo.completed ? "标记为未完成" : "标记为已完成"}：${todo.text}`}
                  onClick={() => notes.toggleTodoItem(todo.id)}
                >
                  <Icon
                    name={todo.completed ? "checkboxChecked" : "checkboxEmpty"}
                  />
                </button>
                <span className="plugin-sticky-notes__item-text">{todo.text}</span>
                <button
                  className="plugin-sticky-notes__item-delete"
                  type="button"
                  aria-label={`删除清单项：${todo.text}`}
                  onClick={() => notes.removeTodoItem(todo.id)}
                >
                  <Icon name="delete" />
                </button>
              </li>
            );
          })}
        </ul>

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
              <button type="submit" disabled={todoDraft.trim().length === 0}>
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
              <Icon name="add" />
              <span>{todoLimitReached ? "清单已满" : "添加清单项"}</span>
            </button>
          )}

          {!isAddingTodo ? (
            <div
              className="plugin-sticky-notes__status"
              id={`${tabPrefix}-save-status`}
              role="status"
              aria-live="polite"
            >
              <SaveStatus
                status={notes.saveStatus}
                hasError={notes.saveStatus === "error"}
                onRetry={notes.retrySave}
              />
            </div>
          ) : null}
        </footer>
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
    <span className="plugin-sticky-notes__status-label">
      <Icon name="saved" />
      <span>
        {status === "saving" ? "保存中…" : status === "saved" ? "已保存" : "本地"}
      </span>
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
