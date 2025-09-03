"use client";
import { useState } from "react";

export default function DemoButtons() {
  const [busy, setBusy] = useState(false);

  async function seed() {
    setBusy(true);
    try {
      const base = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3000";
      const res = await fetch(`${base}/api/demo/seed`, { method: "POST" });
      if (!res.ok) throw new Error("Failed seed");
      location.reload(); // simplest: refresh to show new agents
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const base = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3000";
      await fetch(`${base}/api/demo/reset`, { method: "POST" });
      location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={seed} 
        disabled={busy} 
        className="px-3 py-1.5 rounded-md bg-black text-white text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? "Loading..." : "Load Demo Data"}
      </button>
      <button 
        onClick={reset} 
        disabled={busy} 
        className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-800 text-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Reset
      </button>
    </div>
  );
}
