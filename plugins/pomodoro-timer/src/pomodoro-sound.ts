import type { PomodoroPhase } from "./pomodoro-model";

type AudioContextConstructor = new (
  contextOptions?: AudioContextOptions,
) => AudioContext;

type AudioWindow = Window & {
  readonly AudioContext?: AudioContextConstructor;
  readonly webkitAudioContext?: AudioContextConstructor;
};

export interface PomodoroSoundController {
  unlock(): void;
  play(completedPhase: PomodoroPhase): void;
  dispose(): void;
}

export function createPomodoroSoundController(): PomodoroSoundController {
  let audioContext: AudioContext | undefined;

  const getAudioContext = (): AudioContext | undefined => {
    if (audioContext?.state !== "closed") {
      return audioContext;
    }
    if (typeof window === "undefined") {
      return undefined;
    }

    const audioWindow = window as AudioWindow;
    const AudioContextClass =
      audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextClass) {
      return undefined;
    }

    try {
      audioContext = new AudioContextClass();
      return audioContext;
    } catch {
      return undefined;
    }
  };

  return {
    unlock() {
      const context = getAudioContext();
      if (context?.state === "suspended") {
        void context.resume().catch(() => undefined);
      }
    },
    play(completedPhase) {
      const context = getAudioContext();
      if (!context) {
        return;
      }

      const playChime = () => scheduleChime(context, completedPhase);
      if (context.state === "suspended") {
        void context.resume().then(playChime).catch(() => undefined);
        return;
      }
      playChime();
    },
    dispose() {
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => undefined);
      }
      audioContext = undefined;
    },
  };
}

function scheduleChime(
  audioContext: AudioContext,
  completedPhase: PomodoroPhase,
): void {
  const frequencies =
    completedPhase === "focus" ? [659.25, 880] : [880, 659.25];
  const startedAt = audioContext.currentTime + 0.02;

  frequencies.forEach((frequency, index) => {
    const noteStart = startedAt + index * 0.22;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.32);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.34);
  });
}
