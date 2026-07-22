export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly userMessage: string;
  readonly pluginId?: string;
  readonly recoverable: boolean;
  readonly details?: unknown;
}

export class PluginContractError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PluginContractError";
    this.code = code;
  }
}

