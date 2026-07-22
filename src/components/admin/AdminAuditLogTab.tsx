"use client";

import { useEffect, useState } from "react";

import {
  adminListAuditLog,
  ProposalServiceError,
} from "@/services/family-proposal-service";
import type { AuditLogEntry } from "@/types/family-proposal";

export function AdminAuditLogTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        setEntries(await adminListAuditLog({ limit: 100 }));
      } catch (loadError) {
        setError(
          loadError instanceof ProposalServiceError
            ? loadError.message
            : "Не удалось загрузить журнал",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {isLoading ? <p className="text-sm text-[#5C6B63]">Загрузка…</p> : null}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-xl border border-[#E4DDD1] bg-white px-4 py-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-[#2D4A3E]">{entry.action}</span>
            <span className="text-xs text-[#6B776F]">
              {new Date(entry.createdAt).toLocaleString("ru-RU")}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#5C6B63]">
            {entry.entityType}
            {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ""}
          </p>
        </div>
      ))}
      {!isLoading && entries.length === 0 ? (
        <p className="text-sm text-[#5C6B63]">Журнал пуст.</p>
      ) : null}
    </div>
  );
}
