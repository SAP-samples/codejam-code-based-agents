# Use your AI Agents to solve the crime

The only thing missing now is your **Lead Detective Agent**. This agent will synthesize information from all three specialized agents to solve the crime and determine the value of the stolen items.

You now have complete intelligence gathering capabilities:
- 📊 **Financial predictions** from the Appraiser (RPT-1)
- 📄 **Internal evidence** from the Evidence Analyst (Grounding Service)
- 🌐 **External intelligence** from the Intelligence Researcher (Web Search)

The Lead Detective will combine all three sources for a comprehensive conclusion.

## Build Your Lead Detective Agent

### Step 1: Add the Agent Configuration

👉 Navigate to [`/project/Python/starter-project/config/agents.yaml`](/project/Python/starter-project/config/agents.yaml)

👉 Add the configuration for the **Lead Detective Agent** below your other agent.

```yaml
lead_detective_agent:
  role: >
    Lead Detective Agent
  goal: >
    Solve the crime by determining which of the three suspects stole the painting.
  backstory: >
    You are a lead detective, solving burglaries.
  llm: sap/gpt-4o
```

### Step 2: Add Tasks for your Agent

👉 Navigate to [`/project/Python/starter-project/config/tasks.yaml`](/project/Python/starter-project/config/tasks.yaml)

👉 Add the configuration for the **solve crime** for your new **Lead Detective Agent**.

```yaml
solve_crime:
  description: >
    Find the thief among the suspects by reviewing:
    1. The insurance appraisal values from the appraiser agent
    2. The internal evidence analysis from the evidence analyst agent
    3. The web intelligence report from the intelligence researcher agent
    
    Synthesize all three sources to identify the culprit with high confidence.
    Consider both internal evidence and external patterns/connections found online.
  expected_output: >
    The name of the thief and the total value of the stolen goods for the insurance.
  agent: lead_detective_agent
```

### Step 3: Add the Agent and Task to the Crew

Now you'll add the Lead Detective Agent and its task to your investigator crew. This agent will coordinate the investigation by using results from the other agents.

👉 Open [`/project/Python/starter-project/investigator_crew.py`](/project/Python/starter-project/investigator_crew.py)

👉 **Inside the `InvestigatorCrew` class**, add the new agent and task methods **after** the existing `research_criminal_network` method and **before** the `@crew` method:

```python
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
            context=[self.appraise_loss_task(), self.analyze_evidence_task(), self.research_criminal_network()]  # Lead detective uses all three sources
        )
```

> 💡 **Where to place this code**: Add these methods inside the `InvestigatorCrew` class, after your `research_criminal_network()` method. The final order should be:
>
> 1. `appraiser_agent()` method
> 2. `appraise_loss_task()` method
> 3. `evidence_analyst_agent()` method
> 4. `analyze_evidence_task()` method
> 5. `intelligence_researcher_agent()` method (from Exercise 06)
> 6. `research_criminal_network()` method (from Exercise 06)
> 7. **👈 Add `lead_detective_agent()` here**
> 8. **👈 Add `solve_crime()` here**
> 9. `crew()` method (keep at the end)

> 💡 **Understanding the `context` parameter:**
>
> - `context=[self.appraise_loss_task(), self.analyze_evidence_task(), self.research_criminal_network()]` tells CrewAI that the `solve_crime` task depends on all three prior tasks
> - The Lead Detective receives output from the Appraiser, Evidence Analyst, AND Intelligence Researcher
> - This enables comprehensive analysis using financial data, internal evidence, and web intelligence

### Step 4: Verify Crew Configuration

Your crew configuration should already be set from Exercise 04, but let's verify it's correct.

👉 In [`/project/Python/starter-project/investigator_crew.py`](/project/Python/starter-project/investigator_crew.py), check that your `@crew` method looks like this:

```python
    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,  # Automatically collected by @agent decorator (all 4 agents)
            tasks=self.tasks,    # Automatically collected by @task decorator (all 4 tasks)
            process=Process.sequential,  # Tasks run in order: appraise → analyze → research → solve
            verbose=True  # Print detailed execution logs
        )
```

> ✅ **If this is already in your file, you're good!** CrewAI will automatically collect all decorated agents and tasks.

### Step 5: Verify main.py (No Changes Needed)

Your `main.py` from Exercise 04 should already be correct. It doesn't need any changes for Exercise 07!

> 💡 **What's happening:** The same `main.py` that ran 2 agents in Exercise 04 will now automatically run all 4 agents (Appraiser, Evidence Analyst, Intelligence Researcher, and Lead Detective). CrewAI collects all `@agent` and `@task` decorated methods automatically.

👉 (Optional) Double-check your [`/project/Python/starter-project/main.py`](/project/Python/starter-project/main.py) has both required inputs:

```python
result = InvestigatorCrew().crew().kickoff(inputs={
    'payload': payload,
    'suspect_names': "Sophie Dubois, Marcus Chen, Viktor Petrov"
})
```

✅ If you see these two inputs, you're all set—no changes needed!

---

## Solve the Crime

👉 Run your crew to start the investigation!

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

> ⏱️ **This may take 3-6 minutes** as your agents:
>
> 1. Search evidence documents for each suspect (Evidence Analyst)
> 2. Predict values of stolen items using RPT-1 (Appraiser)
> 3. Search the web for criminal patterns (Intelligence Researcher)
> 4. Synthesize all findings and identify the culprit (Lead Detective)

👉 Review the final output—who does your Lead Detective identify as the thief?

👉 Call for the instructor and share your suspect.

### If Your Answer is Incorrect

If your Lead Detective identifies the wrong suspect, you'll need to refine your agent prompts to improve their reasoning.

**Which prompts to adjust:**

1. **Lead Detective's Goal** ([`config/agents.yaml`](/project/Python/starter-project/config/agents.yaml))
   - Make it more specific about what evidence to prioritize
   - Example: Add "Focus on alibis, financial motives, and access to the museum"

2. **Lead Detective's Task Description** ([`config/tasks.yaml`](/project/Python/starter-project/config/tasks.yaml))
   - Add explicit steps for analysis
   - Example: "Compare each suspect's alibi against security logs. Identify who had opportunity, means, and motive."

3. **Evidence Analyst's Task** ([`config/tasks.yaml`](/project/Python/starter-project/config/tasks.yaml))
   - Ensure it searches thoroughly for each suspect
   - Example: "For each suspect, search for: alibi verification, financial records, access logs, and connections"

**Tips for improving prompts:**

- ✅ Be specific about what to analyze (alibi, motive, opportunity)
- ✅ Ask agents to cite specific documents
- ✅ Request cross-referencing of information
- ✅ Instruct agents to explain their reasoning step-by-step
- ❌ Avoid vague instructions like "solve the crime" without guidance
- ❌ Don't assume agents know which evidence is most important

👉 After updating prompts in the YAML files, run the crew again:

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

👉 Verify the answer with the instructor

---

## Understanding Multi-Agent Orchestration

### What Just Happened?

You created a complete multi-agent system where:

1. **The Lead Detective Agent** orchestrates the investigation by synthesizing multiple sources
2. **The Evidence Analyst Agent** retrieves and analyzes evidence from internal documents
3. **The Intelligence Researcher Agent** gathers external intelligence via web search
4. **The Loss Appraiser Agent** predicts financial values of stolen items
5. **Agent Communication** flows through task delegation and result aggregation
6. **Multi-Source Reasoning** combines internal evidence, web intelligence, and financial data to solve the crime

### The Investigation Flow

```mermaid
flowchart TD
    A[Lead Detective] --> B[Evidence Analysis]
    B --> C[Grounding Search]
    C --> D[Suspect Investigation]
    A --> E[Loss Appraisal]
    E --> F[RPT-1 Predictions]
    F --> G[Value Determination]
    A --> H[Web Intelligence]
    H --> I[Sonar-Pro Search]
    I --> J[Pattern Analysis]
    D --> K[Crime Resolution]
    G --> K
    J --> K
    K --> L[Suspect Identification]
    L --> M[Final Report]
```

### Why This Matters

Multi-agent systems are powerful because they:

- **Distribute Responsibilities** across specialized agents with distinct roles
- **Enable Collaboration** through task delegation and information sharing
- **Improve Reasoning** by combining multiple expert perspectives
- **Handle Complexity** by breaking down large problems into manageable subtasks
- **Scale Efficiently** as new agents and tools can be added without disrupting existing ones

---

## Key Takeaways

- **Multi-Agent Systems** decompose complex problems into specialized, collaborative agents
- **Sequential Processing** allows agents to work in order, with later agents using earlier results
- **Task Delegation** allows agents to coordinate work and share results through the CrewAI framework
- **Tool Integration** across multiple agents (RPT-1, Grounding Service) provides comprehensive capabilities
- **Agent Prompts** must be carefully crafted to guide reasoning and ensure correct tool usage
- **Crew Orchestration** handles sequencing, communication, and result aggregation between agents
- **Iterative Refinement** of agent prompts and task descriptions improves investigation accuracy

---

## Next Steps

In the following exercises, you will:

1. ✅ Build a basic agent
2. ✅ Add custom tools to your agents so they can access external data
3. ✅ Create a complete crew with multiple agents working together
4. ✅ Integrate the Grounding Service for better reasoning and fact-checking
5. ✅ Add web search for external intelligence gathering
6. ✅ Solve the museum art theft mystery using your fully-featured agent team (this exercise)

Congratulations on completing the CodeJam! You've successfully built a sophisticated multi-agent AI system that can:

- Analyze evidence from internal documents
- Search the web for external intelligence
- Predict financial values using the SAP-RPT-1 model
- Coordinate between multiple specialized agents
- Solve complex real-world problems through collaborative reasoning with multi-source intelligence

---

## Troubleshooting

**Issue**: `AttributeError: 'NoneType' object has no attribute 'get'` when running main.py

- **Solution**: This error occurs when YAML configuration has incorrect indentation. Check your `config/tasks.yaml` file and ensure all fields (`description`, `expected_output`, `agent`) are indented with **2 spaces** under each task name:

```yaml
solve_crime:
  description: > # ← Must be indented 2 spaces
    Your task description
  expected_output: > # ← Must be indented 2 spaces
    Expected output
  agent: lead_detective_agent # ← Must be indented 2 spaces
```

**Issue**: Agent is not using the Grounding Service tool

- **Solution**: Ensure the Evidence Analyst Agent has `tools=[call_grounding_service]` in its definition and the task description explicitly mentions searching for evidence

**Issue**: Lead Detective Agent doesn't delegate to other agents

- **Solution**: Verify that:
  - All agents are included in the crew: `agents=[appraiser_agent, evidence_analyst_agent, lead_detective_agent]`
  - Tasks are assigned to the correct agents
  - Task descriptions clearly indicate which agents should be consulted

**Issue**: RPT-1 tool is not returning predictions

- **Solution**: Ensure:
  - The Loss Appraiser Agent has `tools=[call_rpt1]` assigned
  - Your `.env` file contains valid RPT-1 deployment URL and credentials
  - The payload structure matches the RPT-1 API specification

**Issue**: Grounding search returns no relevant documents

- **Solution**: Check that:
  - The pipeline ID is correct
  - Documents are properly indexed in SAP AI Launchpad
  - Your search query is descriptive and targets the right evidence type
  - The `maxChunkCount` parameter is appropriate

**Issue**: Agents not executing in order or parallel execution

- **Solution**: Ensure you've set `process=Process.sequential` in your `@crew` method. Use `Process.hierarchical` if you need a manager agent to coordinate.

**Issue**: Agent is hallucinating or not finding the correct suspect

- **Solution**: Refine your Lead Detective Agent's prompt to:
  - Be more specific about what evidence to look for
  - Include explicit instructions to cross-reference alibis and motives
  - Ask the agent to provide reasoning before concluding
  - Consider adjusting the task description to guide the investigation more clearly

**Issue**: CrewAI raises errors about task assignment or agent delegation

- **Solution**: Verify that:
  - All task configurations in `tasks.yaml` match task method names
  - All agent configurations in `agents.yaml` match agent method names
  - Tasks are assigned to agents using the `agent` field in the YAML
  - The crew includes all agents in the correct order

---

## Resources

- [CrewAI Multi-Agent Documentation](https://docs.crewai.com/)
