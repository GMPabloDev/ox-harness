# Skill mechanics

Use this reference when writing a skill's frontmatter or choosing its invocation and routing behavior. Apply the document-writing rules in [Writing for agents](SKILL.md).

## Choose how the skill is discovered

- For automatic discovery, omit `disable-model-invocation`. Write a description that identifies the task and the conditions for reading the skill. Pi advertises the name, description, and path to the model. The user can also invoke `/skill:name`.
- For an explicit entry point, set `disable-model-invocation: true`. Pi keeps `/skill:name` available but omits the skill from the automatic catalog. Write a short description for the human choosing the command.

`disable-model-invocation` controls discovery, not file access. Another procedure can explicitly tell the agent to read a hidden skill by path. This is how ox loads its TDD guides and principles. Such a reference needs a condition and a resolvable path; the hidden description cannot supply that routing.

Reading a skill does not grant tools or authorize work. The current request and applicable instructions still determine whether the agent may edit files, launch children, commit, or integrate.

## Keep shared instructions in one place

Use a plain reference file for material that only supports another procedure. Use a separate skill when the user needs its own command or the agent needs independent discovery. Both forms can be reached through explicit file links.

Split a skill by invocation only when a distinct task needs its own entry point. A separate file without an independent task adds another item for the user to remember.

## Route to an existing procedure

A router skill can select a procedure, read its file, and follow it within the user's authorization. It does not need to duplicate that procedure or turn on automatic discovery for every target.

Add a router when users need one entry point for several procedures. Keep it limited to choosing the next procedure. Preserve any approval or confirmation required by that procedure.
