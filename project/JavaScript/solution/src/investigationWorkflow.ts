import { StateGraph, END, START, interrupt, MemorySaver, Command } from "@langchain/langgraph";
import { OrchestrationClient } from "@sap-ai-sdk/orchestration";
import { z } from "zod";
import { AgentState } from "./types.js";
import type { AgentStateType } from "./types.js";
import {
  lookupArtworksTool,
  buildRPT1Payload,
  callRPT1Tool,
  searchDocumentsTool,
  listSuspectsTool,
  lookupTimelineTool,
} from "./tools.js";
import { AGENT_CONFIGS } from "./agentConfigs.js";

const CONFIDENCE_THRESHOLD = 0.7;

const VerdictSchema = z.object({
  culprit: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  totalInsuranceLoss: z.number(),
});

type Verdict = z.infer<typeof VerdictSchema>;

export class InvestigationWorkflow {
  private orchestrationClient: OrchestrationClient;
  private checkpointer: MemorySaver;

  constructor(model: string = process.env.MODEL_NAME!) {
    this.orchestrationClient = new OrchestrationClient({
      promptTemplating: {
        model: {
          name: model,
          params: { temperature: 0.7, max_tokens: 2000 },
        },
      },
    });
    this.checkpointer = new MemorySaver();
  }

  private buildGraph() {
    const workflow = new StateGraph(AgentState);

    workflow
      .addNode("appraiser", this.appraiserNode.bind(this))
      .addNode("evidence_analyst", this.evidenceAnalystNode.bind(this))
      .addNode("lead_detective", this.leadDetectiveNode.bind(this))
      // Parallel fork: both agents start from START and run concurrently
      .addEdge(START, "appraiser")
      .addEdge(START, "evidence_analyst")
      // Conditional routing after each node
      .addConditionalEdges("appraiser", routeAfterAppraisal, {
        continue: "lead_detective",
        failed: END,
      })
      .addConditionalEdges("evidence_analyst", routeAfterAnalysis, {
        continue: "lead_detective",
        insufficient: END,
      })
      .addConditionalEdges("lead_detective", routeAfterVerdict, {
        committed: END,
        needs_review: "lead_detective",
      });

    return workflow;
  }

  private async appraiserNode(_state: AgentStateType): Promise<Partial<AgentStateType>> {
    console.log(JSON.stringify({ event: "node_start", node: "appraiser" }));

    try {
      const artworks = lookupArtworksTool();
      const payload = buildRPT1Payload(artworks);
      const result = await callRPT1Tool(payload);

      const appraisalResult = `Insurance Appraisal Complete:\n${result}\nSummary: Successfully predicted missing insurance values and item categories for the stolen artworks.`;

      console.log(JSON.stringify({ event: "node_complete", node: "appraiser", success: true, outputLength: appraisalResult.length }));

      return {
        appraisal_result: appraisalResult,
        appraisal_success: true,
        messages: [{ role: "assistant", content: appraisalResult }],
      };
    } catch (error) {
      const errorMsg = `Error during appraisal: ${error}`;
      console.error(JSON.stringify({ event: "node_error", node: "appraiser", error: errorMsg }));
      return {
        appraisal_result: errorMsg,
        appraisal_success: false,
        messages: [{ role: "assistant", content: errorMsg }],
      };
    }
  }

  private async evidenceAnalystNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    console.log(JSON.stringify({ event: "node_start", node: "evidence_analyst", suspects: state.suspect_names }));

    try {
      const suspects = JSON.parse(listSuspectsTool()) as Array<{ name: string }>;
      const evidenceResults: string[] = [];

      for (const suspect of suspects) {
        console.log(`  Searching evidence for: ${suspect.name}`);
        const result = await searchDocumentsTool(
          `Find all evidence, alibis, motives and connections for ${suspect.name} related to the art theft`,
        );
        evidenceResults.push(`Evidence for ${suspect.name}:\n${result}`);
      }

      // Cross-reference timeline around the night of the theft
      const timeline = await lookupTimelineTool({ from: "2024-03-14", to: "2024-03-16" });
      evidenceResults.push(`Timeline (March 14–16, 2024):\n${timeline}`);

      const evidenceAnalysis = `Evidence Analysis Complete:\n\n${evidenceResults.join("\n\n")}\n\nSummary: Analyzed evidence for all suspects and cross-referenced the theft timeline.`;

      console.log(JSON.stringify({ event: "node_complete", node: "evidence_analyst", success: true, documentCount: evidenceResults.length }));

      return {
        evidence_analysis: evidenceAnalysis,
        evidence_count: evidenceResults.length,
        messages: [{ role: "assistant", content: evidenceAnalysis }],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ event: "node_error", node: "evidence_analyst", error: errorMsg }));
      return {
        evidence_analysis: `Error during evidence analysis: ${errorMsg}`,
        evidence_count: 0,
        messages: [{ role: "assistant", content: `Error during evidence analysis: ${errorMsg}` }],
      };
    }
  }

  private async leadDetectiveNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    console.log(JSON.stringify({ event: "node_start", node: "lead_detective", hasWitnessStatement: !!state.witness_statement }));

    // If confidence is below threshold and no witness statement yet, pause for human input
    if (state.confidence_score > 0 && state.confidence_score < CONFIDENCE_THRESHOLD && !state.witness_statement) {
      const witnessStatement = interrupt(
        `[INVESTIGATION PAUSED — CONFIDENCE: ${state.confidence_score.toFixed(2)}]\n\nLead Detective requires additional evidence before finalizing verdict.\nPaste the new witness statement to continue:\n`,
      ) as string;

      return { witness_statement: witnessStatement };
    }

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
        console.error(JSON.stringify({ event: "verdict_parse_error", node: "lead_detective", raw: raw.slice(0, 200) }));
        // Treat parse failure as zero confidence — routes to interrupt
        return { confidence_score: 0, final_conclusion: raw, messages: [{ role: "assistant", content: raw }] };
      }

      const conclusion = `VERDICT: ${verdict.culprit}\nCONFIDENCE: ${(verdict.confidence * 100).toFixed(0)}%\nTOTAL INSURANCE LOSS: $${verdict.totalInsuranceLoss.toLocaleString()}\n\nREASONING:\n${verdict.reasoning}`;

      console.log(JSON.stringify({ event: "node_complete", node: "lead_detective", culprit: verdict.culprit, confidence: verdict.confidence }));

      return {
        final_conclusion: conclusion,
        confidence_score: verdict.confidence,
        messages: [{ role: "assistant", content: conclusion }],
      };
    } catch (error) {
      const errorMsg = `Error during final analysis: ${error}`;
      console.error(JSON.stringify({ event: "node_error", node: "lead_detective", error: errorMsg }));
      return {
        final_conclusion: errorMsg,
        confidence_score: 0,
        messages: [{ role: "assistant", content: errorMsg }],
      };
    }
  }

  async kickoff(inputs: { suspect_names: string; payload?: never }, threadId = "default"): Promise<string> {
    console.log("🚀 Starting Investigation Workflow...\n");

    const app = this.buildGraph().compile({
      checkpointer: this.checkpointer,
      interruptBefore: [],
    });

    const config = { configurable: { thread_id: threadId }, recursionLimit: 10 };

    await app.invoke(
      { suspect_names: inputs.suspect_names, messages: [] },
      config,
    );

    // Resume loop: check if the graph paused for human input, collect it and continue
    let snapshot = await app.getState(config);
    while (snapshot.tasks.some((t) => t.interrupts.length > 0)) {
      const interruptValue = snapshot.tasks.flatMap((t) => t.interrupts)[0].value;
      console.log("\n" + interruptValue);

      const witnessStatement = await readUserInput();

      await app.invoke(new Command({ resume: witnessStatement }), config);
      snapshot = await app.getState(config);
    }

    const result = snapshot.values;

    console.log("\n--- Appraisal Result ---");
    console.log(result.appraisal_result ?? "(not set)");
    console.log("\n--- Evidence Analysis ---");
    console.log(result.evidence_analysis ?? "(not set)");
    console.log("\n--- Confidence Score ---");
    console.log(result.confidence_score ?? 0);

    return result.final_conclusion || "Investigation completed but no conclusion was reached.";
  }
}

// --- Routing functions ---

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
    console.log(JSON.stringify({ event: "route", from: "lead_detective", to: "END", reason: "verdict_committed", confidence: state.confidence_score }));
    return "committed";
  }
  console.log(JSON.stringify({ event: "route", from: "lead_detective", to: "interrupt", reason: "low_confidence", confidence: state.confidence_score }));
  return "needs_review";
}

// Reads a line of input from stdin (used for the human-in-the-loop resume)
async function readUserInput(): Promise<string> {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("> ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}