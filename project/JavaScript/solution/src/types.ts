/**
 * Type definitions for the Investigator Crew system
 */

/**
 * Configuration for the LLM parameters
 */

export interface ModelParams {
    temperature?: number
    max_tokens?: number
}

/**
 * Configuration for prediction targets in RPT1 payload
 */
export interface PredictionTargetColumn {
    name: string
    prediction_placeholder: string
    task_type: 'regression' | 'classification'
}

/**
 * Configuration for prediction in RPT1 payload
 */
export interface PredictionConfig {
    target_columns: PredictionTargetColumn[]
}

/**
 * Stolen item record
 */
export interface StolenItem {
    ITEM_ID: string
    ITEM_NAME: string
    ARTIST: string
    ACQUISITION_DATE: string
    INSURANCE_VALUE: number | string
    ITEM_CATEGORY: string
    DIMENSIONS: string
    CONDITION_SCORE: number
    RARITY_SCORE: number
    PROVENANCE_CLARITY: number
}

/**
 * Complete RPT1 payload structure
 * Supports both predictWithSchema() and predictWithoutSchema()
 */
export interface RPT1Payload {
    prediction_config: PredictionConfig
    index_column: string
    rows: StolenItem[]
    parse_data_types?: boolean // Optional: control data type parsing
    data_schema?: any // Optional: schema definition for data types
}

/**
 * Agent state for LangGraph
 */
export interface AgentState {
    payload: RPT1Payload
    suspect_names: string
    appraisal_result?: string
    evidence_analysis?: string
    intelligence_report?: string
    final_conclusion?: string
    messages: Array<{
        role: string
        content: string
    }>
}

/**
 * Tool call result
 */
export interface ToolResult {
    success: boolean
    data?: any
    error?: string
}
