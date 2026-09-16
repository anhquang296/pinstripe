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

export class WebhookDeliveryFailedError extends Error {
  constructor(deliveryId: string, reason: string) {
    super(`Webhook delivery ${deliveryId} failed: ${reason}`);
    this.name = 'WebhookDeliveryFailedError';
  }
}
