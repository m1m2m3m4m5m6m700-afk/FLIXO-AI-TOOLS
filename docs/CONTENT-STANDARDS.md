# FLIXO People-First Content Standards

This contract defines what a public FLIXO tool page must provide before it is treated as publishable search content. It is an editorial quality standard, not a claim that Google publishes a fixed word-count requirement.

## Required value

Every indexable tool page must explain the actual job the tool performs, identify the important input/output constraints that are true for that tool, provide usable steps, describe meaningful capabilities, and link to genuinely related tools.

A page must still make sense to a visitor who never came from search. The tool UI is the product; SEO copy explains the product rather than replacing it with keyword filler.

## Evidence before publication

For each tool/locale, reviewers should be able to answer yes to these questions:

- The title and first paragraph describe the real function of this exact tool.
- The steps correspond to actions the interface actually supports.
- The features are concrete capabilities, not generic marketing phrases.
- The page states important processing constraints accurately, including local/browser processing where applicable.
- Related tools are selected because they form a useful workflow, not merely because they share a category.
- The translation reads naturally in the target locale and does not look like a machine-translated template.
- The page does not promise functionality that the tool does not provide.
- The content contains enough tool-specific information that a visitor would not need to immediately search elsewhere.

## Prohibited shortcuts

Do not publish pages primarily to capture search variants. Do not clone the same paragraph across tools and change only the product name. Do not inflate word counts, repeat keywords, invent benchmarks, or fabricate claims of accuracy, privacy, compatibility, or performance.

AI-assisted drafting is permitted only when the resulting copy is reviewed for accuracy, usefulness, localization quality, and tool-specific evidence.

## Engineering enforcement

CI checks structure, missing fields, exact duplicates, content similarity, locale completeness, and consistency with the canonical tool registry. Those checks are guardrails; they do not replace human editorial review.

A future production content release should carry an evidence record identifying the reviewer, review date, locale, and the tool-specific evidence used for the page.
