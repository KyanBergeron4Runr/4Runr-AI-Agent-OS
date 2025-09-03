import os
import time
import sys
from datetime import datetime

scenario = os.environ.get('SCENARIO', 'healthy')
spike_ms = int(os.environ.get('SPIKE_MS', '10000'))

print(f"[{datetime.now().isoformat()}] Starting Python agent with scenario: {scenario}")

def run_scenario():
    if scenario == 'healthy':
        # Normal healthy behavior - heartbeats for 30 seconds
        for i in range(30):
            print(f"[{datetime.now().isoformat()}] Heartbeat {i + 1}/30 - Healthy agent running")
            time.sleep(1)
        print(f"[{datetime.now().isoformat()}] Healthy agent completed successfully")
        sys.exit(0)
        
    elif scenario == 'failing':
        # Run for 40 seconds then exit with error code 1
        for i in range(40):
            print(f"[{datetime.now().isoformat()}] Heartbeat {i + 1}/40 - Failing agent (will crash soon)")
            time.sleep(1)
        print(f"[{datetime.now().isoformat()}] Failing agent - intentional crash")
        sys.exit(1)
        
    elif scenario == 'resourceHog':
        # Create memory spike for specified duration
        print(f"[{datetime.now().isoformat()}] Resource spike agent - allocating memory for {spike_ms}ms")
        
        # Allocate memory
        memory_hog = []
        for i in range(1000000):
            memory_hog.append(f"data-{i}-{int(time.time())}")
        
        print(f"[{datetime.now().isoformat()}] Memory allocated, holding for {spike_ms}ms")
        time.sleep(spike_ms / 1000)
        
        # Free memory
        memory_hog.clear()
        print(f"[{datetime.now().isoformat()}] Memory freed, resource spike completed")
        sys.exit(0)
        
    else:
        print(f"[{datetime.now().isoformat()}] Unknown scenario: {scenario}, running healthy mode")
        # Fall back to healthy behavior
        for i in range(30):
            print(f"[{datetime.now().isoformat()}] Heartbeat {i + 1}/30 - Default healthy mode")
            time.sleep(1)
        sys.exit(0)

if __name__ == "__main__":
    try:
        run_scenario()
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Agent error: {e}")
        sys.exit(1)
