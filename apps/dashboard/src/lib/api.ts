import { Agent, AgentStatus, AgentMetrics, CreateAgentData, Schedule } from './types';

const BASE = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { 
    cache: "no-store", 
    ...init 
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Agent API functions
export async function getAgents() {
  return api<Agent[]>('/api/agents');
}

export async function getAgent(id: string) {
  return api<Agent>(`/api/agents/${id}`);
}

export async function getAgentStatus(id: string) {
  return api<AgentStatus>(`/api/agents/${id}/status`);
}

export async function getAgentMetrics(id: string, limit = 20) {
  return api<AgentMetrics>(`/api/agents/${id}/metrics?limit=${limit}`);
}

export async function createAgent(data: CreateAgentData) {
  return api<{ agent: Agent }>('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function startAgent(agentId: string) {
  const response = await api(`/api/agents/${agentId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  return response;
}

// Schedule API functions
export async function getAgentSchedules(agentId: string) {
  return api<{ schedules: Schedule[] }>(`/api/agents/${agentId}/schedules`);
}

export async function createSchedule(agentId: string, cronExpr: string, enabled = true) {
  return api<{ schedule: Schedule }>(`/api/agents/${agentId}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cronExpr, enabled })
  });
}

export async function updateSchedule(id: string, data: Partial<Schedule>) {
  return api<{ schedule: Schedule }>(`/api/schedules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function toggleSchedule(id: string, enabled: boolean) {
  return api<{ schedule: Schedule }>(`/api/schedules/${id}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
}

export async function deleteSchedule(id: string) {
  return api<{ ok: boolean }>(`/api/schedules/${id}`, {
    method: 'DELETE'
  });
}
