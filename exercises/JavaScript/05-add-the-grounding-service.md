# Exercise 05 — Give the Evidence Analyst a Toolkit

## Overview

So far your Evidence Analyst node calls the LLM to analyse a crime scene, but it has no way to look up actual case documents or suspect records. In this exercise you will give it three focused tools:

| Tool | What it does | Why it exists |
|---|---|---|
| `searchDocumentsTool` | Sends a query to the SAP AI Core grounding service and returns matching document excerpts | Free-form semantic search over the case archive |
| `listSuspectsTool` | Returns a hard-coded JSON array of suspects with their aliases and roles | Deterministic — no LLM needed, no network call |
| `lookupTimelineTool` | Calls `searchDocumentsTool` with a date-bounded query | Focused temporal search for the night of the theft |

The agent node will then call all three tools in sequence: list the suspects, gather per-suspect evidence, and cross-reference the theft timeline.

> **Why three tools instead of one?**
> A single `callGroundingService` tool forces the LLM to pack every intent into one query. Separate, well-named tools let the agent *choose* the right instrument for the job. `listSuspectsTool` is also deliberately deterministic — there is no reason to pay LLM tokens to return a list of three names that never changes.

---

## Prerequisites

- Exercise 04 is complete and the grounding service is configured.
- `npm run start` resolves without TypeScript errors.

---

## Steps

### Step 1 — Export the three tools from `tools.ts`

Open `src/tools.ts`. You will add all three tools here so they can be reused across nodes.

**1a. Add `searchDocumentsTool`**

This wraps the existing grounding client call you set up in Exercise 04. Replace the old single-call helper (if you had one) or add this new export:

```typescript
export async function searchDocumentsTool(query: string): Promise<string> {
  console.log(JSON.stringify({ event: "tool_call", tool: "search_documents", queryLength: query.length }));
  try {
    const response = await groundingClient.chatCompletion({ placeholderValues: { user_question: query } });
    const result = response.getContent() ?? "No response from grounding service";
    console.log(JSON.stringify({ event: "tool_result", tool: "search_documents", success: true, outputLength: result.length }));
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error calling grounding service: ${errorMessage}`;
  }
}
```

> 💡 **Structured logging** — Every tool logs a JSON event both on entry and on exit. This makes it easy to grep for `tool_call` or `tool_result` events when you run the agent and want to see exactly what was called and in what order.

**1b. Add `listSuspectsTool`**

This tool is synchronous and returns a JSON string. No `await`, no network call.

```typescript
export function listSuspectsTool(): string {
  console.log(JSON.stringify({ event: "tool_call", tool: "list_suspects" }));
  return JSON.stringify([
    { name: "Sophie Dubois", aliases: ["S. Dubois", "SD-047"], role: "Night shift manager" },
    { name: "Marcus Chen", aliases: ["M. Chen", "MC-Security"], role: "Former security systems technician" },
    { name: "Viktor Petrov", aliases: ["V. Petrov", "Viktor P."], role: "Known art thief, on parole" },
  ]);
}
```

> 💡 **Deterministic tools are free** — When a tool's output is static, make it a plain function. You get the same typed, logged, testable interface without touching the network. The agent does not need to know or care that this particular tool never makes a network call.

**1c. Add `lookupTimelineTool`**

This tool accepts a date range and delegates to `searchDocumentsTool` with a constructed query:

```typescript
export async function lookupTimelineTool(dateRange: { from: string; to: string }): Promise<string> {
  console.log(JSON.stringify({ event: "tool_call", tool: "lookup_timeline", from: dateRange.from, to: dateRange.to }));
  const query = `Find all events and activities that occurred between ${dateRange.from} and ${dateRange.to} related to the art theft`;
  return searchDocumentsTool(query);
}
```

> 💡 **Composition over duplication** — `lookupTimelineTool` does not duplicate the grounding client setup. It composes `searchDocumentsTool`, adding only the concern it owns: turning a date range into a focused query string.

---

### Step 2 — Add `evidence_count` to the agent state

Open `src/agentState.ts`. Add a new field that will track how many evidence items the analyst gathered. Exercise 06 will use this count to decide whether there is enough evidence to proceed.

```typescript
evidence_count: Annotation<number>({
  reducer: (_, update) => update,
  default: () => 0,
}),
```

The reducer replaces the previous value on every update (last-write-wins), which is correct for a scalar counter.

---

### Step 3 — Rewrite `evidenceAnalystNode` to use the toolkit

Open `src/agent.ts` and update the `evidenceAnalystNode` method. Delete the old implementation and replace it with:

```typescript
private async evidenceAnalystNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log(JSON.stringify({ event: "node_start", node: "evidence_analyst", suspects: state.suspect_names }));
  try {
    const suspects = JSON.parse(listSuspectsTool()) as Array<{ name: string }>;
    const evidenceResults: string[] = [];

    for (const suspect of suspects) {
      const result = await searchDocumentsTool(
        `Find all evidence, alibis, motives and connections for ${suspect.name} related to the art theft`,
      );
      evidenceResults.push(`Evidence for ${suspect.name}:\n${result}`);
    }

    // Cross-reference the timeline around the night of the theft
    const timeline = await lookupTimelineTool({ from: "2024-03-14", to: "2024-03-16" });
    evidenceResults.push(`Timeline (March 14–16, 2024):\n${timeline}`);

    const evidenceAnalysis =
      `Evidence Analysis Complete:\n\n${evidenceResults.join("\n\n")}\n\n` +
      `Summary: Analyzed evidence for all suspects and cross-referenced the theft timeline.`;

    console.log(JSON.stringify({ event: "node_complete", node: "evidence_analyst", documentCount: evidenceResults.length }));

    return {
      evidence_analysis: evidenceAnalysis,
      evidence_count: evidenceResults.length,
      messages: [{ role: "assistant", content: evidenceAnalysis }],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      evidence_analysis: `Error: ${errorMsg}`,
      evidence_count: 0,
      messages: [{ role: "assistant", content: `Error: ${errorMsg}` }],
    };
  }
}
```

Make sure you import the three tools at the top of `agent.ts`:

```typescript
import { searchDocumentsTool, listSuspectsTool, lookupTimelineTool } from "./tools.js";
```

> 💡 **`evidence_count` matters downstream** — The node writes `evidence_count: evidenceResults.length` into state. In Exercise 06, a routing function will read this field and send the graph to `END` immediately if it is `0`, avoiding a Lead Detective verdict based on zero evidence.

---

### Step 4 — Verify the build and run

```bash
npm run build
```

You should see no TypeScript errors. Then run the agent:

```bash
npm run start
```

In the output, look for the structured log lines. You should see something like:

```
{"event":"tool_call","tool":"list_suspects"}
{"event":"tool_call","tool":"search_documents","queryLength":72}
{"event":"tool_result","tool":"search_documents","success":true,"outputLength":843}
{"event":"tool_call","tool":"search_documents","queryLength":71}
...
{"event":"tool_call","tool":"lookup_timeline","from":"2024-03-14","to":"2024-03-16"}
{"event":"node_complete","node":"evidence_analyst","documentCount":4}
```

Four document entries are expected: one per suspect (three) plus one timeline entry.

---

## Troubleshooting

**`groundingClient is not defined`** — Make sure `tools.ts` imports and initialises `groundingClient` at the module level, not inside the function body.

**`JSON.parse` throws on `listSuspectsTool` result** — Check that `listSuspectsTool` returns `JSON.stringify(...)` not a plain string.

**`lookupTimelineTool` returns an error string** — The grounding service is not reachable. Check your `AICORE_SERVICE_KEY` environment variable and confirm the vector store was created in Exercise 04.

**`evidence_count` is always 0** — Make sure the `evidenceResults` array is populated before you write `evidence_count: evidenceResults.length`. The timeline entry pushed at the end counts as one item.

---

## Checklist

Before moving to Exercise 06, confirm:

- [ ] `tools.ts` exports `searchDocumentsTool`, `listSuspectsTool`, and `lookupTimelineTool`
- [ ] `agentState.ts` has the `evidence_count` field
- [ ] `evidenceAnalystNode` calls all three tools and writes `evidence_count` to state
- [ ] `npm run build` produces no errors
- [ ] Running the agent shows four `tool_call` events in the log (three searches + one timeline lookup)

---

## Next steps

In Exercise 06 you will add the Lead Detective node that reads `evidence_analysis` from state, uses a Zod schema to validate a structured verdict, and uses the `confidence_score` field to decide — via conditional routing — whether the verdict is strong enough to commit or whether the detective needs to re-examine the evidence.
