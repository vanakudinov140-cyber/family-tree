"use client";

import { useEffect, useState } from "react";

import { proposalTypeLabel, ProposalStatusBadge } from "@/components/collaboration/ProposalStatusBadge";
import { getFullName } from "@/data/family";
import { getProposalMessages } from "@/services/family-proposal-service";
import type { FamilyChangeProposal, ProposalMessage } from "@/types/family-proposal";
import type { Person } from "@/types/family";

interface ProposalDetailsProps {
  proposal: FamilyChangeProposal;
  people?: Person[];
}

export function ProposalDetails({ proposal, people = [] }: ProposalDetailsProps) {
  const [messages, setMessages] = useState<ProposalMessage[]>([]);

  useEffect(() => {
    void getProposalMessages(proposal.id)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [proposal.id]);

  const targetName = proposal.targetPersonId
    ? people.find((item) => item.id === proposal.targetPersonId)
    : null;

  return (
    <div className="space-y-3 text-sm text-[#2D4A3E]">
      <div className="flex flex-wrap items-center gap-2">
        <ProposalStatusBadge status={proposal.status} />
        <span className="text-[#5C6B63]">{proposalTypeLabel(proposal.proposalType)}</span>
      </div>

      {targetName ? (
        <p>
          Человек: <span className="font-medium">{getFullName(targetName)}</span>
        </p>
      ) : null}

      {proposal.reason ? (
        <div className="rounded-xl border border-[#E4DDD1] bg-[#FAF7F1] p-3">
          <p className="text-xs font-medium text-[#5C6B63]">Комментарий</p>
          <p className="mt-1 whitespace-pre-wrap">{proposal.reason}</p>
        </div>
      ) : null}

      {proposal.sourceNote ? (
        <div className="rounded-xl border border-[#E4DDD1] bg-[#FAF7F1] p-3">
          <p className="text-xs font-medium text-[#5C6B63]">Источник</p>
          <p className="mt-1 whitespace-pre-wrap">{proposal.sourceNote}</p>
        </div>
      ) : null}

      {proposal.adminComment ? (
        <div className="rounded-xl border border-[#E8C9C0] bg-[#FBF4F1] p-3">
          <p className="text-xs font-medium text-[#7A3E32]">Ответ администратора</p>
          <p className="mt-1 whitespace-pre-wrap">{proposal.adminComment}</p>
        </div>
      ) : null}

      <details className="rounded-xl border border-[#E4DDD1] bg-white p-3">
        <summary className="cursor-pointer font-medium">Предлагаемые данные</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-[#5C6B63]">
          {JSON.stringify(proposal.payload, null, 2)}
        </pre>
      </details>

      {messages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#5C6B63]">Переписка</p>
          {messages.map((message) => (
            <div
              key={message.id}
              className="rounded-xl border border-[#E4DDD1] bg-[#FFFCF7] p-2.5 text-xs"
            >
              <p className="whitespace-pre-wrap">{message.message}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
