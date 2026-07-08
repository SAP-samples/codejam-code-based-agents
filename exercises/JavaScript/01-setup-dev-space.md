# Setup SAP Business Application Studio and Your Development Space

[SAP Business Application Studio](https://help.sap.com/docs/bas/sap-business-application-studio/what-is-sap-business-application-studio) is based on Code-OSS, an open-source project used for building Visual Studio Code. Available as a cloud service, SAP Business Application Studio (BAS) provides a desktop-like experience similar to leading IDEs, including a terminal and optimized editors for SAP development.

BAS is utilizing the concept of development spaces (dev spaces). Dev spaces are comparable to isolated virtual machines in the cloud containing tailored tools and pre-installed runtimes, such as SAP Fiori, SAP S/4HANA extensions, Workflow, HANA native development and more.. This simplifies and speeds up the setup of your development environment, enabling you to efficiently develop, test, build, and run your solutions in BAS or in the cloud.

## Open SAP Business Application Studio

👉 Go back to the [BTP cockpit](https://emea.cockpit.btp.cloud.sap/cockpit#/globalaccount/275320f9-4c26-4622-8728-b6f5196075f5/subaccount/a5a420d8-58c6-4820-ab11-90c7145da589/subaccountoverview).

👉 Navigate to `Instances and Subscriptions` and open `SAP Business Application Studio`.

![Open BAS](/exercises/data/images/BTP_cockpit_BAS.png)

## Create a New Dev Space for CodeJam Exercises

👉 Create a new Dev Space.

![Create a Dev Space 1](/exercises/data/images/bas.png)

👉 Enter the name of the dev space `GenAICodeJam_XX`, select the `Basic` kind of application and `Python Tools` from `Additional SAP Extensions`.

> Replace `XX` with your initials.

👉 Click **Create Dev Space**.

![Create a Dev Space 2](/exercises/data/images/create_dev_space.png)

You should see the dev space **STARTING**.

![Dev Space is Starting](/exercises/data/images/dev_starting.png)

👉 Wait for the dev space to reach the **RUNNING** state and then open it.

![Dev Space is Running](/exercises/data/images/dev_running.png)

## Clone the Repository

👉 Once your dev space is open in BAS, clone this Git repository using the URL below:

```sh
https://github.com/SAP-samples/codejam-code-based-agents.git
```

![Clone the repo](/exercises/data/images/clone_git.png)

👉 Click **Open** to open the project in the Explorer view.

![Open a project](/exercises/data/images/clone_git_2.png)

## Configure the Connection to Generative AI Hub

👉 Go back to the Subaccount in the [BTP cockpit](https://emea.cockpit.btp.cloud.sap/cockpit#/globalaccount/275320f9-4c26-4622-8728-b6f5196075f5/subaccount/a5a420d8-58c6-4820-ab11-90c7145da589/subaccountoverview).

👉 Navigate to `Instances and Subscriptions` and open the SAP AI Core instance's service binding.

![Service Binding in the BTP Cockpit](/exercises/data/images/service-binding.png)

👉 Click **Copy JSON**.

👉 Return to BAS and create a new file `.env` in [`/project/JavaScript/starter-project/`](/project/JavaScript/starter-project/) by copying the provided `.env.example`:

```bash
cp project/JavaScript/starter-project/.env.example project/JavaScript/starter-project/.env
```

👉 Open the `.env` file and paste your SAP AI Core service key JSON as the value of `AICORE_SERVICE_KEY` (the entire JSON on a single line, wrapped in single quotes):

```bash
AICORE_SERVICE_KEY='{"clientid":"sb-...","clientsecret":"...","url":"...","serviceurls":{"AI_API_URL":"..."}}'
RESOURCE_GROUP=ai-agents-codejam
MODEL_NAME=gpt-4o
GROUNDING_PIPELINE_ID=
```

> ☝️ You will fill in the `GROUNDING_PIPELINE_ID` in a later exercise.

> 💡 **Why a single-line JSON string?** The SAP Cloud SDK for AI reads `AICORE_SERVICE_KEY` as a raw JSON string from the environment. Pasting the service key JSON as a single line (without newlines) ensures `dotenv` parses it correctly. Newlines inside the value would break the `.env` format.

## Install Node.js Dependencies

👉 Open a new Terminal in BAS.

![Start terminal](/exercises/data/images/start_terminal.png)

👉 Verify your Node.js version (18 or newer required):

```bash
node --version
```

> ⚠️ **Important**: The SAP Cloud SDK for AI requires Node.js 18 or newer. If your version is older, install a current LTS release from [nodejs.org](https://nodejs.org).

👉 Navigate to the starter project and install dependencies:

```bash
cd project/JavaScript/starter-project
npm install
```

This installs all packages defined in `package.json`, including:

- `@langchain/langgraph` — the graph-based agent framework
- `@sap-ai-sdk/orchestration` — SAP Cloud SDK for AI, LLM access via Generative AI Hub
- `@sap-ai-sdk/rpt` — SAP Cloud SDK for AI, RPT-1 structured data model
- `dotenv` — loads your `.env` file into `process.env`
- `tsx` — TypeScript Execute runtime, runs `.ts` files directly

> 💡 **No compilation step needed for development.** You will run TypeScript files directly using `npx tsx`. This means you edit a `.ts` file and run it immediately, with no `tsc` build required during the workshop.

## Let's Start Coding!

[Next exercise](02-build-a-basic-agent.md)
