import subprocess
import requests
import time
import shutil
import os

# Commands to start Node.js services via npm
start_pricegetter = ["node", "Backend/PriceGetter/pricegetter.js"]
start_walletgen = ["node", "Backend/WalletGeneration/walletGenerator.js"]
start_smtp = ["node", "SMTP/smtp.js"]

# API endpoints to test the servers
price_update_endpoint = "http://localhost:3001/update-prices"
wallet_generation_endpoint = "http://localhost:3100/generate-wallet/ethereum"

def resolve_executable_path(command):
    """Resolve the absolute path of the executable."""
    executable = command[0]
    resolved_path = shutil.which(executable)
    if resolved_path:
        print(f"Resolved path for '{executable}': {resolved_path}")
    else:
        print(f"Unable to resolve path for '{executable}'. Ensure it is in PATH.")
    return resolved_path

def log_command_and_working_directory(command):
    """Log the absolute path and working directory for a command."""
    print(f"Command to execute: {' '.join(command)}")
    print(f"Current working directory: {os.getcwd()}")

def wait_for_server(url, timeout=60):
    """Wait for a server to be online."""
    print(f"Waiting for {url} to be online...")
    start_time = time.time()
    while True:
        try:
            response = requests.get(url)
            if response.status_code == 200:
                print(f"Server {url} is online!")
                return True
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(1)
        if time.time() - start_time > timeout:
            print(f"Timeout waiting for {url}")
            return False

def start_service(command, service_name, cwd=None):
    """Start a service and log its path."""
    resolved_path = resolve_executable_path(command)
    if not resolved_path:
        raise FileNotFoundError(f"Unable to find executable for {service_name}. Ensure it is installed and in PATH.")

    log_command_and_working_directory(command)
    print(f"Starting {service_name} service...")
    return subprocess.Popen(command, cwd=cwd)

def main():
    try:
        # Start services
        proc_pricegetter = start_service(start_pricegetter, "PriceGetter")
        proc_walletgen = start_service(start_walletgen, "WalletGeneration")
        proc_smtp = start_service(start_smtp, "SMTP")

        # Check if services are online
        if wait_for_server("http://localhost:3001"):
            print(f"Calling endpoint: {price_update_endpoint}")
            response = requests.get(price_update_endpoint)
            print(f"Response: {response.status_code}, {response.text}")

        if wait_for_server("http://localhost:3100"):
            print(f"Calling endpoint: {wallet_generation_endpoint}")
            response = requests.get(wallet_generation_endpoint)
            print(f"Response: {response.status_code}, {response.text}")

        print("All services are up and running.")

        # Keep processes running
        proc_pricegetter.wait()
        proc_walletgen.wait()
        proc_smtp.wait()

    except KeyboardInterrupt:
        print("Stopping services...")
        proc_pricegetter.terminate()
        proc_walletgen.terminate()
        proc_smtp.terminate()
        print("All services stopped.")

    except FileNotFoundError as e:
        print(e)
        print("Ensure all required executables are installed and accessible.")

if __name__ == "__main__":
    main()