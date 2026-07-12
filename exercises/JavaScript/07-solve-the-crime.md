# Solve the Crime

The only thing missing now is your **Lead Detective**. This node will synthesize findings from the Appraiser and Evidence Analyst to identify the culprit and calculate the total value of the stolen items.

## Build the Lead Detective Node

### Step 1: Add the Lead Detective Node

The Lead Detective receives results from both previous agents via shared state. Its system prompt (defined in `agentConfigs.ts`) injects the appraisal results and evidence analysis directly, giving the LLM all the information it needs to reason about the case.

👉 Open [`/project/JavaScript/starter-project/src/investigationWorkflow.ts`](/project/JavaScript/starter-project/src/investigationWorkflow.ts)

👉 Add the missing imports at the top of the file:

```typescript
import { OrchestrationClient } from "@sap-ai-sdk/orchestration";
import { AGENT_CONFIGS } from "./agentConfigs.js";
```

👉 Add `orchestrationClient` as a class field and initialize it in the constructor:

```typescript
export class InvestigationWorkflow {
  private graph;
  private orchestrationClient: OrchestrationClient;

  // ...

  constructor(model: string = process.env.MODEL_NAME!) {
    this.orchestrationClient = new OrchestrationClient({
      promptTemplating: {
        model: {
          name: model,
          params: {
            temperature: 0.7,
            max_tokens: 2000,
          },
        },
      },
    });
    this.graph = this.buildGraph();
  }
}
```

👉 Add the Lead Detective node method inside your `InvestigationWorkflow` class, after `evidenceAnalystNode`:

```typescript
    private async leadDetectiveNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
        console.log('\n🔍 Lead Detective analyzing all findings...')

        const userMessage = 'Analyze all the evidence and identify the culprit. Provide a detailed conclusion.'

        try {
            const response = await this.orchestrationClient.chatCompletion({
                messages: [
                    {
                        role: 'system',
                        content: AGENT_CONFIGS.leadDetective.systemPrompt(
                            state.appraisal_result || 'No appraisal result available',
                            state.evidence_analysis || 'No evidence analysis available',
                            state.suspect_names,
                        ),
                    },
                    { role: 'user', content: userMessage },
                ],
            })
            const conclusion = response.getContent() || 'No conclusion could be drawn.'

            console.log('✅ Investigation complete')

            return {
                final_conclusion: conclusion,
                messages: [...state.messages, { role: 'assistant', content: conclusion }],
            }
        } catch (error) {
            const errorMsg = `Error during final analysis: ${error}`
            console.error('❌', errorMsg)
            return {
                final_conclusion: errorMsg,
                messages: [...state.messages, { role: 'assistant', content: errorMsg }],
            }
        }
    }
```

> 💡 **Understanding how the Lead Detective gets context:**
>
> The `AGENT_CONFIGS.leadDetective.systemPrompt()` function takes three arguments from `state`:
> - `state.appraisal_result` — the RPT-1 predictions from the Appraiser node
> - `state.evidence_analysis` — the grounded evidence findings from the Evidence Analyst node
> - `state.suspect_names` — the original list of suspects
>
> These are injected into the system prompt using template literals. The LLM receives the entire context in one message, making it a **synthesis task**: it reasons over structured inputs rather than searching for new information.
>
> This is the TypeScript equivalent of CrewAI's `context=[self.appraise_loss_task(), self.analyze_evidence_task()]`, but instead of framework magic, you're explicitly passing data through state.

### Step 2: Update buildGraph to Include All Three Nodes

👉 Update the `buildGraph` method to include the Lead Detective:

```typescript
    private buildGraph() {
        const workflow = new StateGraph(AgentState)

        workflow
            .addNode('appraiser', this.appraiserNode.bind(this))
            .addNode('evidence_analyst', this.evidenceAnalystNode.bind(this))
            .addNode('lead_detective', this.leadDetectiveNode.bind(this))
            .addEdge(START, 'appraiser')
            .addEdge('appraiser', 'evidence_analyst')
            .addEdge('evidence_analyst', 'lead_detective')
            .addEdge('lead_detective', END)

        return workflow
    }
```

> 💡 **The execution order is defined entirely by the edges:**
>
> 1. `START → appraiser` — workflow begins with the Appraiser
> 2. `appraiser → evidence_analyst` — after RPT-1 completes, Evidence Analyst runs
> 3. `evidence_analyst → lead_detective` — after grounding completes, Lead Detective synthesizes
> 4. `lead_detective → END` — Lead Detective's conclusion becomes the final result

### Step 3: Verify main.ts

👉 Check your [`/project/JavaScript/starter-project/src/main.ts`](/project/JavaScript/starter-project/src/main.ts): it needs no changes from Exercise 04.

```typescript
import "dotenv/config";
import { InvestigationWorkflow } from "./investigationWorkflow.js";
import { payload } from "./payload.js";

async function main() {
  const workflow = new InvestigationWorkflow(process.env.MODEL_NAME!);
  const suspectNames = "Sophie Dubois, Marcus Chen, Viktor Petrov";

  const result = await workflow.kickoff({
    payload,
    suspect_names: suspectNames,
  });

  console.log("\n📘 FINAL INVESTIGATION REPORT\n");
  console.log(result);
}

main();
```

---

## Solve the Crime

👉 Run your complete investigation workflow:

```bash
npx tsx src/main.ts
```

> ⏱️ **This may take 2-5 minutes** as your agents:
>
> 1. Predict insurance values for stolen items using SAP-RPT-1
> 2. Search evidence documents for each suspect using the Grounding Service
> 3. Analyze all findings and identify the culprit

👉 Review the final output. Who does your Lead Detective identify as the thief?

👉 Call for the instructor and share your suspect.

### If Your Answer is Incorrect

If the Lead Detective identifies the wrong suspect, refine the system prompts in `agentConfigs.ts`.

**Which prompts to adjust:**

1. **Lead Detective's system prompt** (`agentConfigs.ts → leadDetective.systemPrompt`)
   - Make it more specific about what evidence to prioritize
   - Example: Add "Focus on alibis, financial motives, and access to the museum on the night of the theft"

2. **Evidence Analyst's grounding query** (`investigationWorkflow.ts → evidenceAnalystNode`)
   - Make the search query more specific
   - Example: `"Find evidence about ${suspect}'s alibi, financial records, and museum access on the night of the theft"`

**Tips for improving prompts:**

- ✅ Be specific about what to analyze (alibi, motive, opportunity)
- ✅ Ask the detective to cite specific documents
- ✅ Request cross-referencing of evidence
- ✅ Instruct the detective to explain reasoning step-by-step
- ❌ Avoid vague instructions like "solve the crime" without guidance
- ❌ Don't assume the LLM knows which evidence is most important

---

## Understanding Multi-Agent Orchestration

### What Just Happened?

You completed a full multi-agent investigation system where:

1. **Appraiser Node** — Calls SAP-RPT-1 to predict missing insurance values from structured data
2. **Evidence Analyst Node** — Searches 8 evidence documents via the Grounding Service for each suspect
3. **Lead Detective Node** — Synthesizes all findings using an LLM to identify the culprit and calculate total losses
4. **State** — Flows through all nodes, accumulating results that later nodes build upon

### The Complete Investigation Flow

```mermaid
flowchart TD
    A[START] --> B["Appraiser Node\nRPT-1 predictions → appraisal_result"]
    B --> C["Evidence Analyst Node\nGrounding searches × 3 suspects → evidence_analysis"]
    C --> D["Lead Detective Node\nLLM synthesis → final_conclusion"]
    D --> E[END]
```

### The Role of agentConfigs.ts

The `AGENT_CONFIGS` object in `agentConfigs.ts` serves the same purpose as CrewAI's YAML files: it separates agent "personality" from orchestration logic. But as TypeScript objects:

- System prompts are **functions** that accept runtime data and return a string
- No YAML parsing, no indentation errors, no key synchronization issues
- Your IDE can trace exactly where a system prompt is used and refactor it

### Why This Matters

Multi-agent systems are powerful because they:

- **Distribute Responsibilities** across specialized agents with distinct roles
- **Enable Collaboration** through task delegation and information sharing
- **Improve Reasoning** by combining multiple expert perspectives
- **Handle Complexity** by breaking down large problems into manageable subtasks
- **Scale Efficiently** as new agents and tools can be added without disrupting existing ones

### Why This Architecture Matters

**Benefits of multi-agent LangGraph systems:**

- **Specialization** — Each node has exactly the tools and context it needs
- **Different models per node** — You could use GPT-4o for the detective and a cheaper model for search
- **Explicit data flow** — State fields make it clear what each node produces and consumes
- **Debuggability** — Every state transition is observable; add `console.log` to any node
- **Extensibility** — Adding a new agent is `.addNode()` + `.addEdge()` + a new node function

**Real-world applications:**

- Customer service: Routing agent → Specialist agents → Escalation agent
- Research: Data collection agent → Analysis agent → Report generation agent
- DevOps: Monitoring agent → Diagnosis agent → Remediation agent

---

## Key Takeaways

- **Multi-node LangGraph workflows** decompose complex problems into specialized, sequential steps
- **Shared state** is how nodes communicate: earlier results flow to later nodes via state fields
- **System prompts with runtime data** (`AGENT_CONFIGS.leadDetective.systemPrompt(...)`) enable context-aware synthesis
- **Edges define execution order**: the Lead Detective waits for both predecessors to complete
- **`state.appraisal_result || 'No appraisal result available'`**: always provide fallbacks when reading optional state fields
- **Prompt engineering** is iterative: run, observe, refine until the detective identifies the right suspect

---

## Congratulations!

You've successfully built a sophisticated multi-agent AI investigation system in TypeScript that can:

- **Predict financial values** using the SAP-RPT-1 structured data model
- **Search evidence documents** using the SAP Grounding Service (RAG)
- **Synthesize findings** across multiple agents using LangGraph state
- **Solve complex problems** through collaborative, code-based agent orchestration

---

## Next Steps Checklist

1. ✅ [Understand Generative AI Hub](00-understanding-genAI-hub.md)
2. ✅ [Set up your development space](01-setup-dev-space.md)
3. ✅ [Build a basic agent](02-build-a-basic-agent.md)
4. ✅ [Add custom tools](03-add-your-first-tool.md) (RPT-1 model integration)
5. ✅ [Build a multi-agent workflow](04-building-multi-agent-system.md)
6. ✅ [Integrate the Grounding Service](05-add-the-grounding-service.md)
7. ✅ [Solve the museum art theft mystery](07-solve-the-crime.md) (this exercise)

---

## Troubleshooting

**Issue**: Lead Detective's conclusion doesn't include appraisal values

- **Solution**: Ensure the `leadDetective.systemPrompt` in `agentConfigs.ts` explicitly asks the LLM to "Summarise the insurance appraisal values" and "Calculate the total estimated insurance value". The LLM only includes what you ask for.

**Issue**: `state.appraisal_result` is `undefined` in the Lead Detective node

- **Solution**: Check that the Appraiser node is returning the `appraisal_result` field in its return object. Add `console.log(state.appraisal_result)` at the start of `leadDetectiveNode` to debug.

**Issue**: `Cannot read properties of undefined (reading 'split')` in Evidence Analyst

- **Solution**: `state.suspect_names` is undefined. Ensure your `kickoff()` call passes `suspect_names` in the input and your `AgentState` interface includes it as a required field.

**Issue**: Investigation runs but `final_conclusion` is empty

- **Solution**: Verify the `kickoff()` method returns `result.final_conclusion`. The `leadDetectiveNode` must return `{ final_conclusion: conclusion }` and the `final_conclusion` channel must be declared in `channels`.

**Issue**: Agent identifies the wrong suspect after multiple runs

- **Solution**: LLMs are non-deterministic by default. Lower `temperature` in `model_params` (try `0.3`) for more consistent reasoning. Also refine the Lead Detective's system prompt to be more specific about how to weigh evidence.

**Issue**: `Error during final analysis: Error: 429 Too Many Requests`

- **Solution**: You've hit the API rate limit. Wait a moment and retry. If this happens consistently, consider reducing the `max_chunk_count` in the grounding config to reduce token usage.

---

## Resources

- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)
- [SAP Cloud SDK for AI (JavaScript)](https://github.com/SAP/ai-sdk-js)
- [SAP Generative AI Hub](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/generative-ai-hub-in-sap-ai-core-7db524ee75e74bf8b50c167951fe34a5)
- [SAP-RPT-1 Playground](https://rpt.cloud.sap/)
- [SAP AI Core Grounding Management](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/document-grounding)
