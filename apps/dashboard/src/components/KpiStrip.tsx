"use client";
import { useEffect, useState } from "react";
const BASE = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3000";

export function KpiStrip() {
  const [kpi, setKpi] = useState({ runsStarted: 0, restarts: 0, peakMemMb: 0, schedulesTriggered: 0 });

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const r = await fetch(`${BASE}/api/summary/kpis`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (mounted) setKpi(j);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card label="Runs Started" value={kpi.runsStarted} />
      <Card label="Auto-Restarts" value={kpi.restarts} />
      <Card label="Peak Mem (MB)" value={kpi.peakMemMb} />
      <Card label="Schedules" value={kpi.schedulesTriggered} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border rounded-xl p-3 shadow-sm">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
