# Upload Security Boundary

All file processing must follow this boundary before a parser, decoder, worker, or exporter receives user-controlled bytes:

1. Allowlisted MIME type from application policy
2. Allowlisted filename extension matched to the declared MIME
3. Maximum byte size
4. Magic-byte/signature validation derived from the actual file bytes
5. Parser/content validation
6. Isolated processing (worker/sandbox where applicable)
7. Output integrity validation
8. Safe, generated download name

For the shared browser image path, each raster MIME has its own signature policy:

- `image/png` → `.png` + PNG signature
- `image/jpeg` → `.jpg`/`.jpeg` + JPEG signature
- `image/webp` → `.webp` + RIFF signature

Client-provided MIME metadata is advisory and must never be treated as proof of file type. Boundary validation must happen before `imageInfo`, decoders, or downstream image processing. This is defense in depth and does not replace parser validation.
