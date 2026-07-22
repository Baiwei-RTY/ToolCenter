import type { AudioDeviceSummary, AudioService } from "@tool-center/plugin-contract";
import { describe, expect, it, vi } from "vitest";

import {
  allDefaultRoles,
  classifyAudioFailure,
  isDefaultForEveryRole,
  loadAudioOutputSnapshot,
  normalizeOutputDevices,
  primaryDefault,
  setAllDefaultOutputRoles,
} from "../src/audio-device-model";

const speakers: AudioDeviceSummary = {
  id: "speakers",
  name: "扬声器",
  kind: "output",
  state: "active",
  defaultRoles: [...allDefaultRoles],
};

const headphones: AudioDeviceSummary = {
  id: "headphones",
  name: "蓝牙耳机",
  kind: "output",
  state: "active",
  defaultRoles: [],
};

const microphone: AudioDeviceSummary = {
  id: "microphone",
  name: "麦克风",
  kind: "input",
  state: "active",
  defaultRoles: [],
};

const defaults = {
  console: speakers,
  multimedia: speakers,
  communications: speakers,
} as const;

describe("audio output device model", () => {
  it("removes input devices and keeps the current default first", () => {
    const result = normalizeOutputDevices([headphones, microphone, speakers], defaults);
    expect(result.map((device) => device.id)).toEqual(["speakers", "headphones"]);
  });

  it("recognizes the device shared by all Windows default roles", () => {
    expect(primaryDefault(defaults)).toBe(speakers);
    expect(isDefaultForEveryRole("speakers", defaults)).toBe(true);
    expect(isDefaultForEveryRole("headphones", defaults)).toBe(false);
  });

  it("always targets the three supported output roles", () => {
    expect(allDefaultRoles).toEqual(["console", "multimedia", "communications"]);
  });

  it("asks the host only for output devices and output defaults", async () => {
    const audio = createAudioService();
    await loadAudioOutputSnapshot(audio);
    expect(audio.listDevices).toHaveBeenCalledWith("output");
    expect(audio.getDefaultDevice).toHaveBeenNthCalledWith(1, "output", "console");
    expect(audio.getDefaultDevice).toHaveBeenNthCalledWith(2, "output", "multimedia");
    expect(audio.getDefaultDevice).toHaveBeenNthCalledWith(3, "output", "communications");
  });

  it("sets all three Windows roles in one switch operation", async () => {
    const audio = createAudioService();
    await setAllDefaultOutputRoles(audio, "headphones");
    expect(audio.setDefaultDevice).toHaveBeenCalledWith("headphones", allDefaultRoles);
  });

  it("classifies host capability errors for recovery UI", () => {
    expect(classifyAudioFailure(new Error("Audio is not supported"))).toBe("unsupported");
    expect(classifyAudioFailure(new Error("Service not available"))).toBe("unavailable");
    expect(classifyAudioFailure(new Error("Device disappeared"))).toBe("generic");
  });
});

function createAudioService(): AudioService {
  return {
    listDevices: vi.fn(async () => [speakers, headphones]),
    getDefaultDevice: vi.fn(async () => speakers),
    subscribeDeviceChanges: vi.fn(async () => () => undefined),
    setDefaultDevice: vi.fn(async () => undefined),
  };
}
