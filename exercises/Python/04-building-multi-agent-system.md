# Building A Multi-Agent System

## Structure The Agent Code

Now, that you know how to build a simple AI agent with LiteLLM, CrewAI and Generative AI Hub, let's work on making the code prettier and easier to understand. CrewAI recommends to keep the AI agent definition in a separate YAML file.

> "Using YAML configuration provides a cleaner, more maintainable way to define agents. We strongly recommend using this approach in your CrewAI projects." - CrewAI

👉 Create a new folder `/project/Python/starter-project/config`.

👉 Create a new file [`/project/Python/starter-project/config/agents.yaml`](/project/Python/starter-project/config/agents.yaml)

👉 Create a new file [`/project/Python/starter-project/config/tasks.yaml`](/project/Python/starter-project/config/tasks.yaml)

👉 Create another new file in the starter project root [`/project/Python/starter-project/investigator_crew.py`](/project/Python/starter-project/investigator_crew.py)

### Move Configurations to YAML Files

Instead of defining agents and tasks directly in Python code, we'll move them to YAML configuration files. This makes the code cleaner and easier to maintain.

#### Configure the Agent

👉 Open [`/project/Python/starter-project/config/agents.yaml`](/project/Python/starter-project/config/agents.yaml) and add:

```yaml
# agents.yaml
appraiser_agent:
  role: >
    Loss Appraiser
  goal: >
    Predict the missing values of stolen items using the RPT-1 model via the call_rpt1 tool.
    Use the payload data from inputs: {payload}
  backstory: >
    You are an expert insurance appraiser specializing in fine art valuation and theft assessment.
  llm: sap/gpt-4o
```

> 💡 **What's happening here?** We're taking the agent definition from your `basic_agent.py` file (the `role`, `goal`, `backstory`, and `llm` parameters) and moving them to this YAML file. The `>` symbol in YAML allows multi-line text.

#### Configure the Task

👉 Open [`/project/Python/starter-project/config/tasks.yaml`](/project/Python/starter-project/config/tasks.yaml) and add:

```yaml
# tasks.yaml
appraise_loss_task:
  description: >
    Analyze the theft crime scene and predict the missing values of stolen items using the RPT-1 model via the call_rpt1 tool.
    Use the payload data provided in the inputs: {payload}
  expected_output: >
    JSON with predicted values for the stolen items.
  agent: appraiser_agent
```

> 💡 **Note**: The `agent` field references the agent key from `agents.yaml` (in this case, `appraiser_agent`).

#### Clean Up basic_agent.py

Now that we've moved the agent and task definitions to YAML files, we'll be moving all the remaining code to a new file structure.

> 💡 **What's happening?** In the next steps, you'll create `investigator_crew.py` which will contain all the code currently in `basic_agent.py` (imports, environment loading, RPTClient initialization, and the @tool function) plus the new crew structure. Once that's done, `basic_agent.py` will no longer be needed.

### Move Code to investigator_crew.py File

Now we will move the crew to their own file as well. It will make the code more readable and easier to maintain, especially with multiple agents working together.

👉 Navigate to [`/project/Python/starter-project/investigator_crew.py`](/project/Python/starter-project/investigator_crew.py).

👉 Paste the code snippets below step by step.

#### Step 1: Import All Necessary Packages

```python
from crewai import Agent, Crew, Task, Process
from crewai.project import CrewBase, agent, task, crew
from crewai.tools import tool
from dotenv import load_dotenv
from gen_ai_hub.proxy.native.sap.client import RPTClient
```

#### Step 2: Load Environment and Create The SAP-RPT-1 Tool

```python
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Initialize RPT client after loading environment variables
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
            import json
            return json.dumps(response.json(), indent=2)
        else:
            return f"Error {response.status_code}: {response.text}"
    except Exception as e:
        return f"Error calling RPT-1: {str(e)}"

```

👉 **Delete** [`/project/Python/starter-project/basic_agent.py`](/project/Python/starter-project/basic_agent.py) entirely.

> 💡 **Why?** All functionality from `basic_agent.py` has been moved to `investigator_crew.py`. Keeping the old file would cause confusion and potential import conflicts.

#### Step 3: Build The Crew Itself

👉 In [`/project/Python/starter-project/investigator_crew.py`](/project/Python/starter-project/investigator_crew.py) add this code below the tool.

```python
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

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,  # Automatically collected by the @agent decorator
            tasks=self.tasks,    # Automatically collected by the @task decorator.
            process=Process.sequential,
            verbose=True,
        )
```

> 💡 **Understanding the code**:
>
> **The @CrewBase Decorator**:
>
> - Tells CrewAI this class defines a crew structure
> - Enables automatic discovery of agents and tasks via decorators
> - Loads YAML configurations from the paths you specify
>
> **Configuration Loading**:
>
> - `agents_config = "config/agents.yaml"` - Loads all agent definitions from the YAML file
> - `tasks_config = 'config/tasks.yaml'` - Loads all task definitions from the YAML file
> - These become dictionaries accessible via `self.agents_config['key']` and `self.tasks_config['key']`
>
> **The @agent Decorator**:
>
> - Each method decorated with `@agent` defines one agent
> - `config=self.agents_config['appraiser_agent']` pulls the `role`, `goal`, `backstory`, and `llm` from your YAML
> - `tools=[call_rpt1]` gives this agent access to the RPT-1 tool
> - All decorated agents are automatically collected into `self.agents`
>
> **The @task Decorator**:
>
> - Each method decorated with `@task` defines one task
> - `config=self.tasks_config['appraise_loss_task']` pulls the `description`, `expected_output`, and `agent` from your YAML
> - All decorated tasks are automatically collected into `self.tasks`
>
> **The @crew Decorator**:
>
> - Assembles everything into a crew
> - `agents=self.agents` uses all agents you defined with `@agent`
> - `tasks=self.tasks` uses all tasks you defined with `@task`
> - `process=Process.sequential` means tasks run one after another in order
> - `verbose=True` prints detailed execution logs
>
> ⚠️ **Important**: The keys in your YAML files (`appraiser_agent`, `appraise_loss_task`) must match exactly what you reference in the code.

### Step 4: Run The Crew From main.py

👉 Create a new file [`/project/Python/starter-project/main.py`](/project/Python/starter-project/main.py).

> This file will contain the main entry point for your agent orchestration application.

```python
from investigator_crew import InvestigatorCrew
from payload import payload

def main():
    result = InvestigatorCrew().crew().kickoff(inputs={
        'payload': payload,
        'suspect_names': "Sophie Dubois, Marcus Chen, Viktor Petrov"
    })
    print("\n📘 Result:\n", result)


if __name__ == "__main__":
    main()
```

> 💡 **Note**: We're importing the `payload` from the `payload.py` file you created in Exercise 03. The `suspect_names` input is required by the evidence analyst agent's goal, which uses it as a template variable `{suspect_names}`.

## Adding More Agents To The Crew

### Step 1: Adding a New Agent

We also have a lot of evidence in our evidence database. You can check the documents that are part of the evidence [here](/exercises/data/documents).

To analyze the evidence and find all the information on our three suspects:

- Sophie Dubois (the night manager who was on duty)
- Marcus Chen (the security technician who was recently fired)
- Viktor Petrov (a shadowy figure whose name has surfaced in connection with the crime)

You will now build an **Criminal Evidence Analyst**. This new agent will try to find any inconsistencies in the alibis and motives of the suspects.

👉 Navigate to [`/project/Python/starter-project/config/agents.yaml`](/project/Python/starter-project/config/agents.yaml)

👉 Add the configuration for the **Criminal Evidence Analyst** below your other agent.

```yaml
evidence_analyst_agent:
  role: >
    Criminal Evidence Analyst
  goal: >
    Retrieve and analyze evidence ONLY via the call_grounding_service tool. 
    Search for each suspect by name: {suspect_names}. Do NOT fabricate any evidence or alibis. 
    Report only what the tool returns.
  backstory: >
    You are a methodical evidence analyst who bases conclusions strictly on retrieved documents. You never assume facts.
  llm: sap/anthropic--claude-4.5-opus
```

## Step 2: Add The Task For Your New Agent

👉 Navigate to [`/project/Python/starter-project/config/tasks.yaml`](/project/Python/starter-project/config/tasks.yaml)

👉 Add the configuration for the **analyze evidence task** for your new **Evidence Analyst Agent**.

```yaml
analyze_evidence_task:
  description: >
    Analyze the evidence of the theft that you can access via the grounding tool.
    Provide any insights that can help in the investigation especially regarding alibis. 
    Check the evidence iteratively for all three suspect names and provide an analysis for each of them.
  expected_output: >
    A detailed analysis of the evidence for each suspect, including any insights that can help in the investigation.
  agent: evidence_analyst_agent
```

### Step 3: Add The New Agent To The Crew

👉 Navigate to [`/project/Python/starter-project/investigator_crew.py`](/project/Python/starter-project/investigator_crew.py)

👉 **Inside the `InvestigatorCrew` class**, add the new agent and task methods **after** the existing `appraise_loss_task` method and **before** the `@crew` method:

```python
    @agent
    def evidence_analyst_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['evidence_analyst_agent'],
            verbose=True,
            tools=[call_rpt1]
        )

    @task
    def analyze_evidence_task(self) -> Task:
        return Task(
            config=self.tasks_config['analyze_evidence_task']
        )
```

> 💡 **Where to place this code**: Add these methods inside the `InvestigatorCrew` class, after your `appraise_loss_task()` method. The order should be:
>
> 1. `appraiser_agent()` method
> 2. `appraise_loss_task()` method
> 3. **👈 Add new `evidence_analyst_agent()` here**
> 4. **👈 Add new `analyze_evidence_task()` here**
> 5. `crew()` method (keep at the end)

👉 Run your crew to test it.

**From repository root:**

```bash
# macOS / Linux
python3 ./project/Python/starter-project/main.py
```

```powershell
# Windows (PowerShell)
python .\project\Python\starter-project\main.py
```

```cmd
# Windows (Command Prompt)
python .\project\Python\starter-project\main.py
```

**From starter-project folder:**

```bash
# macOS / Linux
python3 main.py
```

```powershell
# Windows (PowerShell)
python main.py
```

```cmd
# Windows (Command Prompt)
python main.py
```

> 💡 **Note:** The Evidence Analyst currently uses `call_rpt1` as a placeholder tool to make the code functional. This isn't the right tool for evidence analysis. You'll replace it with the `call_grounding_service` tool in Exercise 05 to give the agent proper access to evidence documents.

---

## Understanding Multi-Agent Systems

### What Just Happened?

You've transformed your single-agent system into a **multi-agent crew** with specialized roles working together. Here's the complete architecture you built:

**1. Configuration-Driven Design**

- Moved agent definitions to `agents.yaml` - separating "what" agents do from "how" they do it
- Moved task definitions to `tasks.yaml` - defining clear responsibilities and expected outcomes
- This YAML-first approach makes agents easy to modify without touching Python code

**2. Specialized Agent Roles**
You now have two agents working in parallel domains:

- **Loss Appraiser Agent** - Expert in art valuation, uses the RPT-1 tool to predict insurance values
- **Criminal Evidence Analyst** - Methodical investigator, searches evidence for suspect information

**3. Task Orchestration**

- **appraise_loss_task** - Analyzes stolen items and predicts missing values
- **analyze_evidence_task** - Investigates suspects' alibis and motives
- Tasks are linked to agents via YAML configuration, creating clear accountability

**4. Sequential Processing**
With `Process.sequential`, CrewAI executes tasks in order:

1. Appraiser runs first, calculating financial losses
2. Evidence analyst runs second, examining suspects
3. Each agent can build on previous results (though not implemented yet)

### How Multi-Agent Execution Works

When you run `InvestigatorCrew().crew().kickoff(inputs={...})`:

1. **Initialization**: CrewAI loads `agents.yaml` and `tasks.yaml`, creating agent and task objects
2. **Input Interpolation**: Template variables like `{suspect_names}` and `{payload}` are replaced with actual values
3. **Task Assignment**: Each task is matched to its assigned agent
4. **Sequential Execution**:
   - Loss Appraiser receives the payload and calls the RPT-1 tool
   - Evidence Analyst receives suspect names (but lacks the grounding tool - Exercise 05!)
5. **Result Aggregation**: All task outputs are combined into the final result

### Why This Architecture Matters

**Benefits of Multi-Agent Systems:**

- **Specialization** - Each agent is an expert in one domain (valuation vs. investigation)
  - Different LLMs can be assigned (GPT-4 for appraiser, Claude for analyst)
  - Each agent has only the tools it needs (principle of least privilege)

- **Scalability** - Adding new agents is straightforward
  - Create new YAML entries for agent + task
  - Add `@agent` and `@task` methods to the crew
  - No need to modify existing agents

- **Collaboration** - Agents can build upon each other's work
  - Sequential processing allows later agents to use earlier results
  - `context` parameter (coming in Exercise 07) enables explicit data sharing

- **Maintainability** - Clear separation of concerns
  - Business logic (goals, roles) lives in YAML
  - Tool integration lives in Python
  - Orchestration logic lives in the crew class

**Real-World Applications:**

- Customer service: Routing agent → Specialist agents → Escalation agent
- Research: Data collection agent → Analysis agent → Report generation agent
- DevOps: Monitoring agent → Diagnosis agent → Remediation agent

### The Role of Tools

Notice each agent has different tools:

- **Loss Appraiser** uses `call_rpt1` - a structured prediction model
- **Evidence Analyst** uses `call_rpt1` (temporarily) but needs `call_grounding_service` (Exercise 05)

This demonstrates **tool specialization**: agents only get tools relevant to their role.

---

## Key Takeaways

- **YAML Configuration** separates agent definitions from implementation, making systems easier to maintain and modify
- **Decorators** (`@agent`, `@task`, `@crew`) provide a clean, Pythonic way to define multi-agent systems
- **Agent Specialization** with different roles, tools, and LLMs creates more robust and accurate systems
- **Sequential Processing** orchestrates agents in a specific order, allowing later agents to build on earlier results
- **Input Variables** like `{payload}` and `{suspect_names}` make agents reusable with different data
- **Separation of Concerns** keeps configuration (YAML), tools (Python functions), and orchestration (crew class) separate

**What's Next?**
Your Evidence Analyst can't access actual evidence yet—it's using the wrong tool! In Exercise 05, you'll integrate the **Grounding Service** to give it real document access, completing the investigation system.

---

## Next Steps

In the following exercises, you will:

1. ✅ [Set up your development space](01-setup-dev-space.md)
2. ✅ [Build a basic agent](02-build-a-basic-agent.md)
3. ✅ [Add custom tools](03-add-your-first-tool.md) (RPT-1 model integration)
4. ✅ [Build a multi-agent system](04-building-multi-agent-system.md) (this exercise)
5. 📌 [Add the Grounding Service](05-add-the-grounding-service.md) - Give your Evidence Analyst access to real documents
6. 📌 [Discover Connected Crimes](06-discover-connected-crimes.md) - Add web search with Perplexity sonar-pro
7. 📌 [Solve the crime](07-solve-the-crime.md) - Add a Lead Detective Agent to combine findings and crack the case

---

## Troubleshooting

**Issue**: `YAML configuration not found` or file path errors

- **Solution**: Ensure you've created all YAML files in `/project/Python/starter-project/config/` directory and verify the file paths in your Python code match exactly.

**Issue**: `Agent not found in configuration` or missing agent reference

- **Solution**: Verify that the agent name in your `agents.yaml` matches the key referenced in the `@agent` method and that the agent is added to the agents list in the crew.

**Issue**: Tool not available to agents

- **Solution**: Verify that you're passing `tools=[call_rpt1]` to each agent that needs access to the tool in the `@agent` method.

**Issue**: `AttributeError: 'InvestigatorCrew' object has no attribute 'crew'`

- **Solution**: This means the `@crew` decorated method is not properly indented inside the `InvestigatorCrew` class. All methods decorated with `@agent`, `@task`, and `@crew` must be indented with 4 spaces inside the class. Clear Python cache with `rm -rf __pycache__` and run again.

**Issue**: `KeyError: "Template variable 'suspect_names' not found in inputs dictionary"`

- **Solution**: The evidence analyst agent's goal uses `{suspect_names}` as a template variable. Make sure you're passing `'suspect_names': "Sophie Dubois, Marcus Chen, Viktor Petrov"` in the `inputs` dictionary when calling `kickoff()` in `main.py`.

---

## Resources

- [CrewAI Project Structure Guide](https://docs.crewai.com/en/guides/agents/crafting-effective-agents)
- [CrewAI YAML Configuration](https://docs.crewai.com/concepts/agents)
- [CrewAI Multi-Agent Examples](https://github.com/joaomdmoura/crewai-examples)
- [SAP Generative AI Hub](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/generative-ai-hub-in-sap-ai-core-7db524ee75e74bf8b50c167951fe34a5)

[Next exercise](05-add-the-grounding-service.md)
