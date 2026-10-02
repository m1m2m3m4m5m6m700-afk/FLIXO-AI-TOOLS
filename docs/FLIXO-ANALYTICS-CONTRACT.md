# FLIXO Privacy-Safe Analytics Contract

North-star activation: First Successful Edit.

## Allowed events

`landing_view`, `cta_start`, `editor_open`, `file_selected`, `agent_request`, `plan_generated`, `execution_started`, `execution_succeeded`, `execution_failed`, `verification_passed`, `export_completed`, `second_edit`, `pricing_view`, `upgrade_started`, `upgrade_completed`.

## Event payload policy

Allowed: event name, coarse non-sensitive outcome/status, tool identifier, locale, anonymous session identifier where legally and operationally justified, bounded latency/duration buckets, application version/build SHA.

Forbidden: raw File objects, Blob objects, image/video/audio bytes, OCR contents, prompts containing user private content, secrets, provider credentials, full URLs containing sensitive query data, private artifact payloads.

## Instrumentation requirements

1. Events must be emitted at the product boundary, not by serializing editor state.
2. File selection may record that a file was selected, never the file bytes or contents.
3. Agent requests may record a bounded intent category, never the raw private prompt unless the user has explicitly opted into a separate diagnostic system.
4. Execution telemetry must use capability IDs and outcome codes.
5. Analytics failure must never block local editing.
6. No analytics implementation may weaken browser-local privacy guarantees.

## Launch gate

Analytics is PASS only when:
- the event contract is implemented or the configured analytics provider is verified;
- no forbidden payload reaches the transport boundary;
- First Successful Edit can be measured;
- telemetry failure is fail-open for product availability but fail-closed for privacy.
