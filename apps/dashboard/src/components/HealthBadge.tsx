export function HealthBadge({ health }: { health?: string }) {
  const map: Record<string, string> = {
    HEALTHY: "bg-green-100 text-green-700 border-green-200",
    FLAKY: "bg-amber-100 text-amber-700 border-amber-200",
    FAILING: "bg-red-100 text-red-700 border-red-200",
  };
  const label = health || "UNKNOWN";
  const cls = map[label] || "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}
