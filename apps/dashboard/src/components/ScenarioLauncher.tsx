"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
const BASE = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3000";

export default function ScenarioLauncher() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run(scenario: "healthy"|"failing"|"resourceHog") {
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/demo/runScenario`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ scenario })
      });
      if (!r.ok) throw new Error("Failed to start scenario");
      
      const response = await r.json();
      if (response.runId && response.agentId) {
        // Navigate to logs
        router.push(`/agents/${response.agentId}/logs?runId=${response.runId}`);
      } else {
        alert(`Scenario "${scenario}" started`);
      }
    } catch (error) {
      console.error("Failed to start scenario:", error);
      alert("Failed to start scenario");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button 
        onClick={() => run("healthy")} 
        disabled={busy} 
        className="px-3 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Healthy
      </button>
      <button 
        onClick={() => run("failing")} 
        disabled={busy} 
        className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Auto‑Restart
      </button>
      <button 
        onClick={() => run("resourceHog")} 
        disabled={busy} 
        className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Resource Spike
      </button>
    </div>
  );
}
