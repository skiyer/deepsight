import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

export type SseEvent = { event: string; data: unknown };

export interface StreamSseOptions<T> {
  createStream: (abortController: AbortController) => AsyncGenerator<T>;
  toEvent: (item: T) => SseEvent | null;
  onError?: (error: unknown) => SseEvent | null;
  onFinally?: () => void;
}

export function streamSseEvents<T>(c: Context, options: StreamSseOptions<T>) {
  return streamSSE(c, async (stream) => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const abort = () => {
      if (!signal.aborted) {
        abortController.abort();
      }
    };

    stream.onAbort(abort);
    c.req.raw.signal?.addEventListener("abort", abort);

    const send = async (event: SseEvent) => {
      await stream.writeSSE({
        event: event.event,
        data: JSON.stringify(event.data),
      });
    };

    try {
      const generator = options.createStream(abortController);
      for await (const item of generator) {
        if (signal.aborted) break;
        const event = options.toEvent(item);
        if (!event) continue;
        await send(event);
      }
    } catch (error) {
      if (!signal.aborted) {
        const event = options.onError?.(error);
        if (event) {
          await send(event);
        }
      }
    } finally {
      abort();
      options.onFinally?.();
    }
  });
}
