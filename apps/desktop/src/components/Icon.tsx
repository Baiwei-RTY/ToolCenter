type IconName =
  | "activity"
  | "add"
  | "app"
  | "back"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "close"
  | "command"
  | "diagnostics"
  | "favorite"
  | "favorite-filled"
  | "filter"
  | "forward"
  | "grid"
  | "history"
  | "info"
  | "list"
  | "maximize"
  | "minimize"
  | "more"
  | "pause"
  | "play"
  | "plugin"
  | "refresh"
  | "search"
  | "settings"
  | "shield"
  | "stop"
  | "warning"
  | "weather";

const glyphs: Record<IconName, string> = {
  activity: "\uE7E7",
  add: "\uE710",
  app: "\uE80F",
  back: "\uE72B",
  check: "\uE73E",
  "chevron-down": "\uE70D",
  "chevron-right": "\uE76C",
  close: "\uE8BB",
  command: "\uE756",
  diagnostics: "\uE9D9",
  favorite: "\uE734",
  "favorite-filled": "\uE735",
  filter: "\uE71C",
  forward: "\uE72A",
  grid: "\uE80A",
  history: "\uE81C",
  info: "\uE946",
  list: "\uEA37",
  maximize: "\uE922",
  minimize: "\uE921",
  more: "\uE712",
  pause: "\uE769",
  play: "\uE768",
  plugin: "\uE7B8",
  refresh: "\uE72C",
  search: "\uE721",
  settings: "\uE713",
  shield: "\uEA18",
  stop: "\uE71A",
  warning: "\uE7BA",
  weather: "\uE706",
};

interface IconProps {
  readonly name: IconName;
  readonly className?: string;
}

export function Icon({ name, className = "" }: IconProps) {
  return (
    <span className={`tc-icon ${className}`.trim()} aria-hidden="true">
      {glyphs[name]}
    </span>
  );
}
