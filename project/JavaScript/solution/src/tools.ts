import { RPT1Client } from "./rptClient.js";
import { OrchestrationClient } from "@sap-ai-sdk/orchestration";
import type { RPT1Payload } from "./types.js";

const rpt1Client = new RPT1Client();

const groundingClient = new OrchestrationClient(
  {
    promptTemplating: {
      model: {
        name: process.env.MODEL_NAME!,
        params: {},
      },
      prompt: {
        template: [
          {
            role: "system",
            content: "Use the following context to answer the question:\n{{?groundingOutput}}",
          },
          { role: "user", content: "{{?user_question}}" },
        ],
      },
    },
    grounding: {
      type: "document_grounding_service",
      config: {
        filters: [
          {
            id: "vector",
            data_repository_type: "vector",
            data_repositories: [process.env.GROUNDING_PIPELINE_ID!],
            search_config: {
              max_chunk_count: 5,
            },
          },
        ],
        placeholders: {
          input: ["user_question"],
          output: "groundingOutput",
        },
      },
    },
  },
  { resourceGroup: process.env.RESOURCE_GROUP },
);

export async function callRPT1Tool(payload: RPT1Payload): Promise<string> {
  try {
    const response = await rpt1Client.predictWithoutSchema(payload);
    return JSON.stringify(response, null, 2);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ RPT-1 call failed:", errorMessage);
    return `Error calling RPT-1: ${errorMessage}`;
  }
}

export async function callGroundingServiceTool(user_question: string): Promise<string> {
  try {
    const response = await groundingClient.chatCompletion({
      placeholderValues: { user_question },
    });
    return response.getContent() ?? "No response from grounding service";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Grounding service call failed:", errorMessage);
    return `Error calling grounding service: ${errorMessage}`;
  }
}
