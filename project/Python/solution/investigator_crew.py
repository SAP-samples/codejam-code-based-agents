from crewai import Agent, Crew, Task, Process
from crewai.project import CrewBase, agent, task, crew
from crewai.tools import tool
from gen_ai_hub.proxy.native.sap.client import RPTClient

import json  # For converting response data to JSON format

from gen_ai_hub.document_grounding.client import RetrievalAPIClient  # Client to connect to grounding service
from gen_ai_hub.document_grounding.models.retrieval import (
    RetrievalSearchInput,  # Defines what to search for
    RetrievalSearchFilter,  # Configures how to search (vector DB, max chunks, etc.)
)
from gen_ai_hub.orchestration.models.document_grounding import DataRepositoryType  # Enum for repository types

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Initialize RPT1 client after loading environment variables
rpt1_client = RPTClient()

@tool("call_rpt1")
def call_rpt1(payload: dict) -> str:
    """Call RPT-1 model to predict missing values in the payload.
    
    Args:
        payload: A dictionary containing the stolen items data with prediction placeholders.
                 This should be the exact payload provided in the task inputs.
    
    Returns:
        JSON string with predicted insurance values and item categories.
    """
    try:
        response = rpt1_client.predict(body=payload, model_name="sap-rpt-1-large")
        if response:
            return json.dumps(response.json(), indent=2)
        else:
            return f"Error {response.status_code}: {response.text}"
    except Exception as e:
        return f"Error calling RPT-1: {str(e)}"



@tool("call_grounding_service")
def call_grounding_service(user_question: str) -> str:
    """Function to call the grounding service and retrieve relevant information based on the user's question."""
    retrieval_client = RetrievalAPIClient()

    search_filter = RetrievalSearchFilter(
        id="vector",
        dataRepositoryType=DataRepositoryType.VECTOR.value,
        dataRepositories=["0d3b132a-cbe1-4c75-abe7-adfbbab7e002"],  # 👈 Replace with your pipeline ID from SAP AI Launchpad
        searchConfiguration={
            "maxChunkCount": 5  # Retrieve top 5 most relevant document chunks
        },
    )

    search_input = RetrievalSearchInput(
        query=user_question,  # The agent's question
        filters=[search_filter],  # Apply the vector search filter
    )

    response = retrieval_client.search(search_input)  # Execute the search

    response_dict = json.dumps(response.model_dump(), indent=2)  # Convert to JSON string
    return response_dict  # Return retrieved document chunks to the agent
    
@CrewBase
class InvestigatorCrew():
    """InvestigatorCrew crew"""

    agents_config = "config/agents.yaml"
    tasks_config = 'config/tasks.yaml'

    @agent
    def appraiser_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['appraiser_agent'],
            verbose=True,
            tools=[call_rpt1]
        )

    @task
    def appraise_loss_task(self) -> Task:
        return Task(
            config=self.tasks_config['appraise_loss_task']
        )
    
    @agent
    def evidence_analyst_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['evidence_analyst_agent'],
            verbose=True,
            tools=[call_grounding_service]
        )

    @task
    def analyze_evidence_task(self) -> Task:
        return Task(
            config=self.tasks_config['analyze_evidence_task']
        )
    
    @agent
    def lead_detective_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['lead_detective_agent'],
            verbose=True
        )

    @task
    def solve_crime(self) -> Task:
        return Task(
            config=self.tasks_config['solve_crime'],
            context=[self.appraise_loss_task(), self.analyze_evidence_task()]  # 👈 Lead detective uses results from other tasks
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,  # Automatically collected by the @agent decorator
            tasks=self.tasks,    # Automatically collected by the @task decorator.
            process=Process.sequential,
            verbose=True,
        )
