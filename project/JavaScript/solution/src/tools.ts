import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { RPT1Client } from "./rptClient.js";
import { OrchestrationClient } from "@sap-ai-sdk/orchestration";
import type { ArtworkRow, RPT1Payload, StolenItem } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data/artworks.db");

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

// --- Art catalog tools (SQLite) ---

export function lookupArtworksTool(): ArtworkRow[] {
  console.log(JSON.stringify({ event: "tool_call", tool: "lookup_artworks" }));
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const rows = db.prepare("SELECT * FROM artworks ORDER BY ITEM_ID").all() as ArtworkRow[];
    console.log(JSON.stringify({ event: "tool_result", tool: "lookup_artworks", count: rows.length }));
    return rows;
  } finally {
    db.close();
  }
}

// Assembles SQLite rows into the exact RPT-1 payload structure.
// NULL values become the '[PREDICT]' placeholder required by the API.
export function buildRPT1Payload(rows: ArtworkRow[]): RPT1Payload {
  const stolenItems: StolenItem[] = rows.map((row) => ({
    ITEM_ID: row.ITEM_ID,
    ITEM_NAME: row.ITEM_NAME,
    ARTIST: row.ARTIST,
    ACQUISITION_DATE: row.ACQUISITION_DATE,
    INSURANCE_VALUE: row.INSURANCE_VALUE ?? "'[PREDICT]'",
    ITEM_CATEGORY: row.ITEM_CATEGORY ?? "'[PREDICT]'",
    DIMENSIONS: row.DIMENSIONS,
    CONDITION_SCORE: row.CONDITION_SCORE,
    RARITY_SCORE: row.RARITY_SCORE,
    PROVENANCE_CLARITY: row.PROVENANCE_CLARITY,
  }));

  return {
    prediction_config: {
      target_columns: [
        { name: "INSURANCE_VALUE", prediction_placeholder: "'[PREDICT]'", task_type: "regression" },
        { name: "ITEM_CATEGORY", prediction_placeholder: "'[PREDICT]'", task_type: "classification" },
      ],
    },
    index_column: "ITEM_ID",
    rows: stolenItems,
  };
}

export async function callRPT1Tool(payload: RPT1Payload): Promise<string> {
  console.log(JSON.stringify({ event: "tool_call", tool: "call_rpt1", rowCount: payload.rows.length }));
  try {
    const response = await rpt1Client.predictWithoutSchema(payload);
    const result = JSON.stringify(response, null, 2);
    console.log(JSON.stringify({ event: "tool_result", tool: "call_rpt1", success: true, outputLength: result.length }));
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ RPT-1 call failed:", errorMessage);
    return `Error calling RPT-1: ${errorMessage}`;
  }
}

// --- Evidence Analyst tools ---

export async function searchDocumentsTool(query: string): Promise<string> {
  console.log(JSON.stringify({ event: "tool_call", tool: "search_documents", queryLength: query.length }));
  try {
    const response = await groundingClient.chatCompletion({
      placeholderValues: { user_question: query },
    });
    const result = response.getContent() ?? "No response from grounding service";
    console.log(JSON.stringify({ event: "tool_result", tool: "search_documents", success: true, outputLength: result.length }));
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Grounding service call failed:", errorMessage);
    return `Error calling grounding service: ${errorMessage}`;
  }
}

export function listSuspectsTool(): string {
  console.log(JSON.stringify({ event: "tool_call", tool: "list_suspects" }));
  return JSON.stringify([
    { name: "Sophie Dubois", aliases: ["S. Dubois", "SD-047"], role: "Night shift manager" },
    { name: "Marcus Chen", aliases: ["M. Chen", "MC-Security"], role: "Former security systems technician" },
    { name: "Viktor Petrov", aliases: ["V. Petrov", "Viktor P."], role: "Known art thief, on parole" },
  ]);
}

export async function lookupTimelineTool(dateRange: { from: string; to: string }): Promise<string> {
  console.log(JSON.stringify({ event: "tool_call", tool: "lookup_timeline", from: dateRange.from, to: dateRange.to }));
  const query = `Find all events and activities that occurred between ${dateRange.from} and ${dateRange.to} related to the art theft`;
  return searchDocumentsTool(query);
}
