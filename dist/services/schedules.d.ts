export declare function createSchedule(agentId: string, cronExpr: string, enabled?: boolean): Promise<{
    id: string;
    createdAt: Date;
    agentId: string;
    enabled: boolean;
    cronExpr: string;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
}>;
export declare function updateSchedule(id: string, fields: {
    cronExpr?: string;
    enabled?: boolean;
}): Promise<{
    id: string;
    createdAt: Date;
    agentId: string;
    enabled: boolean;
    cronExpr: string;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
}>;
export declare function deleteSchedule(id: string): Promise<void>;
export declare function toggleSchedule(id: string, enabled: boolean): Promise<{
    id: string;
    createdAt: Date;
    agentId: string;
    enabled: boolean;
    cronExpr: string;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
}>;
//# sourceMappingURL=schedules.d.ts.map