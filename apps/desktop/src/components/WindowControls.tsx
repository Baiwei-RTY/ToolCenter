import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriHost } from "@tool-center/plugin-runtime";

import { Icon } from "./Icon";

async function withWindow(action: (window: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
  if (isTauriHost()) {
    await action(getCurrentWindow());
  }
}

export function WindowControls() {
  return (
    <div className="window-controls" aria-label="窗口控制">
      <button type="button" aria-label="最小化" onClick={() => void withWindow((window) => window.minimize())}>
        <Icon name="minimize" />
      </button>
      <button
        type="button"
        aria-label="最大化或还原"
        onClick={() => void withWindow((window) => window.toggleMaximize())}
      >
        <Icon name="maximize" />
      </button>
      <button className="window-controls__close" type="button" aria-label="关闭" onClick={() => void withWindow((window) => window.close())}>
        <Icon name="close" />
      </button>
    </div>
  );
}
