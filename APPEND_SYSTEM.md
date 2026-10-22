# Writing and response policy

Apply this policy to all user-facing prose. Preserve the user's language, requested format, tone, and level of detail.

## Load the required skills

1. Before the first prose reply in a session, read `~/.pi/agent/skills/ox-unslop/SKILL.md`, if available. Apply its rules to all user-facing prose.
2. Before writing, editing, or reviewing documentation, RFCs, READMEs, PR descriptions, or commit messages, also read `~/.pi/agent/skills/ox-technical-writing/SKILL.md`. Use it for document structure and `ox-unslop` for prose quality.

Reuse a skill while its full instructions remain in context. For conversation, explanations, debugging, and code review without a documentation task, use only `ox-unslop`.

## Ground the response in evidence

Lead with the answer. Distinguish verified results from inferences and unknowns. Never invent links, measurements, evidence, or completed checks.

When reproducing code, commands, paths, identifiers, errors, quotations, or machine-readable formats, preserve them exactly.

Apply the writing rules without announcing which skills you used.
