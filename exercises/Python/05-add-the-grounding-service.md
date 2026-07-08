# Add The Grounding Service

## Overview

In this exercise, you will add a grounding service tool to your evidence analyst agent. The grounding service retrieves relevant information from evidence documents to help the agent analyze the crime. You'll learn how to integrate external data sources with your agents using SAP AI Launchpad's grounding management system.

---

## Understand The Grounding Service

### What is Grounding?

**Grounding** (also called **RAG - Retrieval-Augmented Generation**) connects Large Language Models (LLMs) to external, up-to-date data sources, giving them access to facts they weren't trained on. It solves one of AI's biggest problems: **hallucination**.

| **Without Grounding**                      | **With Grounding**                                                  |
| ------------------------------------------ | ------------------------------------------------------------------- |
| ❌ LLM makes up plausible-sounding "facts" | ✅ LLM retrieves real documents first                               |
| ❌ No source citations                     | ✅ Cites specific documents (e.g., "MARCUS_TERMINATION_LETTER.txt") |
| ❌ Can't access recent or private data     | ✅ Accesses your latest documents (evidence, contracts, logs)       |
| ❌ Unreliable for critical decisions       | ✅ Factual, auditable, trustworthy                                  |

**Example in Our Case:**

**Ungrounded Agent (BAD):**

> "Marcus Chen was likely fired due to performance issues common in the tech industry. He probably had financial troubles."  
> _(Pure hallucination - sounds convincing but is made up!)_

**Grounded Agent (GOOD):**

> "According to MARCUS*TERMINATION_LETTER.txt, Marcus Chen was terminated on 2024-01-15 due to 'unauthorized access to secured areas.' BANK_RECORDS.txt shows large cash deposits of €50,000 on 2024-01-20."  
> *(Facts retrieved from actual documents with sources!)\_

### The Problem We're Solving

Your **Evidence Analyst Agent** needs to investigate suspects by examining real evidence:

**Available Evidence Documents:**

- 📄 **BANK_RECORDS.txt** - Financial transactions of all suspects
- 📄 **SECURITY_LOG.txt** - Museum access logs with timestamps
- 📄 **PHONE_RECORDS.txt** - Call history between suspects
- 📄 **MARCUS_TERMINATION_LETTER.txt** - Why Marcus was fired
- 📄 **MARCUS_EXIT_LOG.txt** - Marcus's building access records
- 📄 **SOPHIE_LOAN_DOCUMENTS.txt** - Sophie's financial situation
- 📄 **VIKTOR_CRIMINAL_RECORD.txt** - Viktor's past convictions
- 📄 **STOLEN_ITEMS_INVENTORY.txt** - Details of stolen art

**The Challenge:** These documents exist in a document store, but your agent can't access them yet. Without grounding, the agent would **fabricate** evidence like:

- "Marcus probably needed money"
- "Sophie was likely involved because she works at night"
- "Viktor seems suspicious"

**This is catastrophic for an investigation!** We need facts, not guesses.

### How SAP Grounding Service Works

The SAP Generative AI Hub **Grounding Service** uses RAG (Retrieval-Augmented Generation) in three phases:

#### **Phase 1: Document Preparation (✅ Already Completed)**

Before your agent can search documents, they must be prepared:

1. **Upload Documents** → Evidence files uploaded to SAP Object Store (S3 bucket)
2. **Chunk Documents** → Large documents split into smaller chunks (e.g., 500-word passages)
   - Why? LLMs have context limits; chunks are manageable pieces
   - Example: "MARCUS_TERMINATION_LETTER.txt" (5 pages) → 3 chunks
3. **Create Embeddings** → Each chunk converted to a vector (array of ~1,536 numbers)
   - Why? Computers can't search text semantically; vectors enable "meaning-based" search
   - Example: "unauthorized access" and "broke into secure area" have similar vectors
4. **Store in Vector Database** → Embeddings indexed for lightning-fast similarity search
   - Search millions of chunks in milliseconds

> 💡 **Good news:** This has been done for you! The evidence documents are already processed and stored in a grounding pipeline.

#### **Phase 2: Query Processing (What Your Agent Does)**

When your agent asks a question, here's what happens:

```mermaid
flowchart TD
    A["Agent Question:<br/>What evidence exists about Marcus Chen?"]
    B["1. Convert Query to Vector Embedding<br/>Marcus Chen evidence → [0.23, -0.45, 0.87, ...]"]
    C["2. Search Vector Database<br/>Cosine similarity scores 0.0 – 1.0"]
    D["3. Retrieve Top 5 Most Relevant Chunks<br/>✓ MARCUS_TERMINATION_LETTER.txt (0.92)<br/>✓ SECURITY_LOG.txt (0.88)<br/>✓ BANK_RECORDS.txt (0.85)<br/>✓ MARCUS_EXIT_LOG.txt (0.83)<br/>✓ PHONE_RECORDS.txt (0.79)"]
    E[Return to Agent]

    A --> B --> C --> D --> E
```

> ⚡ **Speed:** Vector search is incredibly fast — searches millions of documents in milliseconds!

#### **Phase 3: Context-Enhanced Response**

```mermaid
flowchart TD
    A["Retrieved Document Chunks<br/>Chunk 1: Marcus Chen was terminated on...<br/>Chunk 2: Security logs show Marcus accessed...<br/>Chunk 3: Bank records indicate deposits of..."]
    B["Pass as Context to LLM"]
    C["LLM Prompt:<br/>Based ONLY on these documents, answer:<br/>What evidence exists about Marcus Chen?<br/>Documents: chunks inserted here"]
    D["LLM generates answer grounded in facts:<br/>According to MARCUS_TERMINATION_LETTER.txt,<br/>Marcus was fired on 2024-01-15 for<br/>unauthorized access. SECURITY_LOG.txt shows<br/>he entered secured areas 3 times after hours..."]
    E["Agent receives factual response"]

    A --> B --> C --> D --> E
```

> 🎯 **Key Insight:** The LLM can **only** use information from the retrieved chunks. It can't make things up which is called hallucination!

### The Grounding Pipeline

SAP AI Core uses **pipelines** to orchestrate the entire grounding workflow. Think of a pipeline as a pre-configured "document search engine" for your agents.

**A Pipeline Contains:**

| Component                | Purpose                        | Example                                  |
| ------------------------ | ------------------------------ | ---------------------------------------- |
| **Data Repository**      | Where documents are stored     | S3 bucket: `evidence-documents`          |
| **Embedding Model**      | Converts text to vectors       | `text-embedding-ada-002` (OpenAI)        |
| **Vector Database**      | Stores and searches embeddings | SAP Vector Engine                        |
| **Search Configuration** | Search parameters              | `maxChunkCount: 5` (return top 5 chunks) |
| **Pipeline ID**          | Unique identifier              | `0d3b132a-cbe1-4c75-abe7-adfbbab7e002`   |

**For This Exercise:**

- ✅ A pipeline is **already created** with all 8 evidence documents
- ✅ Documents are **already embedded** and indexed
- ✅ All you need to do is **connect your agent** using the Pipeline ID

> 💡 **Why Pre-Configured?** Document processing and embedding creation can take time and cost money. We've done this setup for you so you can focus on building agents!

### Why This Matters for Your Investigation

With the grounding service, your Evidence Analyst transforms from guessing to investigating:

| Capability                       | Impact                                                    |
| -------------------------------- | --------------------------------------------------------- |
| ✅ **Search Actual Evidence**    | No more made-up "facts"—only real documents               |
| ✅ **Find Suspects' Details**    | Alibis, motives, timelines, connections backed by sources |
| ✅ **Cite Specific Sources**     | "According to BANK_RECORDS.txt..." builds trust           |
| ✅ **Avoid Hallucination**       | LLM can't invent information—only uses retrieved chunks   |
| ✅ **Make Informed Conclusions** | Decisions based on facts, not patterns from training data |
| ✅ **Audit Trail**               | Every answer traceable to source documents (compliance!)  |

**Before Grounding:**

- Agent: "I think Marcus might be involved because..."
- Reliability: ~30% (pure guesswork)

**After Grounding:**

- Agent: "SECURITY_LOG.txt shows Marcus accessed gallery 2C at 23:47 on the night of the theft..."
- Reliability: ~95% (fact-based, verifiable)

### RAG vs. Fine-Tuning: Why Grounding is Better

You might wonder: "Why not just fine-tune the LLM on our evidence documents?"

| Fine-Tuning                                 | Grounding (RAG)                      |
| ------------------------------------------- | ------------------------------------ |
| ❌ Expensive ($1000s per training run)      | ✅ Cost-effective (pay per search)   |
| ❌ Weeks to retrain when documents update   | ✅ Instant—just add/update documents |
| ❌ Black box—can't trace answers to sources | ✅ Full transparency with citations  |
| ❌ Model "memorizes" data (privacy risk)    | ✅ Documents stay separate (secure)  |
| ❌ Requires ML expertise                    | ✅ Simple API calls                  |

> 🎯 **Best Practice:** Use grounding for knowledge that changes (evidence, documents, data). Use fine-tuning for behavior/style (e.g., "always be polite").

Let's integrate this power into your agent!

---

### Access The Grounding Pipeline in SAP AI Launchpad

Now that you understand grounding, let's connect to the pre-configured pipeline with your evidence documents.

👉 Open [SAP AI Launchpad](https://genai-codejam-luyq1wkg.ai-launchpad.prod.eu-central-1.aws.ai-prod.cloud.sap/aic/index.html#/workspaces&/a/detail/TwoColumnsMidExpanded/?workspace=codejam&resourceGroup=ai-agents-codejam)

#### Select The Resource Group

SAP AI Core tenants use [resource groups](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/resource-groups) to isolate AI resources and workloads. Scenarios (e.g. `foundation-models`) and executables (a template for training a model or creation of a deployment) are shared across all resource groups within the instance.

> DO NOT USE THE DEFAULT `default` RESOURCE GROUP!

👉 Go to **Workspaces**.

👉 Select your workspace `codejam` and your resource group `ai-agents-codejam`.

👉 Make sure it is set as a context. The proper name of the context, like `codejam-aicore-connection (ai-agents-codejam)` should show up at the top next to SAP AI Launchpad.

#### Explore the Grounding Pipeline

👉 Go to the `Generative AI Hub > Grounding Management` tab

👉 Open the existing pipeline by clicking on it

Here you'll see:

- **Pipeline Name** - Identifies this grounding configuration
- **Pipeline ID** - The unique identifier you'll use in code (☝️ **Copy this!**)
- **Data Repository** - The S3 bucket containing evidence documents
- **Embedding Model** - The AI model converting text to vectors
- **Configuration** - Search parameters like chunk size and retrieval count

👉 (Optional) Click the `Run Search` button to test the pipeline

- Try searching for: "Marcus Chen" or "Sophie Dubois"
- See which document chunks are retrieved
- This is exactly what your agent will do!

☝️ **Important**: Copy the **Pipeline ID** - you'll need it in the next step to connect your agent to this grounding service.

---

## Add The Grounding Service To Your Agent Crew

### Step 1: Build The Grounding Tool

Now you'll create a tool that connects your Evidence Analyst agent to the grounding pipeline. This tool will:

1. Take a question from the agent (e.g., "What evidence exists about Marcus Chen?")
2. Convert it to a vector embedding and search the document database
3. Retrieve the top 5 most relevant document chunks
4. Return the chunks to the agent as context

👉 Open [`/project/Python/starter-project/investigator_crew.py`](/project/Python/starter-project/investigator_crew.py)

👉 Add this tool **after** the `call_rpt1` tool definition (around line 25):

```python
@tool("call_grounding_service")
def call_grounding_service(user_question: str) -> str:
    """Function to call the grounding service and retrieve relevant information based on the user's question."""
    retrieval_client = RetrievalAPIClient()

    search_filter = RetrievalSearchFilter(
        id="vector",
        dataRepositoryType=DataRepositoryType.VECTOR.value,
        dataRepositories=["YOUR_PIPELINE_ID_HERE"],  # 👈 Replace with your pipeline ID from SAP AI Launchpad
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
```

> 💡 **Understanding the Grounding Tool Flow:**
>
> **1. Client Initialization**
>
> - `RetrievalAPIClient()` - Creates a connection to SAP's grounding service API
> - Automatically uses credentials from your `.env` file (AI Core URL, client ID, secret)
>
> **2. Search Configuration**
>
> - `RetrievalSearchFilter` - Defines how to search:
>   - `id="vector"` - Uses vector similarity search (not keyword search)
>   - `dataRepositoryType=VECTOR` - Searches a vector database (not relational DB)
>   - `dataRepositories=[pipeline_id]` - Points to your specific evidence document pipeline
>   - `maxChunkCount: 5` - Retrieves top 5 most relevant document chunks (not entire documents)
>
> **3. Query Execution**
>
> - `RetrievalSearchInput(query=user_question)` - Takes the agent's question
> - The query is converted to a vector embedding (numerical representation)
> - Vector search finds the 5 most similar document chunks based on semantic similarity
> - Example: "What evidence exists about Marcus Chen?" → Retrieves chunks from termination letters, security logs, bank records
>
> **4. Response Processing**
>
> - `response.search(search_input)` - Executes the vector search and retrieves results
> - `response.model_dump()` - Converts the response object to a Python dictionary containing:
>   - Document text chunks
>   - Source document names (e.g., "MARCUS_TERMINATION_LETTER.txt")
>   - Similarity scores
>   - Metadata (timestamps, locations, etc.)
> - `json.dumps()` - Converts to JSON string for the agent to parse
> - Agent receives structured data with actual evidence, not hallucinated information
>
> **What the Agent Sees:**
> The agent receives a JSON response like:
>
> ```json
> {
>   "results": [
>     {
>       "text": "Marcus Chen was terminated on 2024-01-15...",
>       "source": "MARCUS_TERMINATION_LETTER.txt",
>       "score": 0.89
>     },
>     ...
>   ]
> }
> ```
>
> This grounds the agent's response in real evidence documents!

### Step 2: Replace The Pipeline ID

👉 Go back to SAP AI Launchpad (if you closed it):

- Navigate to **Workspaces** → Select your workspace → Resource group `ai-agents-codejam`
- Go to **Generative AI Hub > Grounding Management**
- Copy the **Pipeline ID** from your pipeline

👉 In your code, replace `"YOUR_PIPELINE_ID_HERE"` with the actual pipeline ID

Example:

```python
dataRepositories=["0d3b132a-cbe1-4c75-abe7-adfbbab7e002"],  # Add the actual ID
```

### Step 3: Import Required Libraries

The grounding service requires the SAP Generative AI Hub SDK for document retrieval. Since we already installed sap-ai-sdk-gen, you can just import the grounding modules.

👉 Add these imports at the **top** of `investigator_crew.py` (after the existing imports):

```python
import json  # For converting response data to JSON format

from gen_ai_hub.document_grounding.client import RetrievalAPIClient  # Client to connect to grounding service
from gen_ai_hub.document_grounding.models.retrieval import (
    RetrievalSearchInput,  # Defines what to search for
    RetrievalSearchFilter,  # Configures how to search (vector DB, max chunks, etc.)
)
from gen_ai_hub.orchestration.models.document_grounding import DataRepositoryType  # Enum for repository types
```

> 💡 **What these imports do:**
>
> - `RetrievalAPIClient` - Connects to SAP's grounding service
> - `RetrievalSearchInput` - Structures the search query
> - `RetrievalSearchFilter` - Configures vector search parameters
> - `DataRepositoryType` - Specifies the type of data source (vector database)

### Step 4: Connect The Tool To Your Evidence Analyst Agent

Now that the grounding tool exists, you need to give it to the Evidence Analyst agent (currently it incorrectly uses `call_rpt1`).

👉 In [`/project/Python/starter-project/investigator_crew.py`](/project/Python/starter-project/investigator_crew.py), find the `evidence_analyst_agent` method

👉 Replace the

```python
tools=[call_rpt1]
```

with

```python
tools=[call_grounding_service]
```

Your **Evidence Analyst Agent** should now look like this:

```python
@agent
def evidence_analyst_agent(self) -> Agent:
    return Agent(
        config=self.agents_config['evidence_analyst_agent'],
        verbose=True,
        tools=[call_grounding_service]
    )
```

👉 Run your crew to test the grounding service!

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

Your Evidence Analyst should now search through actual evidence documents and cite specific sources (like "MARCUS_TERMINATION_LETTER.txt") instead of making up information!

---

## Understanding the Grounding Service

### What Just Happened?

You integrated a grounding service tool with your agent that:

1. **Connects** to the document grounding service of Generative AI Hub
2. **Embeds** text chunks of evidence using OpenAI's embedding model
3. **Searches** indexed evidence documents using vector similarity
4. **Retrieves** relevant chunks of information to support the agent's analysis
5. **Provides** context for the agent to make informed decisions

### The Grounding Flow

```mermaid
flowchart LR
    A[User Query] --> B[LLM Reasoning]
    B --> C[Agent Processing]
    C --> D[Grounding Tool Call]
    D --> E[Vector Search]
    E --> F[Document Chunks]
    F --> G[Agent Processing]
    G --> H[LLM Reasoning]
    H --> I[Output]
```

### Why This Matters

Grounding services are essential for agents to:

- **Access External Knowledge** from documents and data repositories
- **Provide Factual Responses** grounded in actual evidence
- **Reduce Hallucinations** by tethering reasoning to real data
- **Enable Scalability** by managing large document collections efficiently

---

## Key Takeaways

- **Grounding Services** extend agents' knowledge by connecting them to external document repositories
- **Vector Search** enables semantic search across documents, finding contextually relevant information
- **Document Pipelines** in SAP AI Core manage document indexing and retrieval
- **Tool Integration** is key—grounding tools must be explicitly passed to agents via the `tools` parameter
- **Repository IDs** identify which document collection to search, allowing agents to target specific data sources

---

## Next Steps

In the following exercises, you will:

1. ✅ Build a basic agent
2. ✅ Add custom tools to your agents so they can access external data
3. ✅ Create a complete crew with multiple agents working together
4. ✅ Integrate the Grounding Service for better reasoning and fact-checking (this exercise)
5. 📌 [Add web search capabilities](06-discover-connected-crimes.md) to gather external intelligence
6. 📌 [Solve the museum art theft mystery](07-solve-the-crime.md) using your fully-featured agent team

---

## Troubleshooting

**Issue**: `AttributeError: 'module' object has no attribute 'RetrievalAPIClient'`

- **Solution**: Ensure you've installed the SAP AI SDK with `pip install sap-ai-sdk-gen` and that all imports are correct

**Issue**: `Pipeline not found` or authentication error with grounding service

- **Solution**: Verify that:
  - Your resource group is set to `ai-agent-codejam` in SAP AI Launchpad
  - The pipeline ID is correct and matches the one from Grounding Management
  - Your `.env` file contains valid SAP AI Core credentials

**Issue**: `RetrievalAPIClient` initialization fails

- **Solution**: The client uses your environment variables for authentication. Ensure your `.env` file contains:
  - `AICORE_CLIENT_ID`
  - `AICORE_CLIENT_SECRET`
  - `AICORE_AUTH_URL`
  - `AICORE_BASE_URL`

**Issue**: No results returned from grounding service

- **Solution**: Verify that:
  - The pipeline ID is correct and contains indexed documents
  - Your search query is sufficiently descriptive
  - The `maxChunkCount` parameter is appropriate for your use case (try increasing it if results are too sparse)

**Issue**: `ModuleNotFoundError: No module named 'gen_ai_hub'`

- **Solution**: Ensure you've installed the SAP Cloud SDK for AI with `pip install sap-ai-sdk-gen`

---

## Resources

- [SAP AI Core Grounding Management](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/document-grounding)
- [SAP Cloud SDK for AI (Python)](https://help.sap.com/doc/generative-ai-hub-sdk/CLOUD/en-US/_reference/README_sphynx.html)

[Next exercise](06-discover-connected-crimes.md)
