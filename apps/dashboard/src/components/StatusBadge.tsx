import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RUNNING': return 'bg-green-100 text-green-700 border-green-200';
      case 'READY': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'QUEUED': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'FAILED': return 'bg-red-100 text-red-700 border-red-200';
      case 'SUCCEEDED': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'KILLED': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
      getStatusColor(status),
      className
    )}>
      {status}
    </span>
  );
}
