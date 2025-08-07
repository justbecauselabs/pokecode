// Global type declarations for React Native environment

declare global {
  // TextDecoder may not be available in all React Native environments
  const TextDecoder: {
    new(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean }): {
      decode(input?: ArrayBufferView | ArrayBuffer, options?: { stream?: boolean }): string;
      readonly encoding: string;
      readonly fatal: boolean;
      readonly ignoreBOM: boolean;
    };
  } | undefined;

  // EventSource for SSE (Server-Sent Events)
  const EventSource: {
    new(url: string, eventSourceInitDict?: { withCredentials?: boolean; headers?: Record<string, string> }): {
      readonly readyState: number;
      readonly url: string;
      readonly withCredentials: boolean;
      onopen: ((event: Event) => void) | null;
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: ((event: Event) => void) | null;
      addEventListener(type: string, listener: EventListener): void;
      removeEventListener(type: string, listener: EventListener): void;
      close(): void;
    };
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSED: 2;
  } | undefined;
}

export {};