import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { 
  getAgent, 
  getAgentStatus, 
  getAgentMetrics, 
  getAgentSchedules 
} from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { StartStopButtons } from '@/components/StartStopButtons';

interface AgentDetailPageProps {
  params: { id: string };
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  let agent, status, metrics, schedules;
  let error = null;

  try {
    [agent, status, metrics, schedules] = await Promise.all([
      getAgent(params.id),
      getAgentStatus(params.id),
      getAgentMetrics(params.id),
      getAgentSchedules(params.id)
    ]);
  } catch (err) {
    console.error('Failed to fetch agent data:', err);
    notFound();
  }

  const isRunning = status.lastRun?.status === 'RUNNING';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Agents
            </Link>
          </div>
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          <p className="text-muted-foreground">
            {agent.language} • {agent.entrypoint}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={agent.status} />
          <StartStopButtons agentId={agent.id} isRunning={isRunning} />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
          <p className="text-2xl font-bold">{agent.status}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Uptime</h3>
          <p className="text-2xl font-bold">
            {status.uptimeMs ? `${Math.round(status.uptimeMs / 1000)}s` : 'N/A'}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Peak Memory</h3>
          <p className="text-2xl font-bold">
            {status.lastRun?.maxMemMb ? `${status.lastRun.maxMemMb}MB` : 'N/A'}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Restarts</h3>
          <p className="text-2xl font-bold">{status.lastRun?.restarts || 0}</p>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Runs</h2>
          <Link
            href={`/agents/${agent.id}/logs`}
            className="text-primary hover:text-primary/80 text-sm font-medium"
          >
            View Logs
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-medium text-muted-foreground">Run ID</th>
                <th className="text-left py-2 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 text-sm font-medium text-muted-foreground">Started</th>
                <th className="text-left py-2 text-sm font-medium text-muted-foreground">Duration</th>
                <th className="text-left py-2 text-sm font-medium text-muted-foreground">Memory</th>
                <th className="text-left py-2 text-sm font-medium text-muted-foreground">Restarts</th>
              </tr>
            </thead>
            <tbody>
              {metrics.samples.slice(0, 10).map((run: any) => (
                <tr key={run.runId} className="border-b">
                  <td className="py-2 text-sm font-mono">{run.runId.slice(0, 8)}</td>
                  <td className="py-2">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="py-2 text-sm">
                    {run.startedAt ? format(new Date(run.startedAt), 'MMM dd, HH:mm') : 'N/A'}
                  </td>
                  <td className="py-2 text-sm">
                    {run.durationMs ? `${Math.round(run.durationMs / 1000)}s` : 'N/A'}
                  </td>
                  <td className="py-2 text-sm">
                    {run.maxMemMb ? `${run.maxMemMb}MB` : 'N/A'}
                  </td>
                  <td className="py-2 text-sm">{run.restarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedules */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Schedules</h2>
        
        {schedules.schedules.length === 0 ? (
          <p className="text-muted-foreground">No schedules configured</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-sm font-medium text-muted-foreground">Cron Expression</th>
                  <th className="text-left py-2 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 text-sm font-medium text-muted-foreground">Last Run</th>
                  <th className="text-left py-2 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.schedules.map((schedule: any) => (
                  <tr key={schedule.id} className="border-b">
                    <td className="py-2 text-sm font-mono">{schedule.cronExpr}</td>
                    <td className="py-2">
                      <StatusBadge 
                        status={schedule.enabled ? 'ENABLED' : 'DISABLED'} 
                      />
                    </td>
                    <td className="py-2 text-sm">
                      {schedule.lastRunAt ? format(new Date(schedule.lastRunAt), 'MMM dd, HH:mm') : 'Never'}
                    </td>
                    <td className="py-2">
                      <button className="text-primary hover:text-primary/80 text-sm">
                        Toggle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
