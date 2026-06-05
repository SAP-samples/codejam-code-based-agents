# Understanding Generative AI Hub in SAP AI Core

SAP AI Core is SAP's AI runtime. Here you can train your own models, fine-tune models or deploy machine learning models. [Generative AI Hub in SAP AI Core](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/generative-ai-hub-in-sap-ai-core-7db524ee75e74bf8b50c167951fe34a5) is the way to access large language models (LLMs) at SAP. Here you can find all SAP's partner foundation models, SAP's SAP-RPT-1 model, any fine-tuned model, and a variety of self hosted open source models.

[SAP AI Launchpad](https://help.sap.com/docs/ai-launchpad) is the UI for SAP AI Core and Generative AI Hub and is a multitenant SaaS application on SAP BTP. You can use it to try out or deploy models, to start training, and evaluation jobs, build orchestration pipelines and much more.

## Open SAP Business Technology Platform

👉 Open the SAP BTP subaccount: [`GenAI CodeJam`](https://emea.cockpit.btp.cloud.sap/cockpit/?idp=a7rg4vxjp.accounts.ondemand.com#/globalaccount/275320f9-4c26-4622-8728-b6f5196075f5/subaccount/a5a420d8-58c6-4820-ab11-90c7145da589?layout=TwoColumnsMidExpanded).

## Check Out the Subaccount

👉 Go to **Instances and Subscriptions**.

![BTP Cockpit](/exercises/data/images/btp-subaccount.png)

You should see an **SAP AI Core** service instance and an **SAP AI Launchpad** application subscription.

The `extended` plan of SAP AI Core service instance is needed to access capabilities of Generative AI Hub.

👉 Open and copy the SAP AI Core service key. You will need it in the next exercise.

![instances and subscriptions](/exercises/data/images/instances_subscriptions.png)

[Next exercise](01-setup-dev-space.md)
