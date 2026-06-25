# Exercise 06 — Solve the Crime

## Overview

The Evidence Analyst gathered the case documents. Now you need a Lead Detective that reads that evidence, weighs it, and delivers a verdict. But a verdict is only useful if you can *act on it programmatically* — and that requires more than a prose paragraph from the LLM.

In this exercise you will:

1. Define a **Zod schema** (`VerdictSchema`) that the LLM's JSON output must satisfy.
2. Add the **Lead Detective node** that calls the LLM, parses and validates the response, and writes structured fields into state.
3. Define three **conditional routing functions** — one after each node — that inspect state and decide which node (or `END`) to visit next.
4. Wire everything together in **`buildGraph`** using `addConditionalEdges`.

> **Why Zod for a routing decision?**
> The LLM response is a string. You need a number (`confidence`) to decide whether to commit to a verdict. `VerdictSchema.parse(JSON.parse(raw))` does two things at once: it converts the raw string to a typed object *and* it throws if the shape is wrong, so you can handle a malformed response without a runtime crash downstream.

> **Why conditional edges instead of plain edges?**
> Plain edges always go to the next node. Conditional edges let you encode *policy* in the graph topology. The confidence threshold (`0.7`) is not buried in a prompt — it lives in a routing function that is easy to read, test, and change independently of the LLM call.

---

## Prerequisites

- Exercise 05 is complete: `evidence_count` is in state and `evidenceAnalystNode` writes it.
- `npm run build` passes with no errors.
- `zod` is already installed (it ships with the starter project).

---

## Steps

### Step 1 — Add two new fields to the agent state

Open `src/agentState.ts`. You need a field for the Detective's confidence score and a field for an optional witness statement (used in a later exercise — add it now so the type is consistent).

```typescript
confidence_score: Annotation<number>({
  reducer: (_, update) => update,
  default: () => 0,
}),
witness_statement: Annotation<string | undefined>({
  reducer: (_, update) => update,
  default: () => undefined,
}),
```

Both use last-write-wins reducers. `witness_statement` is `undefined` by default; the Lead Detective node will use it only when it is present.

---

### Step 2 — Define `VerdictSchema` and the confidence threshold

Open `src/agent.ts`. Near the top of the file, outside the class, add the Zod schema and the threshold constant:

```typescript
import { z } from "zod";

const CONFIDENCE_THRESHOLD = 0.7;

const VerdictSchema = z.object({
  culprit: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  totalInsuranceLoss: z.number(),
});
type Verdict = z.infer<typeof VerdictSchema>;
```

> 💡 **`z.infer` gives you the TypeScript type for free** — You define the schema once and derive the type from it. If you later add a field to `VerdictSchema`, the `Verdict` type updates automatically.

> 💡 **`.min(0).max(1)` is a contract, not a comment** — Zod will throw if the LLM returns `confidence: 1.5` or `confidence: -0.2`. You catch that in the `try/catch` inside the node rather than silently propagating a nonsensical confidence score into the routing function.

---

### Step 3 — Update the Lead Detective system prompt in `agentConfigs.ts`

Open `src/agentConfigs.ts`. Update the `leadDetective.systemPrompt` function signature to accept an optional `witnessStatement` parameter and include it in the prompt when present:

```typescript
leadDetective: {
  systemPrompt: (
    appraisalResult: string,
    evidenceAnalysis: string,
    suspectNames: string,
    witnessStatement?: string,
  ) =>
    `You are the lead detective on an art theft case.

INSURANCE APPRAISAL:
${appraisalResult}

EVIDENCE ANALYSIS:
${evidenceAnalysis}

SUSPECTS:
${suspectNames}
${witnessStatement ? `\nNEW WITNESS STATEMENT:\n${witnessStatement}` : ""}

Assess confidence honestly. If the evidence is ambiguous or incomplete, reflect that in a low confidence score.
A confidence score below ${CONFIDENCE_THRESHOLD} means you should NOT commit to a final verdict.`,
},
```

> 💡 **The threshold is in the prompt too** — The LLM needs to understand what a low confidence score *means* behaviourally, not just produce a number. Telling the model that below 0.7 means "do not commit" aligns its calibration with the routing logic.

---

### Step 4 — Implement `leadDetectiveNode`

Still in `src/agent.ts`, add the method to the agent class:

```typescript
private async leadDetectiveNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log(JSON.stringify({
    event: "node_start",
    node: "lead_detective",
    hasWitnessStatement: !!state.witness_statement,
  }));
  try {
    const response = await this.orchestrationClient.chatCompletion({
      messages: [
        {
          role: "system",
          content: AGENT_CONFIGS.leadDetective.systemPrompt(
            state.appraisal_result ?? "No appraisal result available",
            state.evidence_analysis ?? "No evidence analysis available",
            state.suspect_names,
            state.witness_statement,
          ),
        },
        {
          role: "user",
          content:
            "Analyze all the evidence and identify the culprit. You MUST respond with a JSON object matching this exact schema:\n" +
            '{ "culprit": string, "confidence": number (0-1), "reasoning": string, "totalInsuranceLoss": number }\n' +
            "Respond with JSON only — no markdown, no preamble.",
        },
      ],
    });

    const raw = response.getContent() ?? "";
    let verdict: Verdict;

    try {
      verdict = VerdictSchema.parse(JSON.parse(raw));
    } catch {
      // Malformed response — record it but signal low confidence so routing can handle it
      return {
        confidence_score: 0,
        final_conclusion: raw,
        messages: [{ role: "assistant", content: raw }],
      };
    }

    const conclusion =
      `VERDICT: ${verdict.culprit}\n` +
      `CONFIDENCE: ${(verdict.confidence * 100).toFixed(0)}%\n` +
      `TOTAL INSURANCE LOSS: $${verdict.totalInsuranceLoss.toLocaleString()}\n\n` +
      `REASONING:\n${verdict.reasoning}`;

    console.log(JSON.stringify({
      event: "node_complete",
      node: "lead_detective",
      culprit: verdict.culprit,
      confidence: verdict.confidence,
    }));

    return {
      final_conclusion: conclusion,
      confidence_score: verdict.confidence,
      messages: [{ role: "assistant", content: conclusion }],
    };
  } catch (error) {
    return { final_conclusion: `Error: ${error}`, confidence_score: 0 };
  }
}
```

Notice the two nested `try/catch` blocks:

- The **outer** block catches network or SDK errors.
- The **inner** block catches JSON parse or Zod validation errors. It returns `confidence_score: 0`, which the routing function will treat as "needs review" rather than crashing the graph.

---

### Step 5 — Define the three routing functions

Add these three functions outside the class in `src/agent.ts`:

```typescript
function routeAfterAppraisal(state: AgentStateType): "continue" | "failed" {
  if (!state.appraisal_success) {
    console.log(JSON.stringify({ event: "route", from: "appraiser", to: "END", reason: "appraisal_failed" }));
    return "failed";
  }
  return "continue";
}

function routeAfterAnalysis(state: AgentStateType): "continue" | "insufficient" {
  if (state.evidence_count === 0) {
    console.log(JSON.stringify({ event: "route", from: "evidence_analyst", to: "END", reason: "no_evidence" }));
    return "insufficient";
  }
  return "continue";
}

function routeAfterVerdict(state: AgentStateType): "committed" | "needs_review" {
  if (state.confidence_score >= CONFIDENCE_THRESHOLD) {
    console.log(JSON.stringify({ event: "route", from: "lead_detective", to: "END", confidence: state.confidence_score }));
    return "committed";
  }
  console.log(JSON.stringify({ event: "route", from: "lead_detective", to: "interrupt", confidence: state.confidence_score }));
  return "needs_review";
}
```

Each function returns a string key that maps to a node name or `END` in the edge map you will provide to `addConditionalEdges` in the next step.

> 💡 **Routing functions are pure** — They take state, return a string, and have no side effects beyond the structured log line. This makes them trivial to unit-test: call the function with a mock state object and assert on the return value. No LLM, no network, no graph needed.

> 💡 **`needs_review` loops back to `lead_detective`** — When confidence is below the threshold the Detective node will be called again in the next graph execution step. In Exercise 06b you will interrupt the graph here to inject a human-provided witness statement into `witness_statement` before the loop continues.

---

### Step 6 — Rebuild `buildGraph` with conditional edges

Replace the existing `buildGraph` method in your agent class:

```typescript
private buildGraph() {
  const workflow = new StateGraph(AgentState);

  workflow
    .addNode("appraiser", this.appraiserNode.bind(this))
    .addNode("evidence_analyst", this.evidenceAnalystNode.bind(this))
    .addNode("lead_detective", this.leadDetectiveNode.bind(this))
    // Both appraiser and evidence_analyst start in parallel from START
    .addEdge(START, "appraiser")
    .addEdge(START, "evidence_analyst")
    // After appraiser: continue to lead_detective or stop
    .addConditionalEdges("appraiser", routeAfterAppraisal, {
      continue: "lead_detective",
      failed: END,
    })
    // After evidence_analyst: continue to lead_detective or stop
    .addConditionalEdges("evidence_analyst", routeAfterAnalysis, {
      continue: "lead_detective",
      insufficient: END,
    })
    // After lead_detective: commit the verdict or loop back for another pass
    .addConditionalEdges("lead_detective", routeAfterVerdict, {
      committed: END,
      needs_review: "lead_detective",
    });

  return workflow;
}
```

> 💡 **`addEdge(START, "appraiser")` and `addEdge(START, "evidence_analyst")` together** — LangGraph runs both of these nodes in parallel before any node that depends on their output. The Lead Detective will only be scheduled once *both* appraiser and evidence_analyst have written into state. You get parallelism for free from the graph topology.

> 💡 **The `needs_review → lead_detective` loop** — Because `routeAfterVerdict` can return `"needs_review"` and that maps back to `"lead_detective"`, the Detective node can run more than once in a single invocation. LangGraph treats each traversal step as a new execution with the current state snapshot, so the second pass will see whatever was written in the first pass.

---

### Step 7 — Verify the build and run

```bash
npm run build
```

Then run the agent:

```bash
npm run start
```

In the output you should see the routing events alongside the node events:

```
{"event":"node_start","node":"appraiser"}
{"event":"node_start","node":"evidence_analyst","suspects":"..."}
...
{"event":"node_complete","node":"appraiser","success":true}
{"event":"node_complete","node":"evidence_analyst","documentCount":4}
{"event":"route","from":"appraiser","to":"lead_detective"... (implicit in continue)}
{"event":"node_start","node":"lead_detective","hasWitnessStatement":false}
{"event":"node_complete","node":"lead_detective","culprit":"...","confidence":0.87}
{"event":"route","from":"lead_detective","to":"END","confidence":0.87}
```

If confidence comes back below `0.7`, you will see the `needs_review` route and then `node_start` for `lead_detective` a second time.

---

## Troubleshooting

**`VerdictSchema` throws — "Expected number, received string"** — The LLM returned `"confidence": "0.85"` (a quoted number). Add a prompt instruction: `"All numeric fields must be JSON numbers, not strings."` in the user message.

**`JSON.parse` throws — "Unexpected token"** — The LLM wrapped the JSON in a markdown code fence. Add `"Respond with JSON only — no markdown, no preamble."` to the user message (it is already in the solution above; check your prompt matches exactly).

**Graph loops indefinitely** — The LLM consistently returns confidence below `0.7`. This is usually a prompt issue: the system prompt is not injecting the evidence correctly, so the Detective has nothing to work from. Add a `console.log(state.evidence_analysis)` at the start of `leadDetectiveNode` to confirm the field is populated.

**`addConditionalEdges` TypeScript error** — The return type of your routing function must be a string literal union that exactly matches the keys in the edge map object. Check that `"continue" | "failed"` matches `{ continue: ..., failed: ... }`.

**`state.appraisal_success` is always `undefined`** — The appraiser node must write `appraisal_success: true` to state on success. Check your `appraiserNode` return value from Exercise 03/04.

---

## Checklist

Before moving to Exercise 06b (human-in-the-loop), confirm:

- [ ] `agentState.ts` has `confidence_score` and `witness_statement` fields
- [ ] `VerdictSchema` and `CONFIDENCE_THRESHOLD` are defined outside the class
- [ ] `leadDetectiveNode` parses and validates the LLM response with Zod
- [ ] `routeAfterAppraisal`, `routeAfterAnalysis`, and `routeAfterVerdict` are defined outside the class
- [ ] `buildGraph` uses `addConditionalEdges` for all three nodes
- [ ] `npm run build` produces no errors
- [ ] Running the agent prints a `VERDICT:` block with a confidence percentage
- [ ] The route log line confirms `"committed"` was taken (confidence ≥ 0.7)

---

## Next steps

In Exercise 06b you will handle the `needs_review` path properly: interrupt the graph execution, prompt the human operator for a witness statement, inject that statement into `witness_statement`, and resume the graph so the Lead Detective has new information for the second pass.
