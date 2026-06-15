"""
Server Health Check Script
Checks if the ADAL backend server is running and returns JSON status
"""
import requests
import json
import sys
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

def check_server_health():
    """
    Check if the ADAL backend server is running and healthy.
    Returns a JSON dictionary with status information.
    """
    # Get server configuration from environment or use defaults
    base_url = os.getenv("API_BASE_URL", "http://localhost:9006")
    timeout = int(os.getenv("HEALTH_CHECK_TIMEOUT", "5"))
    
    # Initialize response structure
    health_status = {
        "status": "unknown",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "server_url": base_url,
        "checks": {
            "server_reachable": False,
            "api_docs_available": False,
            "response_time_ms": None
        },
        "error": None
    }
    
    try:
        # Check 1: Server is reachable (root endpoint)
        start_time = datetime.utcnow()
        try:
            response = requests.get(
                f"{base_url}/",
                timeout=timeout,
                allow_redirects=True
            )
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            health_status["checks"]["response_time_ms"] = round(response_time, 2)
            
            if response.status_code in [200, 404, 307, 308]:  # 404/redirects are OK, server is running
                health_status["checks"]["server_reachable"] = True
        except requests.exceptions.ConnectionError:
            health_status["status"] = "down"
            health_status["error"] = "Server is not reachable. Is it running?"
            return health_status
        except requests.exceptions.Timeout:
            health_status["status"] = "timeout"
            health_status["error"] = f"Server did not respond within {timeout} seconds"
            return health_status
        except Exception as e:
            health_status["status"] = "error"
            health_status["error"] = f"Unexpected error checking server: {str(e)}"
            return health_status
        
        # Check 2: API documentation endpoint (FastAPI auto-generates /docs)
        try:
            docs_response = requests.get(
                f"{base_url}/docs",
                timeout=timeout,
                allow_redirects=True
            )
            if docs_response.status_code == 200:
                health_status["checks"]["api_docs_available"] = True
        except Exception:
            # Docs endpoint not critical, just mark as unavailable
            pass
        
        # Determine overall status
        if health_status["checks"]["server_reachable"]:
            health_status["status"] = "healthy"
        else:
            health_status["status"] = "unhealthy"
        
        return health_status
        
    except Exception as e:
        health_status["status"] = "error"
        health_status["error"] = f"Health check failed: {str(e)}"
        return health_status


def main():
    """Main entry point - outputs JSON to stdout"""
    try:
        health_status = check_server_health()
        print(json.dumps(health_status, indent=2))
        
        # Exit with appropriate code for scripting/CI/CD
        if health_status["status"] == "healthy":
            sys.exit(0)
        else:
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(json.dumps({
            "status": "interrupted",
            "error": "Health check interrupted by user"
        }, indent=2))
        sys.exit(130)
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "error": f"Fatal error: {str(e)}"
        }, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
