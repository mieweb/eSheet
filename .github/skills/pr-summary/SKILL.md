---
name: pr-summary
description: 'Write or reformat pull request titles and descriptions using Why these changes were made and The Changes sections. USE WHEN asked to summarize a PR, give a PR summary, draft a PR description, name a PR, or format development notes for a pull request. Ensure the generated title passes .github/workflows/pr-title-check.yml.'
---

# PR Summary

Create a concise, reviewer-friendly pull request title and description from supplied notes, an existing description, or relevant repository changes.

## Required output

Return only the finished pull request title and description as GitHub-flavored Markdown, without introductory commentary or a surrounding code fence. Use exactly this structure unless the user requests additional sections:

```markdown
# type(scope): concise description

## Why these changes were made

One or two short paragraphs explaining the problem, purpose, and resulting behavior.

## The Changes

- **Area or component:** Describe the change and its practical effect.
- **Tests:** Describe coverage added and tests actually run, distinguishing between them.
```

Creating or publishing a pull request requires a separate user instruction.

## PR title contract

The title must pass `.github/workflows/pr-title-check.yml` and match this pattern exactly:

```text
^(feat|enhance|fix|perf|refactor|docs|test|chore|ci|build|repo)\((repo|docs|demo|package|core|styles|fields|builder|renderer|renderer-standalone|renderer-blaze|adapters|field-kerebron|field-health|fields-documents)\): .+$
```

Allowed types:

- `feat`: new user-facing behavior or capability
- `enhance`: improvement to existing behavior
- `fix`: defect correction
- `perf`: performance improvement
- `refactor`: internal restructuring without intended behavior change
- `docs`: documentation-only change
- `test`: test-only change
- `chore`: maintenance work
- `ci`: CI workflow change
- `build`: build-system change
- `repo`: repository-level change that does not fit another type

Allowed scopes:

- `repo`
- `docs`
- `demo`
- `package`
- `core`
- `styles`
- `fields`
- `builder`
- `renderer`
- `renderer-standalone`
- `renderer-blaze`
- `adapters`
- `field-kerebron`
- `field-health`
- `fields-documents`

Choose the type from the primary outcome, not the number of files changed. Choose the narrowest scope owning that outcome. For changes spanning several packages, use `package` when the outcome is package-wide or `repo` when it is repository-wide. Do not invent scopes.

Before returning the summary, verify the title against the exact pattern above. Use a concise imperative or outcome-focused description after the colon. Do not add a trailing period.

## Why these changes were made

- Write one or two short paragraphs.
- Lead with the main outcome and why it matters.
- Explain important behavior, defaults, or limitations when relevant.
- Mention compatibility only when supported by the available information.
- Keep detailed implementation information in `The Changes`.

## The Changes

- Use a flat bulleted list.
- Start each bullet with a bold package, component, or functional area.
- Group related changes instead of listing every modified file.
- Use action verbs such as Adds, Updates, Fixes, Removes, or Prevents.
- Explain what changed and its practical effect.
- Put API names, props, functions, and file paths in backticks.
- Include test coverage changes when provided or verified.

## Accuracy and scope

- Preserve technical meaning and important exceptions.
- When only reformatting a supplied description, use the supplied notes.
- When summarizing repository changes, inspect the relevant diff and enough surrounding code to understand the behavior.
- Do not invent motivations, issue numbers, compatibility guarantees, or test results.
- Distinguish added test coverage from tests actually executed.
- Include significant breaking behavior or migration requirements within the two required sections when applicable.
- Omit separate Breaking Changes, How to Test, and Related Issues sections unless requested.
