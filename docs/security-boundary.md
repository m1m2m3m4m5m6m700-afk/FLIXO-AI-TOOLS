# Upload Security Boundary

All file processing must follow this boundary before a parser, decoder, worker, or exporter receives user-controlled bytes:

1. Allowlisted MIME type
2. Allowlisted filename extension
3. Maximum byte size
4. Magic-byte/signature validation derived from the actual file bytes
5. Parser/content validation
6. Isolated processing (worker/sandbox where applicable)
7. Output integrity validation
8. Safe, generated download name

Client-provided MIME metadata is advisory only. The file signature must be derived from the file bytes and must agree with the allowlist. This is defense in depth and does not replace parser validation.
