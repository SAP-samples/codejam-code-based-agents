import { Annotation } from "@langchain/langgraph";

export interface PredictionTargetColumn {
  name: string;
  prediction_placeholder: string;
  task_type: "regression" | "classification";
}

export interface PredictionConfig {
  target_columns: PredictionTargetColumn[];
}

// Row shape as stored in artworks.db — NULL means value is unknown (will become '[PREDICT]')
export interface ArtworkRow {
  ITEM_ID: string;
  ITEM_NAME: string;
  ARTIST: string;
  ACQUISITION_DATE: string;
  INSURANCE_VALUE: number | null;
  ITEM_CATEGORY: string | null;
  DIMENSIONS: string;
  CONDITION_SCORE: number;
  RARITY_SCORE: number;
  PROVENANCE_CLARITY: number;
}

export interface StolenItem {
  ITEM_ID: string;
  ITEM_NAME: string;
  ARTIST: string;
  ACQUISITION_DATE: string;
  INSURANCE_VALUE: number | string;
  ITEM_CATEGORY: string;
  DIMENSIONS: string;
  CONDITION_SCORE: number;
  RARITY_SCORE: number;
  PROVENANCE_CLARITY: number;
}

export interface RPT1Payload {
  prediction_config: PredictionConfig;
  index_column: string;
  rows: StolenItem[];
}

export const AgentState = Annotation.Root({
  suspect_names: Annotation<string>,
  appraisal_result: Annotation<string | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),
  appraisal_success: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),
  evidence_analysis: Annotation<string | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),
  evidence_count: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  final_conclusion: Annotation<string | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),
  confidence_score: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  witness_statement: Annotation<string | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

export type AgentStateType = typeof AgentState.State;
