"use client";

import { useCallback, useEffect, useState } from "react";

import { ProposalReviewDialog } from "@/components/admin/ProposalReviewDialog";
import {
  proposalTypeLabel,
  ProposalStatusBadge,
} from "@/components/collaboration/ProposalStatusBadge";
import {
  adminCountPendingProposals,
  adminListFamilyChangeProposals,
  ProposalServiceError,
} from "@/services/family-proposal-service";
import type { AdminProposalListItem } from "@/types/family-proposal";

interface AdminProposalsTabProps {
  onPendingCountChange?: (count: number) => void;
}

export function AdminProposalsTab({ onPendingCountChange }: AdminProposalsTabProps) {
  const [proposals, setProposals] = useState<AdminProposalListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminProposalListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [items, pendingCount] = await Promise.all([
        adminListFamilyChangeProposals({
          statusFilter: statusFilter || null,
        }),
        adminCountPendingProposals(),
      ]);
      setProposals(items);
      onPendingCountChange?.(pendingCount);
    } catch (loadError) {
      setError(
        loadError instanceof ProposalServiceError
          ? loadError.message
          : "Не удалось загрузить предложения",
      );
    } finally {
      setIsLoading(false);
    }
  }, [onPendingCountChange, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = proposals.filter((item) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      (item.targetPersonName ?? "").toLowerCase().includes(needle) ||
      (item.submitterEmail ?? "").toLowerCase().includes(needle) ||
      proposalTypeLabel(item.proposalType).toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#D9D0C3] px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          <option value="pending">На проверке</option>
          <option value="needs_info">Нужно уточнение</option>
          <option value="approved">Принято</option>
          <option value="rejected">Отклонено</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по человеку или автору"
          className="flex-1 rounded-xl border border-[#D9D0C3] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-[#D9D0C3] px-3 py-2 text-sm"
        >
          Обновить
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-sm text-[#5C6B63]">Загрузка…</p> : null}

      <div className="space-y-2">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="w-full rounded-xl border border-[#E4DDD1] bg-white px-4 py-3 text-left"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-[#2D4A3E]">
                {proposalTypeLabel(item.proposalType)}
              </span>
              <ProposalStatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-sm text-[#5C6B63]">
              {item.targetPersonName ?? "Без привязки"} · {item.submitterEmail ?? "Автор"}
            </p>
          </button>
        ))}
        {!isLoading && filtered.length === 0 ? (
          <p className="text-sm text-[#5C6B63]">Нет предложений по фильтру.</p>
        ) : null}
      </div>

      <ProposalReviewDialog
        proposal={selected}
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        onReviewed={() => void load()}
      />
    </div>
  );
}
