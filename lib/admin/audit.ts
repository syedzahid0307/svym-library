import "server-only";

import { db } from "@/database/drizzle";
import { auditLog } from "@/database/schema";

// Every admin mutation that changes something worth being able to
// answer "who did this and when" for should call this. Deliberately
// best-effort: a failure to write the audit row logs to the console but
// never blocks or rolls back the actual mutation it's describing - an
// audit trail that occasionally fails to write one entry is still far
// more useful than a mutation that fails outright because a logging
// table had a transient issue. (This also means the write isn't
// guaranteed atomic with the mutation itself - the neon-http driver
// doesn't support true multi-statement transactions; see EF-23 in the
// engineering report for the longer-term fix.)
export const logAuditEvent = async (params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await db.insert(auditLog).values({
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    console.log("Failed to write audit log entry:", error);
  }
};
