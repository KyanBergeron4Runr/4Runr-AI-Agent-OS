"use client";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { HealthBadge } from "./HealthBadge";
import { StartStopButtons } from "./StartStopButtons";
import { useState, useEffect } from "react";

interface Agent {
  id: string;
  name: string;
  language: "NODE" | "PYTHON";
  status: string;
  limitsCpu?: number;
  limitsMemMb?: number;
  schedules?: Array<{ cronExpr: string; enabled: boolean }>;
}

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const [health, setHealth] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);

  // Fetch health status
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch(`/api/agents/${agent.id}/summary`);
        if (response.ok) {
          const data = await response.json();
          setHealth(data.health);
        }
      } catch (error) {
        console.error("Failed to fetch health:", error);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [agent.id]);

  // Check if agent is running
  useEffect(() => {
    setIsRunning(agent.status === "RUNNING");
  }, [agent.status]);

  const languageIcon = agent.language === "NODE" ? "🟢" : "🐍";
  const hasSchedule = agent.schedules && agent.schedules.length > 0;

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{languageIcon}</span>
          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={agent.status} />
          <HealthBadge health={health} />
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Limits:</span> {agent.limitsCpu || 0} CPU, {agent.limitsMemMb || 0} MB RAM
        </div>
        
        {hasSchedule && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Schedule:</span> {agent.schedules![0].cronExpr}
            {!agent.schedules![0].enabled && (
              <span className="ml-1 text-amber-600">(disabled)</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <StartStopButtons agentId={agent.id} isRunning={isRunning} />
        <Link
          href={`/agents/${agent.id}`}
          className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition-colors"
        >
          View
        </Link>
        {isRunning && (
          <Link
            href={`/agents/${agent.id}/logs`}
            className="px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 text-sm hover:bg-blue-200 transition-colors"
          >
            Logs
          </Link>
        )}
      </div>
    </div>
  );
}
