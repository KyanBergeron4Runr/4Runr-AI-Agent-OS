"use client";
import { useEffect, useState } from "react";

export default function Tour() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    if (localStorage.getItem("tour_done") !== "1") setShow(true);
  }, []);
  
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-white shadow-lg border rounded-xl p-4 w-[420px] pointer-events-auto">
        <h3 className="font-semibold mb-2">Welcome to 4Runr Agent OS</h3>
        <ol className="text-sm space-y-1 list-decimal pl-6">
          <li>Load Demo Data (top-right) to create sample agents</li>
          <li>Open an agent, click <b>Run now</b> to start</li>
          <li>Watch <b>Live Logs</b> stream in real time</li>
          <li>See <b>Schedules</b> trigger automatically</li>
          <li>Auto‑restart kicks in on failures</li>
        </ol>
        <div className="mt-3 text-right">
          <button
            onClick={() => { 
              localStorage.setItem("tour_done","1"); 
              setShow(false); 
            }}
            className="px-3 py-1.5 rounded-md bg-black text-white text-sm hover:bg-gray-800 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
