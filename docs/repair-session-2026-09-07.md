# Repair Session 2026-09-07

This marker records an active repository repair session rooted at main SHA `fdf549ec7ab184c2485b081e4c9e9d9a60e43b29`.

The first source-level repair addresses browser object-URL ownership in `src/tools/video-gif-meme/index.tsx`: file preview URLs are created at the file-selection boundary and revoked on replacement/unmount instead of being allocated from render.

Verification must remain fail-closed and is not considered green until fresh CI evidence covers the exact repair SHA.
