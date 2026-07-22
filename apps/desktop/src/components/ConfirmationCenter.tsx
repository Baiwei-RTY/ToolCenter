import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";

import type { ConfirmationRequest } from "../services/confirmations";
import { Icon } from "./Icon";
import { StatusBadge } from "./ui";

export function ConfirmationCenter() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);

  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<ConfirmationRequest>).detail;
      setRequest((current) => {
        current?.resolve(false);
        return next;
      });
    };
    window.addEventListener("toolcenter:confirmation", listener);
    return () => window.removeEventListener("toolcenter:confirmation", listener);
  }, []);

  const finish = (accepted: boolean) => {
    if (!request) return;
    request.resolve(accepted);
    setRequest(null);
  };

  return (
    <Dialog.Root open={request !== null} onOpenChange={(open) => { if (!open) finish(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-overlay" />
        <Dialog.Content className={`confirm-dialog confirm-dialog--${request?.tone ?? "normal"}`} aria-describedby="confirmation-description">
          <span className="confirm-dialog__icon"><Icon name={request?.tone === "danger" ? "warning" : request?.tone === "permission" ? "shield" : "info"} /></span>
          <div className="confirm-dialog__copy">
            <Dialog.Title>{request?.title ?? "确认操作"}</Dialog.Title>
            <Dialog.Description className="confirm-dialog__description" id="confirmation-description">{request?.message ?? ""}</Dialog.Description>
            {request?.detail ? <p>{request.detail}</p> : null}
            {request?.tone === "permission" ? <StatusBadge tone="info">普通权限</StatusBadge> : null}
            {request?.tone === "danger" ? <StatusBadge tone="error">高风险</StatusBadge> : null}
          </div>
          <div className="confirm-dialog__actions">
            <button type="button" onClick={() => finish(false)}>{request?.cancelLabel ?? "取消"}</button>
            <button className={request?.tone === "danger" ? "button--danger button--danger-filled" : "button--primary"} type="button" onClick={() => finish(true)}>{request?.confirmLabel ?? "确认"}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
