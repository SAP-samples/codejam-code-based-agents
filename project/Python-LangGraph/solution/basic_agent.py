from pathlib import Path
from typing import TypedDict, Optional
from dotenv import load_dotenv
from langchain_litellm import ChatLiteLLM
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from gen_ai_hub.proxy.native.sap.client import RPTClient
import json

from payload import payload

# Load .env from the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Initialize RPT-1 client after loading environment variables
rpt1_client = RPTClient()


class AgentState(TypedDict):
    appraisal_result: Optional[str]
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


# Initialize the LLM via LiteLLM pointing to SAP Generative AI Hub
model = ChatLiteLLM(model="sap/gemini-2.5-flash-lite", temperature=0)

system_prompt = """You are an experienced Stolen Goods Loss Appraiser specializing in fine art and valuables.
Your goal is to assess the value of stolen items and provide a professional insurance appraisal report.
You receive predictions from RPT-1 and turn them into a clear appraisal summary — you never guess values yourself."""


def appraiser_node(state: AgentState) -> dict:
    print("\n🔍 Appraiser Agent starting...")

    rpt1_result = call_rpt1(payload)

    response = model.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Here are the RPT-1 predictions for the stolen items. Write a professional appraisal summary:\n\n{rpt1_result}"),
    ])

    appraisal_result = response.content
    print("✅ Appraisal complete")

    return {
        "appraisal_result": appraisal_result,
        "messages": state["messages"] + [{"role": "assistant", "content": appraisal_result}],
    }


def build_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("appraiser", appraiser_node)
    workflow.add_edge(START, "appraiser")
    workflow.add_edge("appraiser", END)

    return workflow.compile()


def main():
    app = build_graph()

    result = app.invoke({
        "appraisal_result": None,
        "messages": [],
    })

    print("\n" + "="*50)
    print("Insurance Appraiser Report:")
    print("="*50)
    print(result["appraisal_result"])


if __name__ == "__main__":
    main()
