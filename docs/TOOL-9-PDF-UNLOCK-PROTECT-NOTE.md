# Tool #9 — PDF Unlock & Protect

## Capability gate
This tool is intentionally not implemented yet.

The requested behavior includes PDF encryption/decryption and removal of password restrictions. The current browser PDF stack in this repository (`pdf-lib` + `pdfjs-dist`) does not provide a complete, production-grade client-side encryption/decryption contract by itself.

Do not ship a UI that claims to encrypt, decrypt, or unlock PDFs until the exact browser-compatible engine and output contracts are proven.

## Gate
- identify a browser-safe implementation with real password encryption/decryption support
- add fixtures for encrypted and unencrypted PDFs
- verify password correctness and failure handling
- verify permissions behavior
- verify output PDF integrity with independent parsing
- verify no server upload occurs
- add E2E/output contracts
- merge only when exact-head CI is green
