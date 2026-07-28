export type Release = () => void | Promise<void>;

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface UiNotification {
  readonly title: string;
  readonly message?: string;
  readonly level?: NotificationLevel;
}

export interface UiService {
  notify(notification: UiNotification): void;
  confirm(options: {
    readonly title: string;
    readonly message: string;
    readonly dangerous?: boolean;
  }): Promise<boolean>;
}

export interface StorageService {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  list(): Promise<readonly string[]>;
}

export interface DatabaseService {
  query<T>(statementId: string, parameters?: readonly unknown[]): Promise<readonly T[]>;
  execute(statementId: string, parameters?: readonly unknown[]): Promise<number>;
}

export interface HostCommand<TResult = unknown> {
  readonly id: string;
  readonly payload?: unknown;
  readonly __resultType?: TResult;
}

export interface CommandService {
  execute<TResult>(command: HostCommand<TResult>): Promise<TResult>;
}

export interface SchedulerRegistration {
  readonly id: string;
  readonly intervalMs: number;
  readonly runWhenHidden?: boolean;
  readonly priority?: "low" | "normal" | "high";
  readonly callback: () => void | Promise<void>;
}

export interface SchedulerService {
  register(registration: SchedulerRegistration): Release;
}

export interface EventService {
  emit<T>(eventName: string, payload: T): void;
  subscribe<T>(eventName: string, listener: (payload: T) => void): Release;
}

export interface ClipboardService {
  readText(): Promise<string>;
  writeText(value: string): Promise<void>;
  clear(): Promise<void>;
}

export interface FileReference {
  readonly id: string;
  readonly displayName: string;
}

export interface FileService {
  read(reference: FileReference): Promise<Uint8Array>;
  write(reference: FileReference, contents: Uint8Array): Promise<void>;
}

export interface DialogService {
  pickFile(options?: { readonly multiple?: boolean }): Promise<readonly FileReference[]>;
  pickSaveTarget(suggestedName?: string): Promise<FileReference | null>;
}

export interface NotificationService {
  show(notification: UiNotification): Promise<void>;
}

export interface HotkeyService {
  register(shortcut: string, callback: () => void): Promise<Release>;
}

export type AudioDeviceKind = "input" | "output";

export type AudioDeviceState = "active" | "disabled" | "unplugged" | "not-present";

export type AudioDefaultRole = "console" | "multimedia" | "communications";

export interface AudioDeviceSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: AudioDeviceKind;
  readonly state: AudioDeviceState;
  readonly defaultRoles: readonly AudioDefaultRole[];
}

export type AudioDeviceChangeKind =
  | "added"
  | "removed"
  | "state-changed"
  | "default-changed"
  | "property-changed";

export interface AudioDeviceChange {
  readonly kind: AudioDeviceChangeKind;
  readonly deviceId?: string;
  readonly deviceKind?: AudioDeviceKind;
  readonly state?: AudioDeviceState;
  readonly role?: AudioDefaultRole;
}

export interface AudioService {
  listDevices(kind?: AudioDeviceKind): Promise<readonly AudioDeviceSummary[]>;
  getDefaultDevice(
    kind: AudioDeviceKind,
    role?: AudioDefaultRole,
  ): Promise<AudioDeviceSummary | null>;
  subscribeDeviceChanges(listener: (change: AudioDeviceChange) => void): Promise<Release>;
  setDefaultDevice(deviceId: string, roles?: readonly AudioDefaultRole[]): Promise<void>;
}

export interface DisplaySummary {
  readonly id: string;
  readonly name: string;
  readonly sourceName: string;
  readonly primary: boolean;
  readonly hdrSupported: boolean;
  readonly hdrEnabled: boolean;
}

export interface DisplayService {
  listDisplays(): Promise<readonly DisplaySummary[]>;
  setHdrEnabled(displayId: string, enabled: boolean): Promise<void>;
}

export interface CredentialService {
  set(key: string, value: string): Promise<void>;
  has(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

export type NetworkAuthorizationScheme = "apikey" | "Bearer";

export interface NetworkAuthorization {
  readonly credentialKey: string;
  readonly scheme: NetworkAuthorizationScheme;
}

export interface NetworkJsonRequest {
  readonly url: string;
  readonly authorization?: NetworkAuthorization;
}

export interface NetworkService {
  getJson<T>(request: NetworkJsonRequest): Promise<T>;
}

export interface SystemSummary {
  readonly platform: string;
  readonly architecture: string;
  readonly appVersion: string;
}

export interface SystemService {
  getSummary(): Promise<SystemSummary>;
}

export type TaskState = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface TaskSummary {
  readonly id: string;
  readonly title: string;
  readonly state: TaskState;
  readonly progress?: number;
  readonly error?: string;
}

export interface TaskService {
  start(taskType: string, input?: unknown): Promise<TaskSummary>;
  cancel(taskId: string): Promise<void>;
  status(taskId: string): Promise<TaskSummary>;
}

export type PermissionDecision = "prompt" | "granted" | "denied";

export interface PermissionService {
  status(permission: string): Promise<PermissionDecision>;
  request(permission: string, reason: string): Promise<PermissionDecision>;
}

export interface LoggerService {
  debug(message: string, details?: unknown): Promise<void>;
  info(message: string, details?: unknown): Promise<void>;
  warn(message: string, details?: unknown): Promise<void>;
  error(message: string, details?: unknown): Promise<void>;
}

export interface PluginContext {
  readonly pluginId: string;
  readonly ui: UiService;
  readonly storage: StorageService;
  readonly database: DatabaseService;
  readonly commands: CommandService;
  readonly scheduler: SchedulerService;
  readonly events: EventService;
  readonly clipboard: ClipboardService;
  readonly files: FileService;
  readonly dialogs: DialogService;
  readonly notifications: NotificationService;
  readonly hotkeys: HotkeyService;
  readonly audio: AudioService;
  readonly display: DisplayService;
  readonly credentials: CredentialService;
  readonly network: NetworkService;
  readonly system: SystemService;
  readonly tasks: TaskService;
  readonly permissions: PermissionService;
  readonly logger: LoggerService;
}
