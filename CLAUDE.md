# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A hands-on **CodeJam workshop** for building multi-agent AI systems on SAP BTP. The scenario is an art-heist investigation solved by a three-agent crew. Two parallel implementation tracks exist (Python and TypeScript) — they solve the same problem with different stacks.

This is **teaching material**, not a maintained product. Most edits target the exercise markdown or keep the `solution/` code in sync with what learners build step-by-step.

## Repo layout (the part that matters)

```
exercises/{Python,JavaScript}/0X-*.md   ← step-by-step instructions learners follow
exercises/data/documents/                ← evidence text files; loaded into Grounding pipeline
project/{Python,JavaScript}/starter-project/   ← intentionally near-empty; learners create files here
project/{Python,JavaScript}/solution/    ← reference completed code (must stay in sync with exercises)
```

`starter-project/` is essentially empty by design (only `readme.md` is tracked). Every Python/TS file referenced in exercises is created by the learner during the lesson — when verifying an exercise edit, check the `solution/` for the canonical version.

## Run commands

### Python (CrewAI + LiteLLM)

From `project/Python/solution/` (or the learner's `starter-project/` once populated):

```bash
pip install -r requirements.txt          # solution
# or, while doing the exercises:
pip install litellm==1.82.6 crewai python-dotenv

python main.py                            # local run
```

The exercise instructions also document a "from repository root" form: `python3 ./project/Python/starter-project/main.py`. **When adding or editing such commands, always include the full `./project/Python/starter-project/` prefix** — earlier exercises (02, 04) drifted by dropping this prefix after a folder restructure and had to be repaired.

### TypeScript (LangGraph + SAP Cloud SDK for AI)

From `project/JavaScript/{starter-project,solution}/`:

```bash
npm install
npm run dev          # tsx src/main.ts        (local CLI run)
npm run dev:server   # tsx src/server.ts      (A2A HTTP server, solution only)
npm run build        # tsc → dist/
npm start            # node dist/main.js
```

Node 22.x, TypeScript ESM (`"type": "module"`).

### Cloud Foundry deploy

From the respective `starter-project/` (or `solution/`): `cf push`. Manifests bind the `generative-ai-hub` service and inject credentials via `VCAP_SERVICES`. Python entrypoint is `uvicorn server:app`; TS entrypoint is `npm run start:server` (Express + `@a2a-js/sdk`).

### Required env vars

Both tracks need a `.env` in their `starter-project/` (not committed):

```
AICORE_CLIENT_ID, AICORE_CLIENT_SECRET, AICORE_AUTH_URL,
AICORE_BASE_URL, AICORE_RESOURCE_GROUP,
RPT1_DEPLOYMENT_URL
```

There is **no startup validation** of these in the Python code — credential errors surface only on the first API call.

## Architecture

Three sequential agents (same shape in both languages):

| Agent | Tool | Role |
|---|---|---|
| Loss Appraiser | `call_rpt1` | Predicts art categories & insurance values via SAP-RPT-1 |
| Evidence Analyst | `call_grounding_service` | RAG over evidence docs via SAP Grounding Service |
| Lead Detective | _(none)_ | Synthesises findings, names the culprit |

### Python specifics

- `investigator_crew.py` is a `@CrewBase` class. Agents/tasks defined via `@agent`, `@task`, `@crew` decorators.
- **Method names must exactly match the keys in `config/agents.yaml` and `config/tasks.yaml`.** Mismatches fail silently with no clear error.
- Tools are plain functions decorated `@tool("Descriptive Name")`. They should return error strings (not raise) so the LLM can recover.
- Always `Process.sequential` — task outputs flow as context to the next task in declared order.
- LLM model strings use `sap/<model-name>` (e.g. `sap/gpt-4o`) matching SAP AI Launchpad deployments.
- RPT-1 payloads use `[PREDICT]` as the inference placeholder; schema (dtype, categories, value ranges) must match exactly.

### TypeScript specifics

- Uses **LangGraph** with an explicit `AgentState` (`Annotation`-based) — state passing between nodes is typed and visible, unlike CrewAI's implicit context flow.
- Each node returns a partial state update; renaming an `AgentState` field surfaces type errors at every consumer immediately.
- `investigationWorkflow.ts` builds the graph; `agentConfigs.ts` holds system prompts; `tools.ts` wraps RPT-1 and Grounding calls.

## Known pitfalls

- **Hardcoded Grounding pipeline ID** in `call_grounding_service` — must be replaced with the learner's own pipeline ID from SAP AI Launchpad.
- **Grounding pipeline must be pre-loaded** with `exercises/data/documents/` content; an empty pipeline returns no results and agents will hallucinate.
- **OAuth token refresh**: the Python `RPT1Client` fetches its token once at init. Long-running crews can outlive the token; re-instantiate if needed.
- **YAML/decorator name mismatch** in CrewAI is the #1 silent failure mode — check both files when an agent or task "just doesn't run."
- **Exercise/solution drift**: when changing folder structure under `project/`, grep the entire `exercises/` tree for old paths. The pattern `python3 \./[a-z_]+\.py` (no prefix) almost always indicates a stale "from repository root" command.

## What CLAUDE should not do here

- Do not add tests, linters, CI, or refactoring to the workshop code unless explicitly requested — learners read this code line-by-line and infrastructure additions distract from the lesson.
- Do not "modernise" the solution beyond what the exercise text describes; the solution must stay step-for-step traceable to the exercises.
- When fixing exercise text, mirror the formatting of the surrounding lesson (the Python track uses separate `_macOS / Linux / BAS_` subheaders per code block; the JS track uses `cd <dir>` then bare `npm` commands).
