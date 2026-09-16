export interface WebhookHandler<T = unknown> {
  readonly eventType: string;
  readonly actions?: string[];
  handle(payload: T, ctx: { correlationId: string }): Promise<void>;
}

export class WebhookDispatcher {
  private handlers = new Map<string, WebhookHandler<unknown>[]>();

  register(handler: WebhookHandler<unknown>): void {
    const list = this.handlers.get(handler.eventType) ?? [];
    list.push(handler);
    this.handlers.set(handler.eventType, list);
  }

  async dispatch(
    eventType: string,
    action: string | undefined,
    payload: unknown,
    correlationId: string,
  ): Promise<boolean> {
    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.length === 0) {
      return false;
    }

    let handled = false;
    for (const handler of handlers) {
      if (!handler.actions || (action && handler.actions.includes(action))) {
        await handler.handle(payload, { correlationId });
        handled = true;
      }
    }
    return handled;
  }
}
