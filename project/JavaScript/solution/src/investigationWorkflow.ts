import { StateGraph, END, START } from '@langchain/langgraph'
import { OrchestrationClient } from '@sap-ai-sdk/orchestration'
import type { AgentState, ModelParams } from './types.js'
import { callRPT1Tool, callGroundingServiceTool, callSonarProSearchTool } from './tools.js'
import { AGENT_CONFIGS } from './agentConfigs.js'

/**
 * Create the LangGraph state graph for the investigator crew
 */
export class InvestigationWorkflow {
    private orchestrationClient: OrchestrationClient
    private model: string = 'gpt-4o'
    private model_params: ModelParams = {
        temperature: 0.7,
        max_tokens: 2000,
    }
    private graph: StateGraph<AgentState>

    constructor(model: string, model_params?: ModelParams) {
        this.model = model
        this.model_params = { ...this.model_params, ...model_params }
        this.orchestrationClient = new OrchestrationClient(
            {
                llm: { model_name: this.model, model_params: this.model_params },
            },
            { resourceGroup: process.env.RESOURCE_GROUP },
        )

        // Create the state graph
        this.graph = this.buildGraph()
    }

    /**
     * Appraiser Agent Node - Uses RPT-1 to appraise stolen items
     */
    private async appraiserNode(state: AgentState): Promise<Partial<AgentState>> {
        console.log('\n🔍 Appraiser Agent starting...')

        try {
            // Call the RPT-1 tool with the payload
            const result = await callRPT1Tool(state.payload)

            const appraisalResult = `Insurance Appraisal Complete: ${result}
      Summary: Successfully predicted missing insurance values and item categories for the stolen artworks.`

            console.log('✅ Appraisal complete')

            return {
                appraisal_result: appraisalResult,
                messages: [...state.messages, { role: 'assistant', content: appraisalResult }],
            }
        } catch (error) {
            const errorMsg = `Error during appraisal: ${error}`
            console.error('❌', errorMsg)
            return {
                appraisal_result: errorMsg,
                messages: [...state.messages, { role: 'assistant', content: errorMsg }],
            }
        }
    }

    /**
     * Evidence Analyst Agent Node - Uses grounding service to analyze evidence
     */
    private async evidenceAnalystNode(state: AgentState): Promise<Partial<AgentState>> {
        console.log('\n🔍 Evidence Analyst starting...')

        try {
            // Search for evidence about each suspect
            const suspects = state.suspect_names.split(',').map(s => s.trim())
            const evidenceResults: string[] = []

            for (const suspect of suspects) {
                console.log(`  Searching evidence for: ${suspect}`)
                const query = `Find evidence and information about ${suspect} related to the art theft`
                const result = await callGroundingServiceTool(query)
                evidenceResults.push(`Evidence for ${suspect}:\n${result}`)
            }

            const evidenceAnalysis = `Evidence Analysis Complete: ${evidenceResults.join('\n\n')}
      Summary: Analyzed evidence for all suspects: ${state.suspect_names}`

            console.log('✅ Evidence analysis complete')

            return {
                evidence_analysis: evidenceAnalysis,
                messages: [...state.messages, { role: 'assistant', content: evidenceAnalysis }],
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.error('❌ Evidence analysis failed:', errorMsg)
            if (error instanceof Error && error.stack) {
                console.error(error.stack)
            }
            return {
                evidence_analysis: `Error during evidence analysis: ${errorMsg}`,
                messages: [
                    ...state.messages,
                    { role: 'assistant', content: `Error during evidence analysis: ${errorMsg}` },
                ],
            }
        }
    }

    /**
     * Intelligence Researcher Agent Node - Uses web search to find criminal patterns
     */
    private async intelligenceResearcherNode(state: AgentState): Promise<Partial<AgentState>> {
        console.log('\n🔍 Intelligence Researcher starting web search...')

        try {
            const suspects = state.suspect_names.split(',').map(s => s.trim())
            const intelligenceResults: string[] = []

            // Search for criminal records for each suspect
            for (const suspect of suspects) {
                console.log(`  Searching public records for: ${suspect}`)
                const query = `${suspect} criminal record art theft security technician Europe background check`
                const result = await callSonarProSearchTool(query)
                intelligenceResults.push(`Background check for ${suspect}:\n${result}`)
            }

            // Search for similar art theft patterns
            console.log('  Searching for similar art theft incidents...')
            const patternQuery =
                'museum art theft insider job no forced entry Europe similar incidents criminal network'
            const patternResult = await callSonarProSearchTool(patternQuery)
            intelligenceResults.push(`Similar Art Theft Patterns:\n${patternResult}`)

            const intelligenceReport = `Intelligence Research Complete: ${intelligenceResults.join('\n\n')}
      Summary: Conducted OSINT research on all suspects and identified similar crime patterns`

            console.log('✅ Intelligence research complete')

            return {
                intelligence_report: intelligenceReport,
                messages: [...state.messages, { role: 'assistant', content: intelligenceReport }],
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.error('❌ Intelligence research failed:', errorMsg)
            if (error instanceof Error && error.stack) {
                console.error(error.stack)
            }
            return {
                intelligence_report: `Error during intelligence research: ${errorMsg}`,
                messages: [
                    ...state.messages,
                    { role: 'assistant', content: `Error during intelligence research: ${errorMsg}` },
                ],
            }
        }
    }

    /**
     * Lead Detective Agent Node - Synthesizes findings and identifies the culprit
     */
    private async leadDetectiveNode(state: AgentState): Promise<Partial<AgentState>> {
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
                            state.intelligence_report || 'No intelligence report available',
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

    /**
     * Build the LangGraph state graph
     */
    private buildGraph(): StateGraph<AgentState> {
        const workflow = new StateGraph<AgentState>({
            channels: {
                payload: null,
                suspect_names: null,
                appraisal_result: null,
                evidence_analysis: null,
                intelligence_report: null,
                final_conclusion: null,
                messages: null,
            },
        })

        // Add nodes and edges using chained API (required in LangGraph 0.2+)
        workflow
            .addNode('appraiser', this.appraiserNode.bind(this))
            .addNode('evidence_analyst', this.evidenceAnalystNode.bind(this))
            .addNode('intelligence_researcher', this.intelligenceResearcherNode.bind(this))
            .addNode('lead_detective', this.leadDetectiveNode.bind(this))
            .addEdge(START, 'appraiser')
            .addEdge('appraiser', 'evidence_analyst')
            .addEdge('evidence_analyst', 'intelligence_researcher')
            .addEdge('intelligence_researcher', 'lead_detective')
            .addEdge('lead_detective', END)

        return workflow
    }

    /**
     * Execute the investigation workflow
     */
    async kickoff(inputs: { payload: any; suspect_names: string }): Promise<string> {
        console.log('🚀 Starting Investigation Workflow...\n')
        console.log(`Suspects: ${inputs.suspect_names}\n`)

        const initialState: AgentState = {
            payload: inputs.payload,
            suspect_names: inputs.suspect_names,
            messages: [],
        }

        try {
            const app = this.graph.compile()
            const result = await app.invoke(initialState)

            return result.final_conclusion || 'Investigation completed but no conclusion was reached.'
        } catch (error) {
            const errorMsg = `Investigation failed: ${error}`
            console.error('❌', errorMsg)
            return errorMsg
        }
    }
}
