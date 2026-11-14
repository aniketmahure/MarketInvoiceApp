export const OPERATION_TIMEOUT_MS = 2 * 60 * 1000;

export class OperationTimeoutError extends Error {
  constructor() {
    super('The operation timed out.');
    this.name = 'OperationTimeoutError';
  }
}

export class OperationDeadline {
  private readonly expiresAt = Date.now() + OPERATION_TIMEOUT_MS;

  wait<T>(operation: Promise<T>): Promise<T> {
    const remaining = this.expiresAt - Date.now();
    if (remaining <= 0) return Promise.reject(new OperationTimeoutError());

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new OperationTimeoutError()), remaining);
    });

    return Promise.race([operation, timeout])
      .finally(() => clearTimeout(timeoutId));
  }
}
