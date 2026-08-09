import type { PluginContext } from "@tool-center/plugin-contract";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  addTodo,
  createEmptyDocument,
  normalizeDocument,
  removeTodo,
  reorderTodo,
  setBody,
  setSplitPercent,
  setTitle,
  storageKeyForInstance,
  toggleTodo,
  type StickyNotesDocument,
} from "./sticky-notes-model";

type LoadStatus = "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 350;

export interface StickyNotesController {
  readonly document: StickyNotesDocument;
  readonly loadStatus: LoadStatus;
  readonly saveStatus: SaveStatus;
  readonly errorMessage?: string;
  setTitleText(title: string): void;
  setBodyText(body: string): void;
  setSplitPosition(splitPercent: number): void;
  addTodoItem(text: string): boolean;
  toggleTodoItem(todoId: string): void;
  removeTodoItem(todoId: string): void;
  reorderTodoItem(sourceId: string, targetId: string, after: boolean): void;
  flush(): void;
  retryLoad(): void;
  retrySave(): void;
}

export function useStickyNotes(
  context: PluginContext,
  instanceId: string,
  visible: boolean,
): StickyNotesController {
  const storageKey = storageKeyForInstance(instanceId);
  const [document, setDocument] = useState(createEmptyDocument);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [reloadToken, setReloadToken] = useState(0);
  const documentRef = useRef(document);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const lastQueuedDocumentRef = useRef<StickyNotesDocument | undefined>(undefined);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(false);
  const saveRevisionRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!visible) {
      return () => {
        active = false;
      };
    }

    void context.storage
      .read<unknown>(storageKey)
      .then((stored) => {
        if (!active) {
          return;
        }
        const normalized = normalizeDocument(stored);
        documentRef.current = normalized;
        lastQueuedDocumentRef.current = normalized;
        dirtyRef.current = false;
        setDocument(normalized);
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setLoadStatus("error");
        setErrorMessage("无法读取便签数据，请重试。");
        void logStorageError(context, instanceId, "读取", error);
      });

    return () => {
      active = false;
    };
  }, [context, instanceId, reloadToken, storageKey, visible]);

  const enqueueSave = useCallback(
    (nextDocument: StickyNotesDocument) => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = undefined;
      }

      lastQueuedDocumentRef.current = nextDocument;
      const revision = saveRevisionRef.current + 1;
      saveRevisionRef.current = revision;
      if (mountedRef.current) {
        setSaveStatus("saving");
        setErrorMessage(undefined);
      }

      const operation = writeChainRef.current
        .catch(() => undefined)
        .then(() => context.storage.write(storageKey, nextDocument));
      writeChainRef.current = operation;

      void operation
        .then(() => {
          if (documentRef.current === nextDocument) {
            dirtyRef.current = false;
          }
          if (mountedRef.current && saveRevisionRef.current === revision) {
            setSaveStatus("saved");
          }
        })
        .catch((error: unknown) => {
          if (mountedRef.current && saveRevisionRef.current === revision) {
            setSaveStatus("error");
            setErrorMessage("保存失败，当前内容仍保留在小组件中。");
          }
          void logStorageError(context, instanceId, "保存", error);
        });
    },
    [context, instanceId, storageKey],
  );

  const updateDocument = useCallback(
    (
      update: (current: StickyNotesDocument) => StickyNotesDocument,
      immediate: boolean,
    ) => {
      const nextDocument = update(documentRef.current);
      if (nextDocument === documentRef.current) {
        return false;
      }

      documentRef.current = nextDocument;
      dirtyRef.current = true;
      setDocument(nextDocument);
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
      }

      if (immediate) {
        enqueueSave(nextDocument);
      } else {
        setSaveStatus("saving");
        saveTimerRef.current = window.setTimeout(() => {
          saveTimerRef.current = undefined;
          enqueueSave(nextDocument);
        }, SAVE_DELAY_MS);
      }
      return true;
    },
    [enqueueSave],
  );

  const flush = useCallback(() => {
    if (
      dirtyRef.current &&
      lastQueuedDocumentRef.current !== documentRef.current
    ) {
      enqueueSave(documentRef.current);
    }
  }, [enqueueSave]);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = undefined;
      }
      if (
        dirtyRef.current &&
        lastQueuedDocumentRef.current !== documentRef.current
      ) {
        const finalDocument = documentRef.current;
        void writeChainRef.current
          .catch(() => undefined)
          .then(() => context.storage.write(storageKey, finalDocument));
      }
    },
    [context, storageKey],
  );

  return {
    document,
    loadStatus,
    saveStatus,
    errorMessage,
    setTitleText: (title) => {
      updateDocument((current) => setTitle(current, title), false);
    },
    setBodyText: (body) => {
      updateDocument((current) => setBody(current, body), false);
    },
    setSplitPosition: (splitPercent) => {
      updateDocument((current) => setSplitPercent(current, splitPercent), false);
    },
    addTodoItem: (text) => {
      const nextId =
        globalThis.crypto?.randomUUID?.() ??
        `todo-${Date.now().toString(36)}-${documentRef.current.todos.length}`;
      return updateDocument((current) => addTodo(current, text, nextId), true);
    },
    toggleTodoItem: (todoId) => {
      updateDocument((current) => toggleTodo(current, todoId), true);
    },
    removeTodoItem: (todoId) => {
      updateDocument((current) => removeTodo(current, todoId), true);
    },
    reorderTodoItem: (sourceId, targetId, after) => {
      updateDocument(
        (current) => reorderTodo(current, sourceId, targetId, after),
        true,
      );
    },
    flush,
    retryLoad: () => {
      setLoadStatus("loading");
      setSaveStatus("idle");
      setErrorMessage(undefined);
      setReloadToken((current) => current + 1);
    },
    retrySave: () => {
      enqueueSave(documentRef.current);
    },
  };
}

async function logStorageError(
  context: PluginContext,
  instanceId: string,
  operation: string,
  error: unknown,
): Promise<void> {
  await context.logger
    .error(`桌面便签${operation}失败`, {
      instanceId,
      error: error instanceof Error ? error.message : String(error),
    })
    .catch(() => undefined);
}
