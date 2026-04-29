import os
from pathlib import Path
from dotenv import load_dotenv
from crewai import Agent, Task, Crew

# Load .env from the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Create a Loss Appraiser Agent
appraiser_agent = Agent(
    role="Stolen Goods Loss Appraiser",
    goal="Assess the value of stolen items and provide a professional insurance appraisal report.",
    backstory="You are an experienced insurance appraiser specializing in fine art and valuables. You provide detailed assessments based on your expertise.",
    llm="sap/gpt-4o",  # provider/llm - Using one of the models from SAP's model library in Generative AI Hub
    verbose=True
)

# Create a task for the appraiser
appraise_loss_task = Task(
    description="Provide a brief explanation of how an insurance appraiser would approach assessing stolen artwork and valuables.",
    expected_output="A professional explanation of the appraisal process.",
    agent=appraiser_agent
)

# Create a crew with the appraiser agent
crew = Crew(
    agents=[appraiser_agent],
    tasks=[appraise_loss_task],
    verbose=True
)

# Execute the crew
def main():
    result = crew.kickoff()
    print("\n" + "="*50)
    print("Insurance Appraiser Report:")
    print("="*50)
    print(result)

if __name__ == "__main__":
    main()