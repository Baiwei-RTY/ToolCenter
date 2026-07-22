import type { PageEntrypointModule, PluginContext, PluginPageDefinition } from "@tool-center/plugin-contract";
import { Suspense, useEffect, useState } from "react";

import { pluginRuntime } from "../runtime/host";
import { PluginErrorBoundary } from "./PluginErrorBoundary";

const pageEntrypointMounts = new Map<string, number>();

interface PluginPageHostProps {
  readonly pluginId: string;
  readonly pageId: string;
}

interface LoadedPage {
  readonly key: string;
  readonly definition: PluginPageDefinition;
  readonly context: PluginContext;
}

interface PageLoadError {
  readonly key: string;
  readonly message: string;
}

export function PluginPageHost({ pluginId, pageId }: PluginPageHostProps) {
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [error, setError] = useState<PageLoadError | null>(null);
  const pageKey = `${pluginId}:${pageId}`;

  useEffect(() => {
    let cancelled = false;
    retainPageEntrypoint(pageKey);
    void pluginRuntime
      .activate(pluginId, "page")
      .then(({ module, context }) => {
        const page = (module as PageEntrypointModule).pages.find((candidate) => candidate.id === pageId);
        if (!page) {
          throw new Error(`Page "${pageId}" was not found in plugin "${pluginId}".`);
        }
        if (!cancelled) {
          setLoaded({ key: pageKey, definition: page, context });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError({ key: pageKey, message: reason instanceof Error ? reason.message : String(reason) });
        }
      });

    return () => {
      cancelled = true;
      releasePageEntrypoint(pageKey, () => pluginRuntime.deactivate(pluginId, "page"));
    };
  }, [pageId, pageKey, pluginId]);

  if (error?.key === pageKey) {
    return (
      <section className="page plugin-state-page" role="alert">
        <h1>插件加载失败</h1>
        <p>{error.message}</p>
      </section>
    );
  }
  if (loaded?.key !== pageKey) {
    return <div className="page plugin-loading" role="status">正在加载插件页面……</div>;
  }

  const PageComponent = loaded.definition.component;
  return (
    <PluginErrorBoundary key={`${pluginId}:${pageId}`} pluginId={pluginId}>
      <div className="page plugin-content-shell"><Suspense fallback={<p>正在加载页面内容……</p>}><PageComponent context={loaded.context} /></Suspense></div>
    </PluginErrorBoundary>
  );
}

function retainPageEntrypoint(pageKey: string): void {
  pageEntrypointMounts.set(pageKey, (pageEntrypointMounts.get(pageKey) ?? 0) + 1);
}

function releasePageEntrypoint(pageKey: string, deactivate: () => Promise<void>): void {
  queueMicrotask(() => {
    const remaining = (pageEntrypointMounts.get(pageKey) ?? 1) - 1;
    if (remaining > 0) {
      pageEntrypointMounts.set(pageKey, remaining);
      return;
    }
    pageEntrypointMounts.delete(pageKey);
    void deactivate().catch(() => undefined);
  });
}
