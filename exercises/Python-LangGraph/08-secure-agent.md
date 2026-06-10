# (Optional) Secure the Agent

The agent is now deployed in SAP BTP and can be accessed by anyone with the URL. In a production scenario, you would want to restrict access to authorized users/systems. In this exercise, we'll add authentication and authorization using SAP's 
Authorization and Trust Management Service (XSUAA) service.

---

## SAP Authorization and Trust Management service

The SAP Authorization and Trust Management service (XSUAA) provides functionality for administrating and assigning application authorizations. It acts as the OAuth 2.0 authorization server and represents a typical reuse service. The SAP Authorization and Trust Management servicebroker creates a service instance for each application. Each app that wants to enforce authorizations with the security client library is then bound to this SAP Authorization and Trust Management service instance of the corresponding application.

Let's add authentication to our agent using XSUAA. This will require changes to the server code to validate incoming requests and ensure they have the appropriate permissions. Before we change the `server.py`, we will define the security and create the necessary service instance in SAP BTP.

👉 Create a file within the starter-project folder and call it `xs-security.json`. In it, include the contents below. Within `xs-security.json` we are defining the scope that we expect in the access token. We will validate this in `server.py`.

```json
{
  "xsappname": "investigator-graph-[your-username]",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.run", "description": "Run investigation" }
  ],
  "role-templates": [
    { "name": "Investigator", "scope-references": ["$XSAPPNAME.run"] }
  ],
  "authorities": ["$XSAPPNAME.run"]
}
```

👉 Create an XSUAA service instance: `cf create-service xsuaa application investigator-xsuaa-$(echo "$USER_NAME" | cut -d '@' -f 1 | tr -d '.') -c xs-security.json`

To validate that the service instance was created successfully, you can run `cf services` and look for `investigator-xsuaa-[your-username]` in the list.

---

## Update the `manifest.yml`

Next, we need to update the `manifest.yml` to include the new service instance and bind it to our application.

In the services section of the `manifest.yml`, add the XSUAA service instance. Remember to replace `[your-username]` with your actual unique identifier.

```yaml
services:
  - generative-ai-hub
  - investigator-xsuaa-[your-username]
```

---

## Update the requirements.txt

To validate the token from the XSUAA service in Python, we will use the `sap-xssec` library. We will check if the requester is authorised to execute this method. We extract the details from the access token that will be coming in the authorization header. 

👉 Now, add the `sap-xssec` and `cfenv` libraries to our `requirements.txt`:

```txt
sap-xssec
cfenv
```

The cfenv will allow us to retrieve the configuration of the XSUAA service instance from the environment variables. The service instance includes credentials details that are required to validate the token.

⏱️ Take some time to get familiar with the [sap-xssec library](https://github.com/SAP/cloud-pysec) and its [API](https://github.com/SAP/cloud-pysec/wiki) for validating tokens, especially the `xssec.create_security_context(access_token, uaa_service) -> SecurityContext` and `SecurityContext.check_scope(scope) -> {bool}` functions as we will use them to validate the received token.

---

## Update the `server.py` Code

Next, we will update the `server.py` code to validate incoming requests. We will check for the presence of an access token in the authorization header, validate it with the XSUAA service, and ensure that it contains the required scopes.

👉 First, lets import the libraries and get the service details from the environment

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from sap import xssec
import cfenv

env = cfenv.AppEnv()
xsuaa_service = env.get_service(label='xsuaa')
xsappname = xsuaa_service.credentials['xsappname']
```

We are retrieving the XSUAA service instance details using `cfenv` and storing the `xsappname` for later use in scope validation.

👉 Next, we will add a middleware to validate the token for incoming requests. Add the following code to `server.py`:

```python
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path in ("/health", "/.well-known/agent.json"):
        return await call_next(request)
    
    print("Authenticating request...")

    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    
    if not token:
        print("Token missing in request")
        return JSONResponse(status_code=401, content={"detail": "Missing token"})
    
    print("Validating token with XSUAA...")
    
    try:
        sc = xssec.create_security_context(token, xsuaa_service.credentials)
    
        if not sc.check_scope(f'{xsappname}.run') or not sc.check_scope('uaa.resource'):
            return JSONResponse(status_code=403, content={"detail": "Missing required scopes"})

        if sc.get_expiration_date() < datetime.datetime.now():
            return JSONResponse(status_code=401, content={"detail": "Token expired"})

        print(f"Token valid for client_id: {sc.get_clientid()}")
    
    except Exception as e:
        print(f"Token validation failed: {e}")
        return JSONResponse(status_code=401, content={"detail": str(e)})

    return await call_next(request)
```

This middleware will run for every incoming request (except for the `/health` and `/.well-known/agent.json` endpoints). It checks for the presence of an access token, validates it with the XSUAA service, checks for the required scopes, and ensures that the token has not expired. If any of these checks fail, it returns an appropriate HTTP error response.

⏱️ Take some time to review the code changes and understand how the authentication flow works.

---

## Redeploy the Agent

After making these changes, redeploy the agent to SAP BTP using `cf push "investigator-graph-$(echo "$USER_NAME" | cut -d '@' -f 1 | tr -d '.')"`. 

Once the deployment is complete, you can test the agent by sending requests with a valid access token that has the required scopes. Just remember that we will need to include an `Authorization` header with a valid Bearer token in our requests to access the agent's functionality. The `/health` and `/.well-known/agent.json` endpoints will still be accessible without authentication for health checks and agent discovery purposes.

Below, a sample curl request to the agent with an access token:

```bash
curl --request POST \
  --url https://investigator-graph-[your-username].cfapps.eu10-004.hana.ondemand.com/ \
  --header 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJqaWQiOiJRampIYTk1dE9GdjAyc0ROY0N0WFZtMk9PSzYwamFtWitQMjF6czRNRzVJPSIsImFsZyI6IlJTMjU2Iiwiamt1IjoiaHR0cHM6Ly9nZW5haS1jb2RlamFtLWx1eXExd2tnLmF1dGhlbnRpY2F0aW9uLmV1MTAuaGFuYS5vbmRlbWFuZC5jb20vdG9rZW5fa2V5cyIsImtpZCI6ImRlZmF1bHQtand0LWtleS1iMzU1ZjE5Mzg3In0.eyJzdWIiOiJzYi1pbnZlc3RpZ2F0b3ItZ.....' \
  --header 'content-type: application/json' \
  --data '{
  "jsonrpc": "2.0",
  "id": "33686a6b-ee4c-4a7a-86e3-83e2381665f2",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [
        {
          "data": {
            "user_request": "Investigate the art theft at the museum",
            "suspect_names": "Sophie Dubois, Marcus Chen, Viktor Petrov"
          }
        }
      ],
      "messageId": "039444fe-4d65-4ba6-8a46-8a51494d1690"
    }
  }
}'
```

![Calling agent via OAuth](../data/images/calling-agent-oauth.png)
