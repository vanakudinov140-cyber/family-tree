"use client";

import { useEffect, useState } from "react";

import { UserRoleDialog } from "@/components/admin/UserRoleDialog";
import { roleLabel } from "@/lib/permissions";
import {
  adminListUsers,
  ProposalServiceError,
} from "@/services/family-proposal-service";
import type { AdminUserListItem } from "@/types/family-proposal";

export function AdminUsersTab() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [selected, setSelected] = useState<AdminUserListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setUsers(await adminListUsers());
    } catch (loadError) {
      setError(
        loadError instanceof ProposalServiceError
          ? loadError.message
          : "Не удалось загрузить пользователей",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {isLoading ? <p className="text-sm text-[#5C6B63]">Загрузка…</p> : null}

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.userId}
            className="flex flex-col gap-2 rounded-xl border border-[#E4DDD1] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-[#2D4A3E]">{user.email ?? "Без email"}</p>
              <p className="text-sm text-[#5C6B63]">
                {roleLabel(user.role)}
                {user.confirmedAt ? " · email подтверждён" : " · email не подтверждён"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(user)}
              className="min-h-10 rounded-xl border border-[#D9D0C3] px-3 text-sm"
            >
              Изменить роль
            </button>
          </div>
        ))}
      </div>

      <UserRoleDialog
        user={selected}
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null);
          void load();
        }}
      />
    </div>
  );
}
