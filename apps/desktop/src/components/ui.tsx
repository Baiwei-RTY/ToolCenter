import type { InputHTMLAttributes, ReactNode } from "react";

import { Icon } from "./Icon";

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

interface StatusBadgeProps {
  readonly tone: "success" | "info" | "warning" | "error" | "neutral";
  readonly children: ReactNode;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label: string;
}

export function Switch({ label, className = "", ...props }: SwitchProps) {
  return (
    <label className={`switch ${className}`.trim()}>
      <input type="checkbox" aria-label={label} {...props} />
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
    </label>
  );
}

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
  readonly tone?: "neutral" | "error" | "warning";
}

export function EmptyState({
  title,
  description,
  action,
  tone = "neutral",
}: EmptyStateProps) {
  const icon = tone === "error" ? "close" : tone === "warning" ? "warning" : "favorite";
  return (
    <div className={`empty-state empty-state--${tone}`}>
      <Icon name={icon} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

interface InlineBannerProps {
  readonly tone: "info" | "warning" | "error" | "success";
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

export function InlineBanner({ tone, title, description, action }: InlineBannerProps) {
  return (
    <div className={`inline-banner inline-banner--${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon name={tone === "error" ? "close" : tone === "warning" ? "warning" : tone === "success" ? "check" : "info"} />
      <div className="inline-banner__copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {action ? <div className="inline-banner__action">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}) {
  return (
    <header className="section-heading">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

