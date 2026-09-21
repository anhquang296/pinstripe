export type LogFn = {
  (message: string, ...args: unknown[]): void;
  (bindings: Record<string, unknown>, message?: string, ...args: unknown[]): void;
};

export interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  child(bindings: Record<string, unknown>): Logger;
}
