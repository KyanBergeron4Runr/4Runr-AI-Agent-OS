import { AgentCard } from "@/components/AgentCard";
import { KpiStrip } from "@/components/KpiStrip";
import { getAgents } from "@/lib/api";

export default async function HomePage() {
  const agents = await getAgents();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Agents</h1>
        <p className="text-gray-600">Monitor and manage your AI agents</p>
      </div>

      <KpiStrip />

      {agents.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">No agents found</div>
          <p className="text-gray-500">Load demo data to get started</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
