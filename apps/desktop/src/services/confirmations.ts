export interface ConfirmationOptions {
  readonly title: string;
  readonly message: string;
  readonly detail?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: "permission" | "danger" | "normal";
}

export interface ConfirmationRequest extends ConfirmationOptions {
  readonly resolve: (accepted: boolean) => void;
}

export function requestConfirmation(options: ConfirmationOptions): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<ConfirmationRequest>("toolcenter:confirmation", {
        detail: { ...options, resolve },
      }),
    );
  });
}

