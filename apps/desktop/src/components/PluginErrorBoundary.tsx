import { Component, type ErrorInfo, type ReactNode } from "react";

import { notify } from "../services/notifications";

interface PluginErrorBoundaryProps {
  readonly pluginId: string;
  readonly children: ReactNode;
}

interface PluginErrorBoundaryState {
  readonly error: Error | null;
}

export class PluginErrorBoundary extends Component<
  PluginErrorBoundaryProps,
  PluginErrorBoundaryState
> {
  state: PluginErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PluginErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    notify({
      title: "插件发生异常",
      message: `${error.message}\n${info.componentStack ?? ""}`,
      level: "error",
      pluginId: this.props.pluginId,
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <section className="plugin-error-state" role="alert">
          <h2>插件界面无法继续运行</h2>
          <p>{this.state.error.message}</p>
          <button className="button--danger" type="button" onClick={() => this.setState({ error: null })}>
            重新加载插件界面
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
