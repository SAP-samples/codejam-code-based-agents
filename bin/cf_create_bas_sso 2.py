import subprocess
import json
import argparse
import os


# Function to create a service key
def create_service_key(service_name, service_key_name):
    try:
        create_key_command = ["cf", "create-service-key", service_name, service_key_name]
        subprocess.run(create_key_command, check=True)
        print(f"Service key '{service_key_name}' created successfully for service '{service_name}'.")
    except subprocess.CalledProcessError as e:
        print(f"Failed to create service key: {e}")
        exit(1)

# Function to get a service key and save it to a file
def get_service_key(service_name, service_key_name, output_file):
    try:
        get_key_command = ["cf", "service-key", service_name, service_key_name]
        result = subprocess.run(get_key_command, capture_output=True, text=True, check=True)
        output = result.stdout
        
        
        # Extract the JSON part of the output
        start_index = output.find("{")
        service_key_json = output[start_index:] if start_index != -1 else None
        

        if not service_key_json:
            print("Error: Service key JSON not found.")
            exit(1)
        
        # Convert to JSON object
        service_key_data = json.loads(service_key_json)

        # Create the .aicore directory if it doesn't exist
        home_dir = os.path.expanduser('~')
        aicore_dir = os.path.join(home_dir, '.aicore')
        os.makedirs(aicore_dir, exist_ok=True)

        # Transform the service key data as required
        config_data = {
            "AICORE_AUTH_URL": service_key_data.get("credentials")["url"],
            "AICORE_CLIENT_ID": service_key_data.get("credentials")["clientid"],
            "AICORE_CLIENT_SECRET": service_key_data.get("credentials")["clientsecret"],
            "AICORE_BASE_URL": service_key_data.get("credentials")["serviceurls"]["AI_API_URL"],
            "AICORE_RESOURCE_GROUP": "default"
        }

        # Write the config data to config.json
        config_path = os.path.join(aicore_dir, 'config.json')
        with open(config_path, 'w') as config_file:
            json.dump(config_data, config_file, indent=4)

    except subprocess.CalledProcessError as e:
        print(f"Failed to retrieve service key: {e}")
        exit(1)
    except Exception as e:
        print(f"Failed to write service key to file: {e}")
        exit(1)

# Main function to execute the script
def main():
    parser = argparse.ArgumentParser(description="Create and retrieve a service key from Cloud Foundry.")
    
    # Service key parameters
    parser.add_argument('--service', required=True, help='Cloud Foundry service name')
    parser.add_argument('--service_key', required=True, help='Service key name')
    parser.add_argument('--output', default="config.json", help='Output file for service key (default: config.json)')
    
    args = parser.parse_args()


    # Step 1: Create the service key
    create_service_key(args.service, args.service_key)

    # Step 2: Retrieve and save the service key with modified output
    get_service_key(args.service, args.service_key, args.output)

if __name__ == "__main__":
    main()
