export class WorkerStartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerStartupError';
  }
}

export class UnknownWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownWorkflowError';
  }
}
