import type { AudioDeviceSummary } from "@tool-center/plugin-contract";

import bluetoothIcon from "./assets/audio-bluetooth-device.svg";
import disconnectedIcon from "./assets/audio-device-disconnected.svg";
import headphonesIcon from "./assets/audio-headphones.svg";
import speakerIcon from "./assets/audio-speaker.svg";
import usbIcon from "./assets/audio-usb-device.svg";

interface AudioIconProps {
  readonly device?: AudioDeviceSummary | null;
  readonly className?: string;
}

export function AudioIcon({ device, className = "" }: AudioIconProps) {
  return (
    <span className={`tc-audio-icon ${className}`.trim()} aria-hidden="true">
      <img src={deviceIcon(device)} alt="" />
    </span>
  );
}

function deviceIcon(device?: AudioDeviceSummary | null): string {
  if (!device || device.state !== "active") return disconnectedIcon;
  const name = device.name.toLocaleLowerCase();
  if (/bluetooth|蓝牙/.test(name)) return bluetoothIcon;
  if (/usb/.test(name)) return usbIcon;
  if (/headphone|headset|耳机/.test(name)) return headphonesIcon;
  return speakerIcon;
}
