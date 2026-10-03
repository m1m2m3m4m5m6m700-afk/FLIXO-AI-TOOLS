# FLIXO Hub — Autonomous Repository Architecture & Tool Integration Execution Plan

## Mission
Achieve 100% verified completion of the browser-first tool expansion program: architecture, tool engines, tool integration, tests, localization, governance, documentation, and release verification.

## Non-negotiable operating rules
- `main` is production truth.
- Integration lane is `execution → main`; no direct main writes.
- No merge, deployment, destructive repository change, critical execution, or task closure without explicit human approval for that decision.
- No stale SHA evidence. Every certification claim is bound to the exact verified commit SHA.
- Skipped, cancelled, neutral, or unavailable checks are not PASS.
- Do not weaken branch protection or bypass required checks.
- `TOOL_REGISTRY` is the single canonical registry; do not create a second registry.
- Manual standalone workflow remains supported and is the primary execution path.
- User files must remain browser-local; no raw `File`/`Blob` is sent to an LLM, provider, or backend.
- New tools progress through `CANDIDATE → EXPERIMENTAL → ACTIVE` only after their contracts and verification gates pass.
- Third-party code/dependencies require license and supply-chain review before adoption.
- MVP scope remains frozen unless separately approved; the 200+ tool program is post-MVP expansion.

## Definition of Done
A phase is complete only when its implementation, tests, evidence, documentation, and review state are recorded here and verified against the exact commit SHA. The mission is complete only when all planned tools are operational, localized, tested, privacy-verified, and human-approved.

---

## Phase 1 — Plan Persistence & Repository Audit

### P1.1 Plan persistence
- [x] Persist this roadmap in `EXECUTION_PLAN.md`.
- [ ] Human approval for the first actionable repository change.

### P1.2 Baseline audit
- [x] Verify current `main` SHA and `execution` SHA.
- [x] Verify open PRs and required checks; PR #1000 remains open and its previous CI attempt failed before the repair.
- [x] Audit `TOOL_REGISTRY`, `TOOL_CATALOG`, executors, verifiers, recovery handlers, and runtime boundaries.
- [x] Inventory currently registered tools: 27 definitions; 10 canonical executable MVP tools.
- [x] Map existing UI routes/components and canonical lazy-loaded tool definitions.
- [x] Inventory dependencies; identified missing PDF/advanced media/OCR/local-AI engine layer.
- [x] Audit i18n architecture; 20 canonical locales have lazy dictionary loaders. Full hardcoded-string audit remains.
- [x] Audit browser/network boundaries at the registry contract level; strict no-upload verification remains.
- [x] Audit existing CI/test architecture; repaired two lint defects found on the current execution head.
- [x] Produce baseline gap matrix in `docs/TOOL-EXPANSION-AUDIT.md`.

### P1.3 Audit output
- [x] Create the initial tool adoption baseline; detailed 200-row matrix remains a Phase 3 deliverable with license/engine evidence.
  `id | category | input | output | engine | offline | WASM | worker | mobile | bundle risk | license | priority | status`.
- [x] Establish classification policy; candidate-by-candidate classification remains part of Phase 3 admission.
- [x] Record current blockers/dependencies in `docs/TOOL-EXPANSION-AUDIT.md`.

---

## Phase 2 — Browser Capability Engine & Infrastructure

### P2.1 Core engines
- [x] Image engine baseline: Canvas, ImageData, and reusable browser-local image transforms; OffscreenCanvas worker migration remains for heavy operations.
- [ ] PDF engine: PDF.js + pdf-lib.
- [ ] Archive engine: JSZip and file streaming.
- [ ] Crypto engine: Web Crypto.
- [ ] Document engine: JSON/CSV/XML/YAML/Markdown/text processing.
- [ ] Video engine: WebCodecs/FFmpeg WASM where required.
- [ ] Audio engine: Web Audio API/FFmpeg WASM where required.
- [ ] OCR engine: browser/on-device OCR.
- [ ] Local AI engine: ONNX Runtime/WebGPU where appropriate.
- [ ] File persistence: IndexedDB and File System Access API where supported.

### P2.2 Runtime controls
- [ ] Web Worker execution for heavy operations (OCR/video workers exist; expansion-wide worker coverage remains).
- [ ] Lazy loading/code splitting per engine.
- [ ] File-size, memory, time, mutation, and output-size budgets.
- [ ] Abort/cancellation support.
- [ ] Deterministic error taxonomy.
- [ ] Fail-closed behavior for unsafe/unsupported execution.
- [ ] Recovery contracts for recoverable failures.

### P2.3 Privacy boundary
- [ ] Automated no-upload tests.
- [ ] Network interception tests for representative tools.
- [ ] Verify no user file bytes leave the browser.
- [ ] Self-host WASM/model assets where required for a strict offline claim.
- [ ] Document residual network requirements for assets that cannot be bundled.

---

## Phase 3 — Tool Integration Program (200 tools)

All tools must use the canonical registry and shared engines. No duplicate registries and no unnecessary one-off execution architectures.

### Wave 1 — Image Core (1–30)
1. Resize Image
2. Crop Image
3. Rotate Image
4. Flip Horizontal
5. Flip Vertical
6. Compress Image
7. Convert PNG/JPEG/WebP
8. Convert AVIF
9. Image Quality Adjust
10. Brightness
11. Contrast
12. Saturation
13. Hue
14. Grayscale
15. Sepia
16. Invert
17. Blur
18. Sharpen
19. Pixelate
20. Noise Reduction
21. Image Border
22. Rounded Corners
23. Image Background
24. Transparent Background
25. Image Padding
26. Image Fit
27. Image Fill
28. Image Watermark
29. Image Overlay
30. Image Collage

### Wave 2 — Image Advanced (31–60)
31. Remove Background
32. Object Eraser
33. Face Blur
34. Skin Blur
35. Red Eye Removal
36. Image Denoise
37. Image Deblur
38. Image Sharpen AI
39. Super Resolution
40. Image Upscaler
41. Colorize
42. Auto Enhance
43. Auto Contrast
44. Auto White Balance
45. Exposure
46. Highlights
47. Shadows
48. Temperature
49. Tint
50. Vibrance
51. Curves
52. Levels
53. Posterize
54. Threshold
55. Duotone
56. Edge Detection
57. Emboss
58. Sketch
59. Cartoon Effect
60. Vintage Effect

### Wave 3 — Image Professional (61–80)
61. Image Metadata Viewer
62. EXIF Viewer
63. EXIF Cleaner
64. Metadata Remover
65. Image DPI Changer
66. Image Bit Depth Converter
67. Color Profile Inspector
68. Image Histogram
69. Color Picker
70. Palette Extractor
71. Dominant Colors
72. Image Difference
73. Image Compare
74. Image Contact Sheet
75. Sprite Sheet Generator
76. Image Tiling
77. Image Splitter
78. Image Merger
79. Batch Image Processor
80. Batch Image Converter

### Wave 4 — PDF (81–110)
81. PDF Viewer
82. PDF Merge
83. PDF Split
84. PDF Extract Pages
85. PDF Reorder
86. PDF Rotate
87. PDF Delete Pages
88. PDF Duplicate Pages
89. PDF Compress
90. PDF Convert to Images
91. Images to PDF
92. PDF to PNG
93. PDF to JPG
94. PDF Page Resize
95. PDF Crop
96. PDF Watermark
97. PDF Metadata Viewer
98. PDF Metadata Cleaner
99. PDF Password Protection
100. PDF Unlock (authorized/password-based use only)
101. PDF Text Extract
102. PDF Search
103. PDF Page Numbering
104. PDF Header/Footer
105. PDF Annotation
106. PDF Highlight
107. PDF Drawing
108. PDF Shapes
109. PDF Signature
110. PDF Redaction

### Wave 5 — Documents & Files (111–145)
111. TXT Viewer
112. TXT Converter
113. Markdown Viewer
114. Markdown to HTML
115. HTML to PDF
116. HTML Formatter
117. HTML Minifier
118. CSS Formatter
119. CSS Minifier
120. JavaScript Formatter
121. JSON Formatter
122. JSON Validator
123. JSON Minifier
124. JSON to CSV
125. CSV to JSON
126. CSV Viewer
127. CSV Formatter
128. XML Formatter
129. YAML Formatter
130. Base64 Encoder/Decoder
131. ZIP Creator
132. ZIP Extractor
133. ZIP Viewer
134. TAR Creator
135. File Combiner
136. File Splitter
137. File Hash
138. SHA-256
139. SHA-512
140. MD5
141. File Size Analyzer
142. MIME Type Detector
143. File Extension Detector
144. Batch Rename Generator
145. File Manifest Generator

### Wave 6 — Video Core (146–165)
146. Video Player
147. Video Trim
148. Video Cut
149. Video Merge
150. Video Crop
151. Video Resize
152. Video Rotate
153. Video Flip
154. Video Compress
155. Video Convert
156. Video to GIF
157. GIF to Video
158. Video to Images
159. Images to Video
160. Extract Audio
161. Remove Audio
162. Replace Audio
163. Video Speed
164. Video Reverse
165. Video Thumbnail

### Wave 7 — Video Advanced (166–180)
166. Video Stabilizer
167. Frame Extractor
168. Contact Sheet from Video
169. Subtitle Extractor
170. Subtitle Burner
171. Subtitle Converter
172. Video Watermark
173. Video Overlay
174. Video Filters
175. Video Brightness
176. Video Contrast
177. Video Saturation
178. Video Color Adjustment
179. Video Noise Reduction
180. Batch Video Converter

### Wave 8 — Audio (181–200)
181. Audio Player
182. Audio Trim
183. Audio Cut
184. Audio Merge
185. Audio Convert
186. Audio Compress
187. WAV Converter
188. MP3 Converter
189. OGG Converter
190. FLAC Converter
191. M4A Converter
192. Audio Extractor
193. Audio Speed
194. Audio Pitch
195. Audio Volume
196. Audio Fade In
197. Audio Fade Out
198. Audio Waveform
199. Audio Noise Reduction
200. Audio Metadata Cleaner

### Tool admission gate
For every tool:
- [ ] Canonical registry entry.
- [ ] Input schema.
- [ ] Output contract.
- [ ] Executor binding.
- [ ] Verifier.
- [ ] Recovery behavior.
- [ ] Local/browser execution proof.
- [ ] Privacy/no-upload proof.
- [ ] Browser compatibility check.
- [ ] Mobile check where applicable.
- [ ] Arabic and English UI.
- [ ] Unit/integration/E2E coverage.
- [ ] License/dependency review.
- [ ] Performance/budget check.
- [ ] Only then promote to ACTIVE.

---

## Phase 4 — Complete Localization (i18n)

- [ ] Identify all supported languages from the repository's actual i18n configuration.
- [ ] Extract hardcoded user-visible strings.
- [ ] Extract validation and error messages.
- [ ] Extract tool metadata, labels, descriptions, empty states, progress states, and accessibility labels.
- [ ] Create synchronized translation dictionaries for every supported language.
- [ ] Preserve technical identifiers in English where required.
- [ ] Verify Arabic RTL.
- [ ] Verify LTR languages.
- [ ] Test pluralization/interpolation.
- [ ] Test missing-key detection.
- [ ] Test untranslated-string detection.
- [ ] Test locale switching.
- [ ] Test tool routes and metadata in every locale.
- [ ] Do not claim “all target languages” until the repository's actual supported-language set is established and all are verified.

---

## Phase 5 — Sub-Agent Delegation & Governance

Sub-agents may be used for analysis/review tasks, but they do not receive authority to bypass repository governance.

### QA Agent
- [ ] Define scope.
- [ ] Run/review unit and integration coverage.
- [ ] Track failures and regressions.
- [ ] Produce evidence bound to exact SHA.

### i18n Agent
- [ ] Audit dictionaries.
- [ ] Detect missing/untranslated strings.
- [ ] Verify RTL/LTR behavior.
- [ ] Produce localization evidence.

### Repo Maintainer Agent
- [ ] Audit repository structure.
- [ ] Check documentation consistency.
- [ ] Validate branch/PR workflow.
- [ ] Detect stale references and duplicate registries.
- [ ] Report only; no autonomous merge/deploy/certification authority.

### Governance
- [ ] Human remains final authority.
- [ ] Agents cannot merge.
- [ ] Agents cannot deploy.
- [ ] Agents cannot alter branch protection.
- [ ] Agents cannot redefine MVP scope.
- [ ] Agents cannot certify their own work.
- [ ] All agent outputs require verification by an independent gate.

---

## Phase 6 — Verification & Full Audit

### Per-wave verification
- [ ] TypeScript/build.
- [ ] Lint/static checks.
- [ ] Unit tests.
- [ ] Integration tests.
- [ ] Browser E2E.
- [ ] Accessibility checks.
- [ ] Localization checks.
- [ ] No-upload/network boundary tests.
- [ ] Large/malformed input tests.
- [ ] Performance and memory budgets.
- [ ] Security scans.
- [ ] Exact-SHA evidence.

### Repository-wide verification
- [ ] Registry contract audit.
- [ ] No duplicate registry.
- [ ] No orphaned tool routes.
- [ ] No missing executors.
- [ ] No missing verifiers.
- [ ] No missing recovery handlers.
- [ ] No stale branding/asset references.
- [ ] No unauthorized network upload path.
- [ ] Dependency/license audit.
- [ ] Full build.
- [ ] Full test suite.
- [ ] Production/browser verification after approved deployment.
- [ ] Human sign-off for every required state-changing decision.

---

## Phase 7 — Release & Certification

- [ ] Prepare release candidate on `execution`.
- [ ] Obtain explicit human approval for promotion.
- [ ] Open PR `execution → main`.
- [ ] Wait for all required checks.
- [ ] Reject skipped/cancelled/neutral checks as evidence of completion.
- [ ] Obtain explicit human approval to merge.
- [ ] Merge only after required checks pass.
- [ ] Verify `main` exact SHA after merge.
- [ ] Verify production deployment corresponds to that SHA.
- [ ] Run production browser verification.
- [ ] Record release evidence and URLs.
- [ ] Issue final completion certificate only after every criterion is verified.

---

## Evidence Log

| Phase | Status | Exact SHA | Evidence | Human approval |
|---|---|---|---|---|
| Phase 1 | AUDITED / CI PENDING | `75bfb2a77513c98a18d619a74f12daedbe547e0c` | `EXECUTION_PLAN.md`, `docs/TOOL-EXPANSION-AUDIT.md`; Secret Scan PASS, CodeQL PASS; FLIXO CI #15554 still pending | autonomous execution authorized |
| Phase 2 | IN PROGRESS | `78ab851692122f8bf187f8b72e27b4cb27fdf27c` | Shared image engine + first 11 transform adapters/UI paths added; CI verification pending | autonomous execution authorized |
| Phase 3 | NOT STARTED | pending | pending | pending |
| Phase 4 | NOT STARTED | pending | pending | pending |
| Phase 5 | NOT STARTED | pending | pending | pending |
| Phase 6 | NOT STARTED | pending | pending | pending |
| Phase 7 | NOT STARTED | pending | pending | pending |

## Completion Rule
Do not mark this mission complete, issue a final certificate, or report 100% completion until every unchecked item is verified, evidence is recorded against the exact SHA, required repository/production checks are PASS, and the corresponding human approvals are explicitly recorded.
