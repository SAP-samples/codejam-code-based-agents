# Setup SAP Business Application Studio and your personal development space

> [SAP Business Application Studio](https://help.sap.com/docs/bas/sap-business-application-studio/what-is-sap-business-application-studio) is based on Code-OSS, an open-source project used for building Visual Studio Code. Available as a cloud service, SAP Business Application Studio (BAS) provides a desktop-like experience similar to leading IDEs, with command line and optimized editors.

> At the heart of SAP Business Application Studio are the dev spaces. The dev spaces are comparable to isolated virtual machines in the cloud containing tailored tools and pre-installed runtimes per business scenario, such as SAP Fiori, SAP S/4HANA extensions, Workflow, HANA native development and more. This simplifies and speeds up the setup of your development environment, enabling you to efficiently develop, test, build, and run your solutions locally or in the cloud.

## Open SAP Business Application Studio

👉 Go back to the [BTP cockpit](https://emea.cockpit.btp.cloud.sap/cockpit/?idp=a7rg4vxjp.accounts.ondemand.com#/globalaccount/275320f9-4c26-4622-8728-b6f5196075f5/subaccount/a5a420d8-58c6-4820-ab11-90c7145da589?layout=TwoColumnsMidExpanded).

👉 Navigate to `Instances and Subscriptions` and open `SAP Business Application Studio`.

![Open BAS](/exercises/data/images/BTP_cockpit_BAS.png)

## Create a new Dev Space for CodeJam exercises

👉 Create a new Dev Space.

![Create a Dev Space 1](/exercises/data/images/bas.png)

👉 Enter the name of the dev space `GenAICodeJam_XX`, select the `Basic` kind of application and `Python Tools` from Additional SAP Extensions.

> Replace the `XX` with your initials.

👉 Click **Create Dev Space**.

![Create a Dev Space 2](/exercises/data/images/create_dev_space.png)

You should see the dev space **STARTING**.

![Dev Space is Starting](/exercises/data/images/dev_starting.png)

👉 Wait for the dev space to get into the **RUNNING** state and then open it.

![Dev Space is Running](/exercises/data/images/dev_running.png)

## Clone the exercises from the Git repository

👉 Once you opened your dev space in BAS, use one of the available options to clone this Git repository with exercises using the URL below:

```sh
https://github.com/SAP-samples/codejam-code-based-agents.git
```

![Clone the repo](/exercises/data/images/clone_git.png)

👉 Click **Open** to open a project in the Explorer view.

![Open a project](/exercises/data/images/clone_git_2.png)

## Configure the connection details to Generative AI Hub

👉 Create a new file `.env` in the [/project/Python/starter-project/.env](/project/Python/starter-project/.env) directory (click on the link to create the file).

👉 Add the following variables to your `.env` file:

```Python
LITELLM_PROVIDER="sap"
AICORE_AUTH_URL="https://#####.authentication.eu10.hana.ondemand.com/" + "oauth/token"
AICORE_CLIENT_ID="sb-3c636fc2-d352-496a-851d-7a7d6005dcd4!b505946|aicore!b540"
AICORE_CLIENT_SECRET="#####"
AICORE_RESOURCE_GROUP="ai-agents-codejam"
AICORE_BASE_URL="https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com"
RPT1_DEPLOYMENT_URL="https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com/v2/inference/deployments/###/predict"
```
👉 You will need to UPDATE these variables but keep the given structure. The correct information you can find in the SAP AI Core service-key in your BTP cockpit.

👉 Go back to the Subaccount in the [BTP cockpit](https://emea.cockpit.btp.cloud.sap/cockpit/?idp=a7rg4vxjp.accounts.ondemand.com#/globalaccount/275320f9-4c26-4622-8728-b6f5196075f5/subaccount/a5a420d8-58c6-4820-ab11-90c7145da589?layout=TwoColumnsMidExpanded).

👉 Navigate to `Instances and Subscriptions` and open the SAP AI Core instance's service binding.

![Service Binding in the BTP Cockpit](/exercises/data/images/service-binding.png)

👉 Make sure the correct resource group `AICORE_RESOURCE_GROUP` is assigned, we will use `ai-agents-codejam` for this CodeJam.

> ☝️ You will update the `RPT-1_DEPLOYMENT_URL` in a later exercise.


## Create a Python virtual environment and install the LiteLLM and CrewAI

👉 Start a new Terminal.

![Start terminal](/exercises/data/images/start_terminal.png)

👉 Verify your Python version is compatible with CrewAI (requires Python 3.10, 3.11, 3.12, or 3.13):

```bash
python3 --version
```

> ⚠️ **Important**: CrewAI requires Python 3.10 or newer (up to 3.13). If your Python version is 3.9 or older, install a compatible version first.
>
> - **macOS**: Use [Homebrew](https://brew.sh/) to install Python 3.11: `brew install python@3.11`, then use `python3.11` in the commands below.
> - **Linux**: Install Python 3.11 with your distro package manager, for example:
>   - Ubuntu/Debian: `sudo apt update && sudo apt install python3.11 python3.11-venv`
>   - Fedora/RHEL: `sudo dnf install python3.11`
>   Then use `python3.11` in the commands below.
> - **Windows**: Install Python 3.11 from the [official Python downloads page](https://www.python.org/downloads/windows/) and make sure **Add python.exe to PATH** is enabled during installation. Then use `python` (or `py -3.11`) in the commands below.

👉 Create a virtual environment using the following command:

```bash
python3 -m venv ~/projects/codejam-code-based-agents/env --upgrade-deps
```

Or use the variant that matches your OS/shell if not in BAS:

```bash
# macOS / Linux
python3 -m venv ~/projects/codejam-code-based-agents/env --upgrade-deps
```

```powershell
# Windows (PowerShell)
python -m venv .\env --upgrade-deps
```

👉 Activate the `env` virtual environment like this and make sure it is activated:

```bash
source ~/projects/codejam-code-based-agents/env/bin/activate
```

Use the activation command for your environment:

```bash
# macOS / Linux
source ~/projects/codejam-code-based-agents/env/bin/activate
```

```powershell
# Windows (PowerShell)
.\env\Scripts\Activate.ps1
```

```cmd
:: Windows (Command Prompt)
.\env\Scripts\activate.bat
```

> ℹ️ If PowerShell blocks script execution, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and then run `./env/Scripts/Activate.ps1` again.

![venv](/exercises/data/images/venv.png)

👉 Install LiteLLM, CrewAI, and python-dotenv using the following `pip install` commands.

```bash
pip install litellm==1.82.6 crewai python-dotenv
```

> In case you see a message in BAS asking you to create an isolated environment, click on `Don't show again`.

![bas-message](/exercises/data/images/virtual-env-python-bas-warning.png)

## Let's start coding

[Next exercise](02-build-a-basic-agent.md)
