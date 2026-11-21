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

Preserve the user's requirements in every variant. Inspect existing styles and relevant interactions before choosing a visual direction.

If visual identity is not under review, reuse existing styles. If none exist, choose a provisional palette and state that assumption.

If visual direction is open and affects the decision, gather references with available research tools. Present a short selection of themes, palettes, and layouts for the user to choose. Skip this step when direction is already set.

For a novel decision that needs comparison, build two or three meaningful alternatives. Keep the task, sample data, and unrelated styling consistent. Do not substitute color changes for different flows or layouts.

Use one prototype when the direction is settled and only a specific behavior needs observation. Avoid lengthy plans and production specifications.

## 3. Build outside production source

Create a new, dedicated directory under `prototypes/ox-prototype/<unique-name>/` at the repository root, or under the working directory if there is no repository. Do not overwrite another experiment or modify production source, configuration, or dependencies, except for the ignore rule below.

Keep `prototypes/` out of Git. In a repository, use `git ls-files -- prototypes/` to check for tracked files and `git check-ignore --no-index` to check the intended prototype path. If tracked files exist, report them and ask the user before proceeding; do not remove them from the index. If the path is not ignored, add `/prototypes/` to the root `.gitignore`, preserving existing content, and verify the intended path with `git check-ignore --no-index`. If there is no repository, create or update `.gitignore` in the working directory without initializing Git, and verify the rule is present. If the applicable check fails, stop and report the problem.

For visual decisions, prefer plain HTML, CSS, and JavaScript or the lightest stack that represents the interaction faithfully. Use a minimal component environment only when the decision depends on that component. For behavioral decisions, write the smallest script that exercises the question.

Use fake data and simulated responses. Do not connect to production services or use real credentials. Mark simulated behavior clearly.

Skip reusable architecture, speculative abstractions, and test suites. Implement enough detail to evaluate the decision. Keep security and destructive actions outside the experiment.

Put visual alternatives behind one labeled switcher. Keep each variant reachable without editing source. If a development server is needed, bind it to localhost and provide its URL.

## 4. Observe the decision

Use available browser or application tools to open each visual variant, exercise the relevant interaction, and capture screenshots. Check the viewport and input methods that matter to the task.

Review UX only as needed for the question. Check the main task, feedback, error states, keyboard focus, or reduced motion when those affect the decision. A screenshot alone does not verify an interaction.

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

When the user chooses a variant for a spec, offer to record the actual local path, variant, scope, and simulated behavior in that spec. Apply changes only with the user's confirmation. If the spec is already approved, use `ox-spec-revise` so it returns to `Draft` before approval again. Remind the user that `prototypes/` is ignored by Git and the local reference is not recoverable from the repository.

Do not silently promote prototype code into production or treat your recommendation as user approval.
