"use client";

import { useEffect, useMemo, useState } from "react";

import {
  assertFamilyViewNesting,
  buildFamilyViewPersonIds,
  getFamilyViewModeCounts,
  selectFamilyViewIds,
} from "@/lib/family-view-visibility";
import type { TreeViewMode } from "@/lib/tree-visibility";
import type { Person } from "@/types/family";

interface ViewDebugPanelProps {
  people: Person[];
  viewMode: TreeViewMode;
  focusedPersonId: string | null;
}

export function useViewDebugEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      setEnabled(false);
      return;
    }
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setEnabled(params.get("viewDebug") === "1");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  return enabled;
}

export function ViewDebugPanel({
  people,
  viewMode,
  focusedPersonId,
}: ViewDebugPanelProps) {
  const enabled = useViewDebugEnabled();

  const visibility = useMemo(
    () =>
      buildFamilyViewPersonIds({
        focusedPersonId,
        people,
      }),
    [focusedPersonId, people],
  );

  const counts = useMemo(
    () => getFamilyViewModeCounts(visibility),
    [visibility],
  );

  const nesting = useMemo(
    () =>
      assertFamilyViewNesting({
        nearbyIds: visibility.nearbyIds,
        generationsIds: visibility.generationsIds,
        branchIds: visibility.branchIds,
        allIds: visibility.allIds,
      }),
    [visibility],
  );

  const currentCount = selectFamilyViewIds(visibility, viewMode).size;

  useEffect(() => {
    if (!enabled || process.env.NODE_ENV !== "development") return;
    const rows = [...visibility.reasons.entries()].map(
      ([personId, includedBy]) => ({
        personId,
        includedBy,
      }),
    );
    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.table({
      peopleLoaded: people.length,
      nearby: counts.nearby,
      generations: counts.generations,
      branch: counts.branch,
      all: counts.all,
      currentMode: viewMode,
      currentCount,
      nestedOk: nesting.ok,
      focusedComponentSize: visibility.focusedComponentSize,
      connectedComponents: visibility.connectedComponentCount,
    });
  }, [
    counts,
    currentCount,
    enabled,
    nesting.ok,
    people.length,
    viewMode,
    visibility,
  ]);

  if (!enabled || process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-[120] max-w-[260px] rounded-xl border border-[#D9D0C3] bg-[#FFFCF7]/95 px-3 py-2 text-[10px] leading-relaxed text-[#2D4A3E] shadow-md">
      <p className="font-semibold text-[#1B4332]">viewDebug</p>
      <p>people loaded: {people.length}</p>
      <p>nearby: {counts.nearby}</p>
      <p>generations: {counts.generations}</p>
      <p>branch: {counts.branch}</p>
      <p>all: {counts.all}</p>
      <p>
        current ({viewMode}): {currentCount}
      </p>
      <p>nearby⊆generations: {nesting.ok ? "yes" : "NO"}</p>
      <p>
        generations⊆branch:{" "}
        {[...visibility.generationsIds].every((id) =>
          visibility.branchIds.has(id),
        )
          ? "yes"
          : "NO"}
      </p>
      <p>
        branch⊆all:{" "}
        {[...visibility.branchIds].every((id) => visibility.allIds.has(id))
          ? "yes"
          : "NO"}
      </p>
      <p>focused component: {visibility.focusedComponentSize}</p>
      <p>components: {visibility.connectedComponentCount}</p>
      {!nesting.ok ? (
        <p className="mt-1 text-[#8B3A3A]">{nesting.failures.join("; ")}</p>
      ) : null}
    </div>
  );
}
