import type { ProposalStatus } from "@/types/family-proposal";

const LABELS: Record<ProposalStatus, string> = {
  pending: "На проверке",
  needs_info: "Нужно уточнение",
  approved: "Принято",
  rejected: "Отклонено",
  cancelled: "Отменено",
};

const STYLES: Record<ProposalStatus, string> = {
  pending: "bg-[#F3EEE4] text-[#5C4A2E] border-[#D9D0C3]",
  needs_info: "bg-[#FFF6E8] text-[#7A5A1E] border-[#E8D4A8]",
  approved: "bg-[#E8F2EC] text-[#1B4332] border-[#B8D4C4]",
  rejected: "bg-[#FBF4F1] text-[#7A3E32] border-[#E8C9C0]",
  cancelled: "bg-[#F5F5F5] text-[#6B776F] border-[#D9D0C3]",
};

export function proposalStatusLabel(status: ProposalStatus): string {
  return LABELS[status];
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export function proposalTypeLabel(type: string): string {
  switch (type) {
    case "person_update":
      return "Исправление сведений";
    case "person_create":
      return "Новый родственник";
    case "relationship_create":
      return "Новая связь";
    case "relationship_update":
      return "Изменение связи";
    case "photo_replace":
      return "Фотография";
    default:
      return type;
  }
}
