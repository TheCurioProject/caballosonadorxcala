import type { ObservabilityProvider } from "@/cala/application/ports/providers";
/** Allowlist-only events: arbitrary payloads and exceptions cannot enter logs. */
export class DevelopmentObservabilityProvider implements ObservabilityProvider {
  record(event: Parameters<ObservabilityProvider["record"]>[0]) {
    console.info(
      JSON.stringify({
        operation: event.operation,
        requestId: event.requestId,
        code: event.code,
      }),
    );
  }
}
