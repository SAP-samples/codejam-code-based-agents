from pathlib import Path
from typing import TypedDict, Optional
from dotenv import load_dotenv
from langchain_litellm import ChatLiteLLM
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from gen_ai_hub.proxy.native.sap.client import RPTClient
from gen_ai_hub.document_grounding.client import RetrievalAPIClient
from gen_ai_hub.document_grounding.models.retrieval import (
    RetrievalSearchInput,
    RetrievalSearchFilter,
)
from gen_ai_hub.orchestration.models.document_grounding import DataRepositoryType
import json

from config.agents import APPRAISER_AGENT, EVIDENCE_ANALYST_AGENT, LEAD_DETECTIVE, WEB_RESEARCHER_AGENT

# Load .env from the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Initialize RPT-1 client after loading environment variables
rpt1_client = RPTClient()


class AgentState(TypedDict):
    payload: dict
    suspect_names: str
    appraisal_result: Optional[str]
    evidence_analysis: Optional[str]
    intelligence_report: Optional[str]
    final_conclusion: Optional[str]
    messages: list


def call_rpt1(payload: dict) -> str:
    """Call the SAP RPT-1 model to predict missing insurance values and item categories."""
    try:
        response = rpt1_client.predict(body=payload, model_name="sap-rpt-1-large")
        if response:
            return json.dumps(response.model_dump(), indent=2)
        else:
            return f"Error {response.status_code}: {response.text}"
    except Exception as e:
        return f"Error calling RPT-1: {str(e)}"


def call_grounding_service(user_question: str) -> str:
    """Search the evidence database for information about suspects, alibis, and motives."""
    retrieval_client = RetrievalAPIClient()

    search_filter = RetrievalSearchFilter(
        id="vector",
        dataRepositoryType=DataRepositoryType.VECTOR.value,
        dataRepositories=["0d3b132a-cbe1-4c75-abe7-adfbbab7e002"],  # Shared CodeJam pipeline ID
        searchConfiguration={
            "maxChunkCount": 5
        },
    )

    search_input = RetrievalSearchInput(
        query=user_question,
        filters=[search_filter],
    )

    response = retrieval_client.search(search_input)
    return json.dumps(response.model_dump(), indent=2)


def call_sonar_pro_search(query: str) -> str:
    """Search the web using Perplexity's sonar-pro model for real-time intelligence."""
    from litellm import completion
    try:
        response = completion(
            model="sap/sonar-pro",
            messages=[
                {
                    "role": "system",
                    "content": "You are a web search assistant specializing in criminal intelligence. Search for accurate, recent information and always provide source citations with URLs and dates."
                },
                {
                    "role": "user",
                    "content": query
                }
            ],
            temperature=0.2,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error calling sonar-pro web search: {str(e)}"


# Initialize the shared LLM
model = ChatLiteLLM(model="sap/anthropic--claude-4.5-opus", temperature=0)


def appraiser_node(state: AgentState) -> dict:
    print("\n🔍 Appraiser Agent starting...")

    try:
        rpt1_result = call_rpt1(state["payload"])

        response = model.invoke([
            SystemMessage(content=APPRAISER_AGENT["prompt"]),
            HumanMessage(content=f"Here are the RPT-1 predictions. Write a professional appraisal summary:\n\n{rpt1_result}"),
        ])

        appraisal_result = response.content
        print("✅ Appraisal complete")

        return {
            "appraisal_result": appraisal_result,
            "messages": state["messages"] + [{"role": "assistant", "content": appraisal_result}],
        }
    except Exception as e:
        error_msg = f"Error during appraisal: {e}"
        print(f"❌ {error_msg}")
        return {
            "appraisal_result": error_msg,
            "messages": state["messages"] + [{"role": "assistant", "content": error_msg}],
        }


def evidence_analyst_node(state: AgentState) -> dict:
    print("\n🔍 Evidence Analyst starting...")

    try:
        suspects = [s.strip() for s in state["suspect_names"].split(",")]
        evidence_results = []

        for suspect in suspects:
            print(f"  Searching evidence for: {suspect}")
            query = f"Find evidence and information about {suspect} related to the art theft"
            result = call_grounding_service(query)
            print(f"  Evidence found:\n{result}")
            evidence_results.append(f"Evidence for {suspect}:\n{result}")

        evidence_analysis = (
            f"Evidence Analysis Complete:\n\n" + "\n\n".join(evidence_results) +
            f"\n\nSummary: Analyzed evidence for all suspects: {state['suspect_names']}"
        )

        print("✅ Evidence analysis complete")

        return {
            "evidence_analysis": evidence_analysis,
            "messages": state["messages"] + [{"role": "assistant", "content": evidence_analysis}],
        }
    except Exception as e:
        error_msg = f"Error during evidence analysis: {e}"
        print(f"❌ {error_msg}")
        return {
            "evidence_analysis": error_msg,
            "messages": state["messages"] + [{"role": "assistant", "content": error_msg}],
        }


def intelligence_researcher_node(state: AgentState) -> dict:
    print("\n🔍 Intelligence Researcher starting web search...")

    try:
        suspects = [s.strip() for s in state["suspect_names"].split(",")]
        intelligence_results = []

        for suspect in suspects:
            print(f"  Searching public records for: {suspect}")
            query = f"{suspect} criminal record art theft security technician Europe background check"
            result = call_sonar_pro_search(query)
            intelligence_results.append(f"Background check for {suspect}:\n{result}")

        print("  Searching for similar art theft incidents...")
        pattern_query = "museum art theft insider job no forced entry Europe similar incidents criminal network"
        pattern_result = call_sonar_pro_search(pattern_query)
        intelligence_results.append(f"Similar Art Theft Patterns:\n{pattern_result}")

        intelligence_report = (
            "Intelligence Research Complete:\n\n" + "\n\n".join(intelligence_results) +
            f"\n\nSummary: Conducted OSINT research on all suspects and identified similar crime patterns"
        )

        print("✅ Intelligence research complete")

        return {
            "intelligence_report": intelligence_report,
            "messages": state["messages"] + [{"role": "assistant", "content": intelligence_report}],
        }
    except Exception as e:
        error_msg = f"Error during intelligence research: {e}"
        print(f"❌ {error_msg}")
        return {
            "intelligence_report": error_msg,
            "messages": state["messages"] + [{"role": "assistant", "content": error_msg}],
        }


def lead_detective_node(state: AgentState) -> dict:
    print("\n🔍 Lead Detective analyzing all findings...")

    try:
        response = model.invoke([
            SystemMessage(content=LEAD_DETECTIVE["prompt"](
                state["appraisal_result"] or "No appraisal result available",
                state["evidence_analysis"] or "No evidence analysis available",
                state.get("intelligence_report") or "No intelligence report available",
                state["suspect_names"],
            )),
            HumanMessage(content="Analyze all the evidence and identify the culprit. Provide a detailed conclusion."),
        ])

        conclusion = response.content
        print("✅ Investigation complete")

        return {
            "final_conclusion": conclusion,
            "messages": state["messages"] + [{"role": "assistant", "content": conclusion}],
        }
    except Exception as e:
        error_msg = f"Error during final analysis: {e}"
        print(f"❌ {error_msg}")
        return {
            "final_conclusion": error_msg,
            "messages": state["messages"] + [{"role": "assistant", "content": error_msg}],
        }


def build_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("appraiser", appraiser_node)
    workflow.add_node("evidence_analyst", evidence_analyst_node)
    workflow.add_node("intelligence_researcher", intelligence_researcher_node)
    workflow.add_node("lead_detective", lead_detective_node)
    workflow.add_edge(START, "appraiser")
    workflow.add_edge("appraiser", "evidence_analyst")
    workflow.add_edge("evidence_analyst", "intelligence_researcher")
    workflow.add_edge("intelligence_researcher", "lead_detective")
    workflow.add_edge("lead_detective", END)

    return workflow.compile()


investigator_graph = build_graph()
