# Production Observability with OpenTelemetry

## Overview

In Exercise 04, you enabled LangSmith tracing by setting `LANGCHAIN_TRACING_V2=true`. LangSmith is excellent during development: it captures every node execution, every LLM call, every tool invocation, and visualizes them as a timeline. You can inspect token counts, latency, and prompts for any run.

But LangSmith is a proprietary service run by LangChain. When you deploy your agent to SAP BTP Cloud Foundry, your production monitoring infrastructure is likely already in place: Dynatrace, a corporate OpenTelemetry collector, or an internal Jaeger instance. You cannot route production traces to a third-party SaaS without data residency and compliance review. You need a way to bridge your LangGraph agent to the standard observability stack.

This exercise adds **Traceloop** to your workflow. Traceloop is an open-source SDK that instruments LangChain and LangGraph calls and emits them as OpenTelemetry (OTEL) spans. Two lines of code in `main.ts` and a running Jaeger instance is all it takes.

### Development tracing vs. production tracing

| | LangSmith | OpenTelemetry (Traceloop) |
|---|---|---|
| **Purpose** | Debug and iterate on agent behavior | Monitor production workloads |
| **Vendor** | LangChain (proprietary) | CNCF standard — vendor-neutral |
| **Setup** | Environment variable + API key | SDK init + OTEL collector |
| **Where traces go** | smith.langchain.com | Your collector (Jaeger, Dynatrace, Grafana Tempo, ...) |
| **Data residency** | LangChain's servers | Your infrastructure |
| **Cost** | Paid above free tier | Infrastructure cost only |
| **Best for** | Prompt iteration, debugging locally | Production SLAs, compliance, cost tracking |

Neither replaces the other. Use LangSmith while building and tuning. Use OpenTelemetry in production. This exercise shows you how to wire up the production path.

---

## Start Jaeger Locally

Jaeger is an open-source distributed tracing backend. You will run it locally with Docker as the OTEL trace receiver for this exercise.

### Step 1: Start Jaeger

👉 Run the following command in a new terminal:

```bash
docker run --rm --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

- Port `16686` is the Jaeger UI
- Port `4318` is the OTEL HTTP receiver (Traceloop will send spans here)

👉 Open [http://localhost:16686](http://localhost:16686) in your browser. You should see the Jaeger UI with no services listed yet.

> 💡 **`--rm`** removes the container when it stops, so you don't accumulate stopped Jaeger containers. Leave this terminal running for the duration of the exercise.

---

## Install the Traceloop SDK

### Step 2: Install the package

👉 In your starter project directory, run:

```bash
npm install @traceloop/node-server-sdk
```

> 💡 **What is Traceloop?** Traceloop is an open-source observability SDK for AI applications. It auto-instruments LangChain, LangGraph, OpenAI, Anthropic, and other popular AI libraries. Under the hood it uses the OpenTelemetry SDK — all spans are standard OTEL spans, readable by any compatible backend.

---

## Configure OTEL Environment Variables

Traceloop reads standard OpenTelemetry environment variables to determine where to send traces.

### Step 3: Add the OTEL variables to `.env`

👉 Open `/project/JavaScript/starter-project/.env` and add:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

- `OTEL_EXPORTER_OTLP_ENDPOINT` — the address of your OTEL collector (Jaeger's HTTP receiver)
- `OTEL_EXPORTER_OTLP_PROTOCOL` — the wire format; `http/protobuf` is the standard HTTP+Protobuf encoding

> 💡 **When you deploy to Cloud Foundry**, these two variables are the only things that change. Point them at your corporate OTEL collector (or Dynatrace's ingest endpoint) and the same trace data flows there instead of Jaeger. No code changes needed.

---

## Initialize Traceloop in `main.ts`

The Traceloop SDK must initialize before any LangGraph or LLM calls are made. The initialization hooks into the LangChain/LangGraph instrumentation at the module level.

### Step 4: Add the initialization call

👉 Open [`/project/JavaScript/starter-project/src/main.ts`](/project/JavaScript/starter-project/src/main.ts)

👉 Add the Traceloop import and initialization as the very first lines — before `dotenv/config` and before importing the workflow:

```typescript
import { initialize } from "@traceloop/node-server-sdk";
initialize({ appName: "codejam-investigation", disableBatch: true });

import "dotenv/config";
import { InvestigationWorkflow } from "./investigationWorkflow.js";
import { payload } from "./payload.js";

async function main() {
  const workflow = new InvestigationWorkflow(process.env.MODEL_NAME!);
  const suspectNames = "Sophie Dubois, Marcus Chen, Viktor Petrov";

  const result = await workflow.kickoff({
    suspect_names: suspectNames,
  });

  console.log("\n📘 FINAL INVESTIGATION REPORT\n");
  console.log(result);
}

main();
```

> 💡 **Why must `initialize` come first?**
>
> Traceloop works by monkey-patching the LangChain and LangGraph modules at import time. If you import `InvestigationWorkflow` before calling `initialize()`, the instrumentation hooks miss the module load and you get no spans. The import order here is not cosmetic — it is functional.

> 💡 **`disableBatch: true`** sends each span immediately instead of buffering. This makes spans visible in Jaeger the moment a node completes, which is more convenient when watching a live run. In production you would typically leave batching enabled for efficiency.

> ⚠️ **`initialize` must be called before `dotenv/config` is loaded** if your OTEL endpoint is configured via environment variables in `.env`. However, if the OTEL variables are exported in your shell environment (not just `.env`), the order does not matter. The safest approach is to set `OTEL_EXPORTER_OTLP_ENDPOINT` in your shell before running the script, or to load `dotenv/config` using Node's `--require` flag rather than as an import.
>
> For this workshop, you can also just export the variables directly in your terminal session:
>
> ```bash
> export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
> export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
> npx tsx src/main.ts
> ```

---

## Run the Investigation and Observe Traces

### Step 5: Run the workflow

```bash
npx tsx src/main.ts
```

The investigation runs exactly as before. While it runs, switch to the Jaeger UI.

### Step 6: Find your trace in Jaeger

👉 Open [http://localhost:16686](http://localhost:16686)

👉 In the **Service** dropdown, select `codejam-investigation`

👉 Click **Find Traces**

You will see one trace entry per investigation run. Click the most recent one.

### Step 7: Explore the trace

The trace is organized as a hierarchy of spans:

```
codejam-investigation (root span — total wall time)
├── appraiser (node span)
│   └── ChatOpenAI (LLM call — RPT-1 invocation)
├── evidence_analyst (node span)
│   ├── ChatOpenAI (LLM call — suspect 1)
│   ├── ChatOpenAI (LLM call — suspect 2)
│   └── ChatOpenAI (LLM call — suspect 3)
└── lead_detective (node span)
    └── ChatOpenAI (LLM call — verdict synthesis)
```

> 💡 **The Appraiser and Evidence Analyst spans overlap** in the timeline because they run in parallel (both start from `START` in the graph). This is visible as two horizontal bars at the same vertical position in the trace view.

Each span has:

- **Duration** — how long that node or LLM call took
- **Tags** — model name, token counts, input/output token breakdown
- **Logs** — structured events emitted during the span

---

## Understanding the Span Hierarchy

### What each span represents

| Span | What it contains |
|---|---|
| Root span | The entire `kickoff()` execution from first `app.invoke()` to final state read |
| Node span | One execution of a node function, including all its internal work |
| LLM span | One `chatCompletion()` call: prompt tokens in, completion tokens out, latency |
| Tool span | (if present) One tool invocation: function name, input, output |

### What to look for

**Latency hotspots**: Which node is slowest? The Evidence Analyst typically dominates because it makes three serial grounding calls. If you see it taking 30+ seconds, the bottleneck is the vector search round-trips. Parallelizing the suspect queries with `Promise.all` would cut this significantly.

**Token counts**: The Lead Detective's LLM span shows the largest token counts because the system prompt injects the full appraisal result and evidence analysis. If you are hitting context limits or cost targets, this is where to look first.

**Parallel execution**: The Appraiser and Evidence Analyst spans start at the same timestamp. If they appear sequential in your trace, check that your `buildGraph()` has both nodes starting from `START` with parallel edges.

**Retry behavior**: A failed span followed by a retry at the same node level indicates the orchestration client retried on a 429 or transient error. If you see multiple LLM spans under one node span, this is why.

---

## Comparing LangSmith and Jaeger Side by Side

Run the investigation once with `LANGCHAIN_TRACING_V2=true` (LangSmith) and once with Traceloop. Open both UIs and compare.

| What you see in LangSmith | What you see in Jaeger |
|---|---|
| Prompt text and completion text for each LLM call | Span duration and token counts |
| The full system and user messages | OTEL tags (model, temperature, token breakdown) |
| Run replay and comparison | Gantt chart timeline |
| Chain tree with named steps | Service map across components |
| Cost estimate | Integration with your existing dashboards |

LangSmith makes it easy to understand *what* the model was asked and *what* it replied. Jaeger (and OTEL generally) makes it easy to understand *when* things happened and *how long* they took. For production SLO tracking — "95% of investigations complete in under 60 seconds" — you need the latter.

---

## Deploying to Cloud Foundry

When you complete Exercise 07 and deploy your agent to Cloud Foundry, changing the observability target is one environment variable swap.

In `manifest.yml` or your CF environment configuration:

```yaml
env:
  OTEL_EXPORTER_OTLP_ENDPOINT: https://otel-collector.internal.example.com
  OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
  OTEL_SERVICE_NAME: codejam-investigation-prod
```

Replace the endpoint with your corporate OTEL collector, Dynatrace ingest, or Grafana Agent address. The `main.ts` code is unchanged.

> 💡 **`OTEL_SERVICE_NAME`** overrides the `appName` passed to `initialize()` with an environment-specific name. This lets you distinguish traces from your dev, staging, and production instances in the same Jaeger or Dynatrace tenant without changing code.

---

## Key Takeaways

- **LangSmith** is optimal for development: inspect prompts, compare runs, debug agent reasoning
- **OpenTelemetry** is optimal for production: vendor-neutral, integrates with existing monitoring, data stays in your infrastructure
- **Traceloop** bridges LangGraph to the OpenTelemetry standard with two lines of code
- **`initialize()` must be called before any LangChain or LangGraph modules are imported** — import order matters
- **The two OTEL environment variables** (`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_PROTOCOL`) are the only configuration needed to switch trace destinations — no code changes for production deployment
- **`disableBatch: true`** is convenient for local development; leave it off in production

---

## Next Steps

1. ✅ [Understand Generative AI Hub](00-understanding-genAI-hub.md)
2. ✅ [Set up your development space](01-setup-dev-space.md)
3. ✅ [Build a basic agent](02-build-a-basic-agent.md)
4. ✅ [Add custom tools](03-add-your-first-tool.md)
5. ✅ [Build a multi-agent workflow](04-building-multi-agent-system.md)
6. ✅ [Integrate the Grounding Service](05-add-the-grounding-service.md)
7. ✅ [Solve the museum art theft mystery](06-solve-the-crime.md)
8. ✅ [Add human-in-the-loop review](06b-human-in-the-loop.md)
9. ✅ [Add production observability](07b-opentelemetry-tracing.md) (this exercise)
10. 📌 [Deploy your agent to Cloud Foundry](07-deploy-agent-to-cf-ts.md)

---

## Troubleshooting

**Issue**: No services appear in Jaeger UI after running the investigation

- **Solution**: Verify Jaeger is running on port 4318: `curl -X POST http://localhost:4318/v1/traces` should return a 405 (Method Not Allowed), not a connection refused. Check that `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` is set in your environment (not just `.env`) before launching `tsx`.

**Issue**: Spans appear in Jaeger but the service name is `unknown_service`

- **Solution**: The `appName` in `initialize()` is not being picked up. Ensure `initialize()` is called before any other imports. The `OTEL_SERVICE_NAME` environment variable will override `appName` if set — check that it is not set to a blank value.

**Issue**: `Cannot find module '@traceloop/node-server-sdk'`

- **Solution**: Run `npm install @traceloop/node-server-sdk` in the starter project directory (the one that contains `package.json`), not the repo root.

**Issue**: Traces show no LLM spans — only the root span

- **Solution**: `initialize()` is being called after the `@langchain/langgraph` or `@sap-ai-sdk` modules are imported. Move `initialize()` to the very first line of `main.ts`, before all other imports including `dotenv/config`.

**Issue**: Investigation still works but Jaeger shows errors on some spans

- **Solution**: Span errors indicate a node threw an exception that was caught internally. These are usually grounding service 429 errors or orchestration client timeouts. The investigation continues because the error handling in each node returns a fallback value. The span error tag shows the original error message.

**Issue**: Multiple traces appear for a single investigation run

- **Solution**: This is expected if the Lead Detective ran more than once (low confidence triggered the resume loop). Each `app.invoke()` call — including `Command({ resume })` — creates sub-spans under the same root trace, so they appear together. If you see genuinely separate root spans, you called `kickoff()` more than once.

---

## Resources

- [Traceloop Node SDK](https://github.com/traceloop/openllmetry/tree/main/packages/traceloop-sdk)
- [OpenTelemetry JavaScript SDK](https://opentelemetry.io/docs/languages/js/)
- [Jaeger Getting Started](https://www.jaegertracing.io/docs/latest/getting-started/)
- [OTEL OTLP Exporter Configuration](https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/)
- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)
- [SAP Cloud SDK for AI (JavaScript)](https://github.com/SAP/ai-sdk-js)
