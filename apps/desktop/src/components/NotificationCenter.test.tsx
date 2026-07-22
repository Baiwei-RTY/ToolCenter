// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../test-setup";
import { NotificationCenter } from "./NotificationCenter";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NotificationCenter", () => {
  it("shows host notifications and lets the user dismiss them", () => {
    vi.useFakeTimers();
    render(<NotificationCenter />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("toolcenter:notification", {
          detail: { title: "操作完成", message: "测试通知", level: "success" },
        }),
      );
    });

    expect(screen.getByText("操作完成")).toBeInTheDocument();
    expect(screen.getByText("测试通知")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭提示" }));
    expect(screen.queryByText("操作完成")).not.toBeInTheDocument();
  });
});

