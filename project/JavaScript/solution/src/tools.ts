import { OrchestrationClient } from '@sap-ai-sdk/orchestration'
import { RPT1Client } from './rptClient.js'
import type { RPT1Payload } from './types.js'

const rpt1Client = new RPT1Client()

const groundingClient = new OrchestrationClient(
    {
        llm: {
            model_name: process.env.MODEL_NAME!,
            model_params: {},
        },
        templating: {
            template: [
                {
                    role: 'system',
                    content: 'Use the following context to answer the question:\n{{?groundingOutput}}',
                },
                { role: 'user', content: '{{?user_question}}' },
            ],
        },
        grounding: {
            type: 'document_grounding_service',
            config: {
                filters: [
                    {
                        id: 'vector',
                        data_repository_type: 'vector',
                        data_repositories: [process.env.GROUNDING_PIPELINE_ID!],
                        search_config: {
                            max_chunk_count: 5,
                        },
                    },
                ],
                input_params: ['user_question'],
                output_param: 'groundingOutput',
            },
        },
    },
    { resourceGroup: process.env.RESOURCE_GROUP },
)

export async function callRPT1Tool(payload: RPT1Payload): Promise<string> {
    try {
        const response = await rpt1Client.predictWithoutSchema(payload as any)
        return JSON.stringify(response, null, 2)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('❌ RPT-1 call failed:', errorMessage)
        if (error instanceof Error && error.stack) console.error(error.stack)
        return `Error calling RPT-1: ${errorMessage}`
    }
}

export async function callGroundingServiceTool(user_question: string): Promise<string> {
    try {
        const response = await groundingClient.chatCompletion({
            inputParams: { user_question },
        })
        return response.getContent() ?? 'No response from grounding service'
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('❌ Grounding service call failed:', errorMessage)
        if (error instanceof Error && error.stack) console.error(error.stack)
        return `Error calling grounding service: ${errorMessage}`
    }
}

/**
 * Web Search Tool - Uses Perplexity's sonar-pro model for real-time web search
 */
const webSearchClient = new OrchestrationClient(
    {
        llm: {
            model_name: 'sonar-pro',
            model_params: {
                temperature: 0.2, // Lower temperature for factual search
            },
        },
        templating: {
            template: [
                {
                    role: 'system',
                    content:
                        'You are a web search assistant specializing in criminal intelligence. Search for accurate, recent information and always provide source citations with URLs and dates.',
                },
                { role: 'user', content: '{{?search_query}}' },
            ],
        },
    },
    { resourceGroup: process.env.RESOURCE_GROUP },
)

export async function callSonarProSearchTool(search_query: string): Promise<string> {
    try {
        const response = await webSearchClient.chatCompletion({
            inputParams: { search_query },
        })
        return response.getContent() ?? 'No search results found'
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('❌ Sonar-pro web search failed:', errorMessage)
        if (error instanceof Error && error.stack) console.error(error.stack)
        return `Error calling sonar-pro web search: ${errorMessage}`
    }
}
