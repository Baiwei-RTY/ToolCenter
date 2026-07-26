import type { PluginContext } from "@tool-center/plugin-contract";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  advancePomodoro,
  createDefaultPomodoroDocument,
  normalizePomodoroDocument,
  pausePomodoro,
  pomodoroStorageKey,
  resetPomodoro,
  startPomodoro,
  switchPomodoroPhase,
  updatePomodoroDurations,
  type PomodoroDocument,
  type PomodoroPhase,
} from "./pomodoro-model";

type LoadStatus = "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface PomodoroController {
  readonly document: PomodoroDocument;
  readonly nowMs: number;
  readonly loadStatus: LoadStatus;
  readonly saveStatus: SaveStatus;
  readonly errorMessage?: string;
  start(): void;
  pause(): void;
  reset(): void;
  setPhase(phase: PomodoroPhase): void;
  updateDurations(focusMinutes: number, breakMinutes: number): void;
  retryLoad(): void;
  retrySave(): void;
}

export function usePomodoro(
  context: PluginContext,
  instanceId: string,
  visible: boolean,
): PomodoroController {
  const storageKey = pomodoroStorageKey(instanceId);
  const [document, setDocument] = useState(createDefaultPomodoroDocument);
  const [nowMs, setNowMs] = useState(Date.now);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [reloadToken, setReloadToken] = useState(0);
  const documentRef = useRef(document);
  const mountedRef = useRef(false);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const saveRevisionRef = useRef(0);
  const completedLoadTokenRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const queueSave = useCallback(
    (nextDocument: PomodoroDocument) => {
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
          if (mountedRef.current && saveRevisionRef.current === revision) {
            setSaveStatus("saved");
          }
        })
        .catch((error: unknown) => {
          if (mountedRef.current && saveRevisionRef.current === revision) {
            setSaveStatus("error");
            setErrorMessage("计时状态保存失败，请重试。");
          }
          void logPomodoroError(context, instanceId, "保存计时状态失败", error);
        });
    },
    [context, instanceId, storageKey],
  );

  const commit = useCallback(
    (nextDocument: PomodoroDocument, actionAt = Date.now()) => {
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      setNowMs(actionAt);
      queueSave(nextDocument);
    },
    [queueSave],
  );

  useEffect(() => {
    let active = true;
    if (!visible || completedLoadTokenRef.current === reloadToken) {
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
        const normalizedAt = Date.now();
        const normalized = normalizePomodoroDocument(stored, normalizedAt);
        completedLoadTokenRef.current = reloadToken;
        documentRef.current = normalized;
        setDocument(normalized);
        setNowMs(normalizedAt);
        setLoadStatus("ready");
        setSaveStatus("idle");
        queueSave(normalized);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        completedLoadTokenRef.current = reloadToken;
        setLoadStatus("error");
        setErrorMessage("无法读取番茄钟数据，请重试。");
        void logPomodoroError(context, instanceId, "读取计时状态失败", error);
      });

    return () => {
      active = false;
    };
  }, [context, instanceId, queueSave, reloadToken, storageKey, visible]);

  useEffect(() => {
    if (
      !visible ||
      loadStatus !== "ready" ||
      document.status !== "running"
    ) {
      return;
    }

    try {
      const release = context.scheduler.register({
        id: "pomodoro-tick",
        intervalMs: 500,
        priority: "normal",
        callback: () => {
          const tickAt = Date.now();
          setNowMs(tickAt);
          const current = documentRef.current;
          const advanced = advancePomodoro(current, tickAt);
          if (advanced !== current) {
            commit(advanced, tickAt);
          }
        },
      });
      return () => {
        void release();
      };
    } catch (error) {
      queueMicrotask(() => {
        if (mountedRef.current) {
          setErrorMessage("计时调度启动失败，请重置后重试。");
        }
      });
      void logPomodoroError(context, instanceId, "启动计时调度失败", error);
      return;
    }
  }, [
    commit,
    context,
    document.status,
    instanceId,
    loadStatus,
    visible,
  ]);

  return {
    document,
    nowMs,
    loadStatus,
    saveStatus,
    errorMessage,
    start: () => {
      const actionAt = Date.now();
      commit(startPomodoro(documentRef.current, actionAt), actionAt);
    },
    pause: () => {
      const actionAt = Date.now();
      commit(pausePomodoro(documentRef.current, actionAt), actionAt);
    },
    reset: () => {
      commit(resetPomodoro(documentRef.current));
    },
    setPhase: (phase) => {
      commit(switchPomodoroPhase(documentRef.current, phase));
    },
    updateDurations: (focusMinutes, breakMinutes) => {
      commit(
        updatePomodoroDurations(
          documentRef.current,
          focusMinutes,
          breakMinutes,
        ),
      );
    },
    retryLoad: () => {
      setLoadStatus("loading");
      setSaveStatus("idle");
      setErrorMessage(undefined);
      setReloadToken((current) => current + 1);
    },
    retrySave: () => {
      queueSave(documentRef.current);
    },
  };
}

async function logPomodoroError(
  context: PluginContext,
  instanceId: string,
  message: string,
  error: unknown,
): Promise<void> {
  await context.logger
    .error(message, {
      instanceId,
      error: error instanceof Error ? error.message : String(error),
    })
    .catch(() => undefined);
}
