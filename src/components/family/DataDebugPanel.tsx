"use client";

import { useEffect, useState } from "react";

import { computeFamilyGraphStats } from "@/lib/family-graph-stats";
import { getVisiblePersonIds, type TreeViewMode } from "@/lib/tree-visibility";
import type { ImportPipelineCounts } from "@/lib/family-import-outcome";
import type { Person } from "@/types/family";

export type DataDebugImportSnapshot = ImportPipelineCounts | null;

interface DataDebugPanelProps {
  people: Person[];
  relationshipsCount: number;
  viewMode: TreeViewMode;
  focusedPersonId: string | null;
  importSnapshot: DataDebugImportSnapshot;
}

export function useDataDebugEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      setEnabled(false);
      return;
    }
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setEnabled(params.get("dataDebug") === "1");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  return enabled;
}

export function DataDebugPanel({
  people,
  relationshipsCount,
  viewMode,
  focusedPersonId,
  importSnapshot,
}: DataDebugPanelProps) {
  const enabled = useDataDebugEnabled();

  useEffect(() => {
    if (!enabled || process.env.NODE_ENV !== "development") return;
    const visibleIds = getVisiblePersonIds({
      mode: viewMode,
      focusId: focusedPersonId,
      people,
      collapsedPersonIds: new Set(),
    });
    const stats = computeFamilyGraphStats(
      people,
      relationshipsCount,
      focusedPersonId,
    );
    console.table({
      peopleLoaded: stats.peopleLoaded,
      relationshipsLoaded: stats.relationshipsLoaded,
      visiblePeople: visibleIds.size,
      connectedComponents: stats.connectedComponents,
      focusedComponentSize: stats.focusedComponentSize,
      parsedPeopleCount: importSnapshot?.parsedPeopleCount ?? 0,
      payloadPeopleCount: importSnapshot?.payloadPeopleCount ?? 0,
      createdPeopleCount: importSnapshot?.createdPeopleCount ?? 0,
      createdRelationshipsCount: importSnapshot?.createdRelationshipsCount ?? 0,
    });
  }, [
    enabled,
    focusedPersonId,
    importSnapshot,
    people,
    relationshipsCount,
    viewMode,
  ]);

  if (!enabled || process.env.NODE_ENV !== "development") {
    return null;
  }

  const visibleIds = getVisiblePersonIds({
    mode: viewMode,
    focusId: focusedPersonId,
    people,
    collapsedPersonIds: new Set(),
  });
  const stats = computeFamilyGraphStats(
    people,
    relationshipsCount,
    focusedPersonId,
  );

  return (
    <div className="pointer-events-none absolute left-2 top-2 z-[120] max-w-[240px] rounded-xl border border-[#D9D0C3] bg-[#FFFCF7]/95 px-3 py-2 text-[10px] leading-relaxed text-[#2D4A3E] shadow-md">
      <p className="font-semibold text-[#1B4332]">dataDebug</p>
      <p>people loaded: {stats.peopleLoaded}</p>
      <p>relationships loaded: {stats.relationshipsLoaded}</p>
      <p>visible people: {visibleIds.size}</p>
      <p>connected components: {stats.connectedComponents}</p>
      <p>focused component size: {stats.focusedComponentSize}</p>
      <p>isolated people: {stats.isolatedPeopleCount}</p>
      <p>viewMode: {viewMode}</p>
      {importSnapshot ? (
        <>
          <p className="mt-1 font-medium">import</p>
          <p>parsed people: {importSnapshot.parsedPeopleCount}</p>
          <p>created people: {importSnapshot.createdPeopleCount}</p>
          <p>created relationships: {importSnapshot.createdRelationshipsCount}</p>
        </>
      ) : null}
    </div>
  );
}
