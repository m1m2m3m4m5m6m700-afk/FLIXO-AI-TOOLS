# FLIXO-AI-TOOLS — Controlled Tool Expansion Backlog

> Status: CANDIDATE BACKLOG ONLY. No item is ACTIVE by existence in this file.
> Authority: `المهام.md` controls execution state; this file contains the explicit capability backlog and the minimal execution route.

## 1. Fast execution rule

```text
ONE TOOL
→ CONTRACT
→ REGISTRY
→ IMPLEMENTATION
→ TARGETED TEST
→ OUTPUT PROOF
→ BUILD
→ REQUIRED MATRIX
→ EXACT SHA
→ MERGE
→ CLOSE
```

Default boundary: one PR = one tool. Shared infrastructure may be changed only when required by the tool and justified by the affected contract graph.

## 2. Wave plan

### WAVE-A — Core / low complexity (TOOL-001..020)
1. TOOL-001 Image Cropper
2. TOOL-002 Smart Crop
3. TOOL-003 Image Resizer
4. TOOL-004 Aspect Ratio Converter
5. TOOL-005 Rotate Image
6. TOOL-006 Flip Image
7. TOOL-007 Straighten Image
8. TOOL-008 Perspective Corrector
9. TOOL-009 Skew Corrector
10. TOOL-010 Image Editor
11. TOOL-011 Brightness Adjuster
12. TOOL-012 Contrast Adjuster
13. TOOL-013 Exposure Adjuster
14. TOOL-014 Highlights & Shadows
15. TOOL-015 Saturation Adjuster
16. TOOL-016 Vibrance Adjuster
17. TOOL-017 Temperature Adjuster
18. TOOL-018 Tint Adjuster
19. TOOL-019 Gamma Adjuster
20. TOOL-020 Sharpness Adjuster

### WAVE-B — Color / filters (TOOL-021..040)
21. TOOL-021 Grayscale
22. TOOL-022 Sepia
23. TOOL-023 Black & White
24. TOOL-024 Auto Color
25. TOOL-025 Auto Tone
26. TOOL-026 Auto Contrast
27. TOOL-027 White Balance
28. TOOL-028 Color Temperature
29. TOOL-029 Color Tint
30. TOOL-030 HSL Editor
31. TOOL-031 Color Curves
32. TOOL-032 Levels
33. TOOL-033 Channel Mixer
34. TOOL-034 Color Inverter
35. TOOL-035 Posterize
36. TOOL-036 Threshold
37. TOOL-037 Duotone
38. TOOL-038 Colorize
39. TOOL-039 Selective Color
40. TOOL-040 LUT Filter

### WAVE-C — Cleanup / removal (TOOL-041..060)
41. TOOL-041 Object Remover
42. TOOL-042 Person Remover
43. TOOL-043 Background Object Remover
44. TOOL-044 Text Remover
45. TOOL-045 Logo Remover
46. TOOL-046 Date Stamp Remover
47. TOOL-047 Blemish Remover
48. TOOL-048 Spot Remover
49. TOOL-049 Wire Remover
50. TOOL-050 Cable Remover
51. TOOL-051 Reflection Remover
52. TOOL-052 Glare Remover
53. TOOL-053 Shadow Remover
54. TOOL-054 Dust Remover
55. TOOL-055 Scratch Remover
56. TOOL-056 Watermark Cleanup
57. TOOL-057 Unwanted Background Cleaner
58. TOOL-058 Magic Eraser
59. TOOL-059 Clone Stamp Tool
60. TOOL-060 Healing Tool

### WAVE-D — Background / segmentation (TOOL-061..080)
61. TOOL-061 Background Remover
62. TOOL-062 AI Background Remover
63. TOOL-063 Bulk Background Remover
64. TOOL-064 Transparent Background Maker
65. TOOL-065 Background Replacer
66. TOOL-066 AI Background Generator
67. TOOL-067 Background Blur
68. TOOL-068 Background Defocus
69. TOOL-069 Background Color Changer
70. TOOL-070 White Background Maker
71. TOOL-071 Studio Background Maker
72. TOOL-072 Product Background Generator
73. TOOL-073 Portrait Background Replacement
74. TOOL-074 Sky Replacement
75. TOOL-075 Foreground Extractor
76. TOOL-076 Subject Cutout
77. TOOL-077 Hair/Skin Edge Refinement
78. TOOL-078 Face Cutout
79. TOOL-079 Object Cutout
80. TOOL-080 Multi-Object Segmentation

### WAVE-E — Collage / composition (TOOL-081..100)
81. TOOL-081 Photo Collage Maker
82. TOOL-082 Grid Collage
83. TOOL-083 Freeform Collage
84. TOOL-084 Photo Mosaic
85. TOOL-085 Magazine Cover Maker
86. TOOL-086 Moodboard Maker
87. TOOL-087 Vision Board Maker
88. TOOL-088 Before/After Maker
89. TOOL-089 Split Photo
90. TOOL-090 Double Exposure
91. TOOL-091 Image Combiner
92. TOOL-092 Photo Merger
93. TOOL-093 Panorama Stitcher
94. TOOL-094 HDR Merge
95. TOOL-095 Layer Compositor
96. TOOL-096 Image Overlay
97. TOOL-097 Blend Images
98. TOOL-098 Photo Frame Maker
99. TOOL-099 Polaroid Maker
100. TOOL-100 Contact Sheet Maker

### WAVE-F — Text / design (TOOL-101..120)
101. TOOL-101 Add Text to Image
102. TOOL-102 Curved Text
103. TOOL-103 Text Shadow
104. TOOL-104 Text Outline
105. TOOL-105 Text Glow
106. TOOL-106 Watermark Maker
107. TOOL-107 Logo Overlay
108. TOOL-108 Badge Maker
109. TOOL-109 Social Post Maker
110. TOOL-110 Thumbnail Maker
111. TOOL-111 Poster Maker
112. TOOL-112 Flyer Maker
113. TOOL-113 Banner Maker
114. TOOL-114 Quote Image Maker
115. TOOL-115 Greeting Card Maker
116. TOOL-116 Invitation Image Maker
117. TOOL-117 Product Label Maker
118. TOOL-118 Product Mockup Maker
119. TOOL-119 ID Photo Layout
120. TOOL-120 Passport Photo Maker

### WAVE-G — Quality / restoration (TOOL-121..140)
121. TOOL-121 Image Upscaler
122. TOOL-122 2x Upscaler
123. TOOL-123 4x Upscaler
124. TOOL-124 8x Upscaler
125. TOOL-125 AI Sharpen
126. TOOL-126 Deblur
127. TOOL-127 Denoise
128. TOOL-128 JPEG Artifact Removal
129. TOOL-129 Face Enhancer
130. TOOL-130 Old Photo Restoration
131. TOOL-131 Photo Colorization
132. TOOL-132 Low Resolution Fixer
133. TOOL-133 Detail Enhancer
134. TOOL-134 Portrait Enhancer
135. TOOL-135 AI Image Clarity
136. TOOL-136 Print Resolution Enhancer
137. TOOL-137 Anime Upscaler
138. TOOL-138 Illustration Upscaler
139. TOOL-139 Texture Enhancer
140. TOOL-140 HD Photo Converter

### WAVE-H — Portrait / face (TOOL-141..160)
141. TOOL-141 Face Retoucher
142. TOOL-142 Skin Smoother
143. TOOL-143 Blemish Fixer
144. TOOL-144 Wrinkle Remover
145. TOOL-145 Eye Enhancer
146. TOOL-146 Teeth Whitener
147. TOOL-147 Face Reshape
148. TOOL-148 Nose Reshape
149. TOOL-149 Jawline Reshape
150. TOOL-150 Body Reshape
151. TOOL-151 Makeup Editor
152. TOOL-152 Hair Color Changer
153. TOOL-153 Hair Style Editor
154. TOOL-154 Portrait Relighting
155. TOOL-155 Face Lighting Fixer
156. TOOL-156 Eye Redness Remover
157. TOOL-157 Portrait Background Changer
158. TOOL-158 Face Restoration
159. TOOL-159 Portrait Colorizer
160. TOOL-160 Professional Headshot Maker

### WAVE-I — Advanced AI editing (TOOL-161..180)
161. TOOL-161 Generative Fill
162. TOOL-162 Generative Expand
163. TOOL-163 AI Replace Object
164. TOOL-164 AI Add Object
165. TOOL-165 AI Remove Object
166. TOOL-166 AI Relight
167. TOOL-167 AI Recolor
168. TOOL-168 AI Sky Replacement
169. TOOL-169 AI Scene Editor
170. TOOL-170 AI Photo Restorer
171. TOOL-171 AI Product Photo Editor
172. TOOL-172 AI Fashion Photo Editor
173. TOOL-173 AI Composite Generator
174. TOOL-174 AI Image Extend
175. TOOL-175 AI Inpainting
176. TOOL-176 AI Outpainting
177. TOOL-177 Prompt Photo Editor
178. TOOL-178 Reference Image Editor
179. TOOL-179 AI Style Transfer
180. TOOL-180 AI Photo Enhancement

## 3. Activation policy

All `TOOL-001..180` are `CANDIDATE` until explicitly promoted by `المهام.md` after fresh evidence.

Promotion requires:

```text
CURRENT MAIN SHA RESOLVED
→ TOOL GAP / USER VALUE CONFIRMED
→ NO EXISTING TOOL DUPLICATE
→ CAPABILITY CONTRACT DEFINED
→ OWNER + INVARIANT DEFINED
→ TARGETED OUTPUT TEST DEFINED
→ DEPENDENCY IMPACT KNOWN
→ TASK BECOMES ACTIVE
```

Only the smallest next tool is promoted. Do not activate an entire wave unless a governing task explicitly authorizes batch execution.

## 4. Fast route by capability complexity

```text
A/B = deterministic image transform
C/D = deterministic or bounded local processing
E/F = composition / UI-oriented deterministic processing
G/H = heavier processing; profile first, Worker only when proven necessary
I = AI boundary; provider + policy + evidence + fail-closed execution required
```

No new abstraction, worker, cache, provider, or dependency is added before a real requirement is proven by the selected tool.

## 5. Definition of Done for each tool

```text
Contract registered
∧ implementation exists
∧ targeted behavior test PASS
∧ output proof PASS
∧ localization/route requirements PASS where applicable
∧ build PASS
∧ required browser/security matrix PASS
∧ exact SHA proven
∧ merged to main
∧ task closure recorded
```

No `CLOSED / STABLE` from branch-only evidence.
