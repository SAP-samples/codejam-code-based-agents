import { StateGraph, END, START } from "@langchain/langgraph";
import { OrchestrationClient } from "@sap-ai-sdk/orchestration";
import { AgentState } from "./types.js";
import type { AgentStateType, RPT1Payload } from "./types.js";
import { callRPT1Tool, callGroundingServiceTool, callSonarProSearchTool } from "./tools.js";
import { AGENT_CONFIGS } from "./agentConfigs.js";

export class InvestigationWorkflow {
  private graph;
  private orchestrationClient: OrchestrationClient;

  private buildGraph() {
    const workflow = new StateGraph(AgentState);

    workflow
      .addNode("appraiser", this.appraiserNode.bind(this))
      .addNode("evidence_analyst", this.evidenceAnalystNode.bind(this))
      .addNode("intelligence_researcher", this.intelligenceResearcherNode.bind(this))
      .addNode("lead_detective", this.leadDetectiveNode.bind(this))
      .addEdge(START, "appraiser")
      .addEdge("appraiser", "evidence_analyst")
      .addEdge("evidence_analyst", "intelligence_researcher")
      .addEdge("intelligence_researcher", "lead_detective")
      .addEdge("lead_detective", END);

    return workflow;
  }

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

  private async appraiserNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    console.log("\n🔍 Appraiser Agent starting...");

    try {
      const result = await callRPT1Tool(state.payload);

      const appraisalResult = `Insurance Appraisal Complete: ${result}
      Summary: Successfully predicted missing insurance values and item categories for the stolen artworks.`;

      console.log("✅ Appraisal complete");

      return {
        appraisal_result: appraisalResult,
        messages: [...state.messages, { role: "assistant", content: appraisalResult }],
      };
    } catch (error) {
      const errorMsg = `Error during appraisal: ${error}`;
      console.error("❌", errorMsg);
      return {
        appraisal_result: errorMsg,
        messages: [...state.messages, { role: "assistant", content: errorMsg }],
      };
    }
  }

  private async evidenceAnalystNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    console.log("\n🔍 Evidence Analyst starting...");

    try {
      const suspects = state.suspect_names.split(",").map((s) => s.trim());
      const evidenceResults: string[] = [];

      for (const suspect of suspects) {
        console.log(`  Searching evidence for: ${suspect}`);
        const query = `Find evidence and information about ${suspect} related to the art theft`;
        const result = await callGroundingServiceTool(query);
        console.log(`  Evidence found:\n${result}`);
        evidenceResults.push(`Evidence for ${suspect}:\n${result}`);
      }

      const evidenceAnalysis = `Evidence Analysis Complete: ${evidenceResults.join("\n\n")}
      Summary: Analyzed evidence for all suspects: ${state.suspect_names}`;

      console.log("✅ Evidence analysis complete");

      return {
        evidence_analysis: evidenceAnalysis,
        messages: [...state.messages, { role: "assistant", content: evidenceAnalysis }],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Evidence analysis failed:", errorMsg);
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      return {
        evidence_analysis: `Error during evidence analysis: ${errorMsg}`,
        messages: [
          ...state.messages,
          { role: "assistant", content: `Error during evidence analysis: ${errorMsg}` },
        ],
      };
    }
  }

  private async intelligenceResearcherNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    console.log("\n🔍 Intelligence Researcher starting web search...");

    try {
      const suspects = state.suspect_names.split(",").map((s) => s.trim());
      const intelligenceResults: string[] = [];

      for (const suspect of suspects) {
        console.log(`  Searching public records for: ${suspect}`);
        const query = `${suspect} criminal record art theft security technician Europe background check`;
        const result = await callSonarProSearchTool(query);
        intelligenceResults.push(`Background check for ${suspect}:\n${result}`);
      }

      console.log("  Searching for similar art theft incidents...");
      const patternQuery =
        "museum art theft insider job no forced entry Europe similar incidents criminal network";
      const patternResult = await callSonarProSearchTool(patternQuery);
      intelligenceResults.push(`Similar Art Theft Patterns:\n${patternResult}`);

      const rawResults = `Intelligence Research Complete:\n\n${intelligenceResults.join("\n\n")}`;

      const response = await this.orchestrationClient.chatCompletion({
        messages: [
          {
            role: "system",
            content: AGENT_CONFIGS.intelligenceResearcher.systemPrompt(state.suspect_names),
          },
          {
            role: "user",
            content: `Here are the web search results. Write a concise intelligence report:\n\n${rawResults}`,
          },
        ],
      });

      const intelligenceReport = response.getContent() || "No intelligence report could be generated.";
      console.log("✅ Intelligence research complete");

      return {
        intelligence_report: intelligenceReport,
        messages: [...state.messages, { role: "assistant", content: intelligenceReport }],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Intelligence research failed:", errorMsg);
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      return {
        intelligence_report: `Error during intelligence research: ${errorMsg}`,
        messages: [
          ...state.messages,
          { role: "assistant", content: `Error during intelligence research: ${errorMsg}` },
        ],
      };
    }
  }

  private async leadDetectiveNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    console.log("\n🔍 Lead Detective analyzing all findings...");

    const userMessage =
      "Analyze all the evidence and identify the culprit. Provide a detailed conclusion.";

    try {
      const response = await this.orchestrationClient.chatCompletion({
        messages: [
          {
            role: "system",
            content: AGENT_CONFIGS.leadDetective.systemPrompt(
              state.appraisal_result || "No appraisal result available",
              state.evidence_analysis || "No evidence analysis available",
              state.intelligence_report || "No intelligence report available",
              state.suspect_names,
            ),
          },
          { role: "user", content: userMessage },
        ],
      });
      const conclusion = response.getContent() || "No conclusion could be drawn.";

      console.log("✅ Investigation complete");

      return {
        final_conclusion: conclusion,
        messages: [...state.messages, { role: "assistant", content: conclusion }],
      };
    } catch (error) {
      const errorMsg = `Error during final analysis: ${error}`;
      console.error("❌", errorMsg);
      return {
        final_conclusion: errorMsg,
        messages: [...state.messages, { role: "assistant", content: errorMsg }],
      };
    }
  }

  async kickoff(inputs: { payload: RPT1Payload; suspect_names: string }): Promise<string> {
    console.log("🚀 Starting Investigation Workflow...\n");

    const app = this.graph.compile();
    const result = await app.invoke({
      payload: inputs.payload,
      suspect_names: inputs.suspect_names,
      messages: [],
    });

    console.log("\n--- Appraisal Result ---");
    console.log(result.appraisal_result ?? "(not set)");
    console.log("\n--- Evidence Analysis ---");
    console.log(result.evidence_analysis ?? "(not set)");
    console.log("\n--- Intelligence Report ---");
    console.log(result.intelligence_report ?? "(not set)");

    return result.final_conclusion || "Investigation completed but no conclusion was reached.";
  }
}
