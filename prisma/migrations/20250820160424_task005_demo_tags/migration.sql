-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_runtime_agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'ZIP',
    "sourceUri" TEXT,
    "entrypoint" TEXT NOT NULL,
    "env" JSONB NOT NULL,
    "limitsCpu" REAL,
    "limitsMemMb" INTEGER,
    "networkMode" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "maxRestarts" INTEGER NOT NULL DEFAULT 2,
    "restartBackoffMs" INTEGER NOT NULL DEFAULT 5000,
    "tags" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_runtime_agents" ("createdAt", "entrypoint", "env", "id", "language", "limitsCpu", "limitsMemMb", "maxRestarts", "name", "networkMode", "restartBackoffMs", "sourceType", "sourceUri", "status", "updatedAt") SELECT "createdAt", "entrypoint", "env", "id", "language", "limitsCpu", "limitsMemMb", "maxRestarts", "name", "networkMode", "restartBackoffMs", "sourceType", "sourceUri", "status", "updatedAt" FROM "runtime_agents";
DROP TABLE "runtime_agents";
ALTER TABLE "new_runtime_agents" RENAME TO "runtime_agents";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
