import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAgent, getAgentStatus } from '@/lib/api';
import { LogViewer } from '@/components/LogViewer';

interface LogsPageProps {
  params: { id: string };
  searchParams: { runId?: string };
}

export default async function LogsPage({ params, searchParams }: LogsPageProps) {
  let agent, status;
  let error = null;

  try {
    [agent, status] = await Promise.all([
      getAgent(params.id),
      getAgentStatus(params.id)
    ]);
  } catch (err) {
    console.error('Failed to fetch agent data:', err);
    notFound();
  }

  // Use provided runId or get the latest running run
  const runId = searchParams.runId || status.lastRun?.id;

  if (!runId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href={`/agents/${params.id}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Agent
          </Link>
        </div>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No active runs found
          </h3>
          <p className="text-muted-foreground">
            Start the agent to view live logs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href={`/agents/${params.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Agent
        </Link>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Logs</h1>
          <p className="text-muted-foreground">
            {agent.name} • Run {runId.slice(0, 8)}
          </p>
        </div>
      </div>

      <LogViewer runId={runId} />
    </div>
  );
}
