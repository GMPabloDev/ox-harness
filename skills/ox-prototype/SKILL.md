---
name: ox-prototype
description: "Build isolated, throwaway prototypes to resolve a design or behavioral decision before production implementation. Use for interface sketches, competing layouts, interaction experiments, or small scripts that compare behavior or timing. The deliverable is evidence and a recommended direction, not production code."
disable-model-invocation: true
metadata:
  source: https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/prototype.md
---

# Prototype to make a decision

Use the prototype to choose a direction. Treat its code as disposable. Do not start production implementation as part of this workflow.

A prototype needs its own authorization when the current task is definition only. For a novel decision that needs comparison, read `~/.pi/agent/skills/ox-principle-exhaust-the-design-space/SKILL.md`.

## 1. Name the decision

Identify the question the prototype must answer. For a visual prototype, name the layout, interaction, information density, or visual direction being evaluated. For a behavioral experiment, name the behavior, timing, or approach being compared.

Summarize the intended user, their task, known requirements, and the open decision. Use the request and available project context. Ask only for missing information that materially changes the experiment.

If the question is empirically observable, run an experiment instead of asking the user to predict its result. Reserve questions for product intent, constraints, or preferences that observation cannot settle.

If there is no open decision, explain that implementation is the next task. Do not invent alternatives or begin implementation without that scope.

Prototypes can precede specifications, inform them, or follow backend work. Inspect existing contracts when relevant, but do not require a finished backend.

## 2. Set the direction and comparison

Preserve the user's requirements in every variant. For visual prototypes, inspect the project's `brand/` directory and existing UI. Discover brand guidance, styles, and assets by their contents; no filenames or subdirectories are required. Reuse the actual palette, type, voice, icons, or mascot where the guidance calls for them. If `brand/` is absent or incomplete, reuse existing project styles. Ask about missing or conflicting direction only if it affects the decision; otherwise use a provisional fallback and disclose it. Leave `brand/` unchanged.

If visual direction itself is open and affects the decision, gather references with available research tools and present a short selection of relevant directions. Skip this step when direction is already set.

For a novel decision that needs comparison, build two or three meaningfully different alternatives. Hold the task, sample data, and brand constant unless the experiment is testing one of them. Vary what the experiment is meant to compare. Prioritize the task and its feedback over unrelated decoration.

Use one prototype when the direction is settled and only a specific behavior needs observation. Avoid lengthy plans and production specifications.

## 3. Build outside production source

Use `prototypes/` at the repository root, or in the working directory if there is no repository. If `prototypes/ox-prototype/` already exists, use it as the prototype base for compatibility; otherwise use `prototypes/` directly and do not create the legacy layer. Keep existing paths intact.

Group experiments by topic under that base, for example `prototypes/auth/` and `prototypes/product-catalog/`. If the topic already has an experiment, give the new one its own named subdirectory without overwriting existing files. Reuse existing navigation, sidebars, and footers where they fit. Use `<prototype-base>/shared/` only for elements reused across topics, not variant-specific UI. Reuse shared files as-is or add separate files; keep experiment-specific changes local so older prototypes keep working. Leave production source, configuration, and dependencies untouched.

In a repository, run `git ls-files -- prototypes/` from the root. If any files are tracked, report them and ask before proceeding; leave the index untouched. Check the intended prototype path with `git check-ignore --no-index`. If it is not ignored, append `/prototypes/` to the local exclude file resolved by `git rev-parse --git-path info/exclude`, preserving existing entries and not duplicating the rule. Verify the intended path again with `git check-ignore --no-index`. If a check errors or the path still is not ignored, stop and report why; leave shared `.gitignore` files untouched. Outside a Git repository, skip the Git steps.

For visual decisions, prefer plain HTML, CSS, and JavaScript or the lightest stack that represents the interaction faithfully. Use a minimal component environment only when the decision depends on that component. For behavioral decisions, write the smallest script that exercises the question.

Use fake data and simulated responses. Do not connect to production services or use real credentials. Mark simulated behavior clearly. Skip speculative abstractions and test suites; implement only enough to evaluate the decision. Keep security and destructive actions outside the experiment.

Put experiment controls in one labeled lab bar, separate from the product UI. Show `Variant` (A/B/C) when comparing alternatives, `Scenario` for relevant states, and `View as` when roles change what users see or can do. Omit controls that have nothing to compare. Keep each variant and scenario reachable without editing source.

Make scenarios reproducible and interactive. For example, let the user select a save failure, fill out the form, press Save, and see the feedback and retry behavior in context. Simulate loading, empty data, or connection loss only where they affect the task. For role-dependent flows, show the specified differences in visibility and available actions; a simulated role is not an authorization check. If a development server is needed, bind it to localhost and provide its URL.

## 4. Observe the decision

Use available browser or application tools to open each visual variant, exercise the relevant interaction, and capture screenshots. Check the viewport and input methods that matter to the task.

Exercise the main task and each exposed scenario and role that affects the decision. Check the visible result or available action, not just that the selector changes. Check keyboard focus or reduced motion when relevant. A screenshot alone does not verify an interaction.

For behavioral experiments, capture the output or timing under comparable conditions. Record what ran and any measurement limits. Do not generalize a toy experiment into a production performance claim.

If the required tools are unavailable, report what you checked and what remains unverified. Do not claim to have opened, clicked, measured, or captured anything you did not observe.

Distinguish observed behavior from design judgment. Do not claim improved usability or conversion without evidence that supports that claim. A simulated login does not validate authentication or authorization.

## 5. Recommend and hand off

Report:

- The decision and variants explored.
- Evidence, including screenshots or observed output when available.
- Tradeoffs and the recommended direction.
- The user's chosen direction, if they have selected one. Otherwise, label the recommendation as awaiting a decision.
- Assumptions, simulated behavior, and remaining unknowns.
- The local prototype path and instructions to open or rerun it.

State plainly that the prototype code is throwaway and not ready for production. Preserve the chosen direction and evidence as references for later specification or implementation. Flag any backend contract changes the experiment suggests.

If the experiment is tied to a spec, offer the next step based on the user's decision:

- **Variant chosen:** record the actual local path, variant, scope, and simulated behavior. Update only the affected decisions, plan, and acceptance criteria.
- **No variant chosen:** keep the decision open. If the evidence changed the question, offer to update the pending decision with what was learned, without adding requirements based on the recommendation.

Apply spec updates only with the user's confirmation. If the spec is already approved, use `ox-spec-revise` so it returns to `Draft` before approval again. When recording a prototype link, note that the artifact is local and not recoverable from Git.

Do not silently promote prototype code into production or treat your recommendation as user approval.
