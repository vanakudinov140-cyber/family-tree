"use client";

import { Trees } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AuthButton } from "@/components/auth/AuthButton";
import {
  FamilyTree,
  type FamilyTreeHandle,
} from "@/components/FamilyTree";
import { FamilyLoadingState } from "@/components/FamilyLoadingState";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { PersonDetails } from "@/components/PersonDetails";
import { PersonProfileModal } from "@/components/family/PersonProfileModal";
import { SearchBar } from "@/components/SearchBar";
import { useFamilyData } from "@/context/FamilyDataContext";
import { getFullName } from "@/data/family";
import {
  readStoredVisualMode,
  TREE_VISUAL_MODE_STORAGE_KEY,
  type TreeVisualMode,
} from "@/lib/heritage-theme";
import { DataDebugPanel } from "@/components/family/DataDebugPanel";
import { ViewDebugPanel } from "@/components/family/ViewDebugPanel";
import { IMPORT_DEBUG_STORAGE_KEY } from "@/components/admin/FamilyImportDialog";
import { isPersonVisibleInMode } from "@/lib/family-graph-stats";
import type { ImportPipelineCounts } from "@/lib/family-import-outcome";
import {
  buildPersonIndex,
  getCollapseIdsHidingPerson,
  type TreeViewMode,
} from "@/lib/tree-visibility";

import type { Person } from "@/types/family";

const VIEW_MODE_STORAGE_KEY = "family-tree-view-mode";
const COLLAPSED_STORAGE_KEY = "family-tree-collapsed-ids";
const FOCUSED_STORAGE_KEY = "family-tree-focused-person-id";

const REMOVED_TEST_PERSON_IDS = new Set([
  "77777777-7777-4777-8777-777777777777",
]);
const REMOVED_TEST_EXTERNAL_KEYS = new Set(["demid-tretyakov"]);

function isRemovedTestPersonRef(value: string): boolean {
  return (
    REMOVED_TEST_PERSON_IDS.has(value) ||
    REMOVED_TEST_EXTERNAL_KEYS.has(value)
  );
}

function pickSafeExistingPersonId(
  peopleList: Person[],
  preferredId: string,
): string | null {
  if (
    preferredId &&
    peopleList.some((person) => person.id === preferredId) &&
    !isRemovedTestPersonRef(preferredId)
  ) {
    return preferredId;
  }
  const firstValid = peopleList.find(
    (person) => !isRemovedTestPersonRef(person.id),
  );
  return firstValid?.id ?? null;
}

function isTreeViewMode(value: string | null): value is TreeViewMode {
  return (
    value === "nearby" ||
    value === "generations" ||
    value === "branch" ||
    value === "all"
  );
}

function readStoredViewMode(): TreeViewMode | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return isTreeViewMode(raw) ? raw : null;
}

function readStoredCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function HomePageContent() {
  const treeRef = useRef<FamilyTreeHandle>(null);
  const pendingFocusId = useRef<string | null>(null);
  const centerRequestRef = useRef(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    people,
    relationships,
    currentUserId,
    source,
    isLoading,
    error,
    reload,
    getPersonById,
  } = useFamilyData();

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<TreeViewMode>("nearby");
  const [visualMode, setVisualMode] = useState<TreeVisualMode>("heritage");
  const [collapsedPersonIds, setCollapsedPersonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchFlashPersonId, setSearchFlashPersonId] = useState<string | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [fullProfilePersonId, setFullProfilePersonId] = useState<string | null>(
    null,
  );
  const [isMobile, setIsMobile] = useState(false);
  const [isTreeOnly, setIsTreeOnly] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [importDebugSnapshot, setImportDebugSnapshot] =
    useState<ImportPipelineCounts | null>(null);
  const urlAppliedRef = useRef(false);

  const selectedPerson = selectedPersonId
    ? getPersonById(selectedPersonId)
    : undefined;
  const fullProfilePerson = fullProfilePersonId
    ? getPersonById(fullProfilePersonId)
    : undefined;
  const focusedPerson = focusedPersonId
    ? getPersonById(focusedPersonId)
    : undefined;

  const focusLabel = focusedPerson ? getFullName(focusedPerson) : null;
  const focusLabelShort = focusedPerson
    ? focusedPerson.firstName
    : null;

  const peopleByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) {
      map.set(person.id, person.id);
      if (person.externalKey) {
        map.set(person.externalKey, person.id);
      }
    }
    return map;
  }, [people]);

  const scheduleCenter = useCallback(
    (personId: string, options?: { search?: boolean }) => {
      const token = ++centerRequestRef.current;
      window.setTimeout(() => {
        if (token !== centerRequestRef.current) {
          return;
        }
        treeRef.current?.focusPerson(personId, options);
      }, 180);
    },
    [],
  );

  useEffect(() => {
    const storedMode = readStoredViewMode();
    const storedCollapsed = readStoredCollapsed();
    const storedFocus = window.localStorage.getItem(FOCUSED_STORAGE_KEY);

    setCollapsedPersonIds(storedCollapsed);
    if (storedMode) {
      setViewMode(storedMode);
    }
    setVisualMode(readStoredVisualMode());
    if (storedFocus) {
      if (isRemovedTestPersonRef(storedFocus)) {
        window.localStorage.removeItem(FOCUSED_STORAGE_KEY);
      } else {
        setFocusedPersonId(storedFocus);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(IMPORT_DEBUG_STORAGE_KEY);
      if (!raw) return;
      setImportDebugSnapshot(JSON.parse(raw) as ImportPipelineCounts);
    } catch {
      setImportDebugSnapshot(null);
    }
  }, [people.length, relationships.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const updateViewport = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      source === "local" &&
      !isLoading
    ) {
      setToastMessage("Используются локальные тестовые данные");
    }
  }, [isLoading, source]);

  useEffect(() => {
    if (!hydrated || isLoading || people.length === 0 || urlAppliedRef.current) {
      return;
    }

    const personParam = searchParams.get("person");
    const viewParam = searchParams.get("view");

    if (isTreeViewMode(viewParam)) {
      setViewMode(viewParam);
    } else if (!readStoredViewMode()) {
      const initialFocus =
        (personParam && peopleByKey.get(personParam)) ||
        currentUserId ||
        people[0]?.id ||
        null;
      setViewMode(initialFocus ? "nearby" : "all");
    }

    if (personParam) {
      if (isRemovedTestPersonRef(personParam)) {
        const fallback = pickSafeExistingPersonId(people, currentUserId);
        setFocusedPersonId(fallback);
        setSelectedPersonId(null);
      } else {
        const resolved = peopleByKey.get(personParam);
        if (resolved) {
          setFocusedPersonId(resolved);
          setSelectedPersonId(resolved);
        } else {
          const fallback = pickSafeExistingPersonId(people, currentUserId);
          setFocusedPersonId(fallback);
          setSelectedPersonId(null);
        }
      }
    } else if (!window.localStorage.getItem(FOCUSED_STORAGE_KEY)) {
      const fallback =
        pickSafeExistingPersonId(people, currentUserId) ||
        people[0]?.id ||
        null;
      setFocusedPersonId(fallback);
    }

    urlAppliedRef.current = true;
  }, [
    currentUserId,
    hydrated,
    isLoading,
    people,
    peopleByKey,
    searchParams,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [hydrated, viewMode]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TREE_VISUAL_MODE_STORAGE_KEY, visualMode);
    document.documentElement.dataset.treeVisual = visualMode;
  }, [hydrated, visualMode]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      COLLAPSED_STORAGE_KEY,
      JSON.stringify([...collapsedPersonIds]),
    );
  }, [collapsedPersonIds, hydrated]);

  useEffect(() => {
    if (!hydrated || !focusedPersonId) return;
    window.localStorage.setItem(FOCUSED_STORAGE_KEY, focusedPersonId);
  }, [focusedPersonId, hydrated]);

  useEffect(() => {
    if (!hydrated || !urlAppliedRef.current) return;

    const params = new URLSearchParams(searchParams.toString());
    if (focusedPersonId) {
      const focused = people.find((person) => person.id === focusedPersonId);
      params.set(
        "person",
        focused?.externalKey ?? focusedPersonId,
      );
    } else {
      params.delete("person");
    }
    params.set("view", viewMode);

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `/?${next}` : "/", { scroll: false });
    }
  }, [focusedPersonId, hydrated, people, router, searchParams, viewMode]);

  useEffect(() => {
    const focusId = pendingFocusId.current;
    if (!focusId || isLoading) {
      return;
    }

    if (!people.some((person) => person.id === focusId)) {
      return;
    }

    pendingFocusId.current = null;
    setSelectedPersonId(focusId);
    setFocusedPersonId(focusId);
    scheduleCenter(focusId);

    return () => {
      centerRequestRef.current += 1;
    };
  }, [isLoading, people, scheduleCenter]);

  useEffect(() => {
    if (selectedPersonId && !people.some((person) => person.id === selectedPersonId)) {
      setSelectedPersonId(null);
    }

    setCollapsedPersonIds((current) => {
      const next = new Set(
        [...current].filter((id) => people.some((person) => person.id === id)),
      );
      return next.size === current.size ? current : next;
    });

    if (focusedPersonId && !people.some((person) => person.id === focusedPersonId)) {
      const fallback = pickSafeExistingPersonId(people, currentUserId);
      setFocusedPersonId(fallback);
    }

    if (
      focusedPersonId &&
      isRemovedTestPersonRef(focusedPersonId)
    ) {
      const fallback = pickSafeExistingPersonId(people, currentUserId);
      setFocusedPersonId(fallback);
      setSelectedPersonId(null);
      window.localStorage.removeItem(FOCUSED_STORAGE_KEY);
    }
  }, [currentUserId, focusedPersonId, people, selectedPersonId]);

  useEffect(() => {
    if (!searchFlashPersonId) return;
    const timeoutId = window.setTimeout(() => {
      setSearchFlashPersonId(null);
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [searchFlashPersonId]);

  const revealPersonIfCollapsed = useCallback(
    (personId: string) => {
      const index = buildPersonIndex(people);
      const hiding = getCollapseIdsHidingPerson(
        personId,
        collapsedPersonIds,
        index,
      );
      if (hiding.length === 0) return;
      setCollapsedPersonIds((current) => {
        const next = new Set(current);
        for (const id of hiding) {
          next.delete(id);
        }
        return next;
      });
    },
    [collapsedPersonIds, people],
  );

  const handleSelectPerson = useCallback(
    (personId: string) => {
      revealPersonIfCollapsed(personId);
      setSelectedPersonId(personId);
      // Click only opens profile — does not change tree center.
    },
    [revealPersonIfCollapsed],
  );

  const handleSearchSelect = useCallback(
    (personId: string) => {
      revealPersonIfCollapsed(personId);
      if (!isPersonVisibleInMode(personId, viewMode, focusedPersonId, people)) {
        setViewMode("all");
      }
      setFocusedPersonId(personId);
      setSelectedPersonId(personId);
      setSearchFlashPersonId(personId);
      scheduleCenter(personId, { search: true });
    },
    [focusedPersonId, people, revealPersonIfCollapsed, scheduleCenter, viewMode],
  );

  const handleMakeCenter = useCallback(
    (personId: string) => {
      revealPersonIfCollapsed(personId);
      setSelectedPersonId(personId);
      setFocusedPersonId(personId);
      scheduleCenter(personId);
    },
    [revealPersonIfCollapsed, scheduleCenter],
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedPersonId(null);
  }, []);

  const handleOpenFullProfile = useCallback((personId: string) => {
    setFullProfilePersonId(personId);
  }, []);

  const handleCloseFullProfile = useCallback(() => {
    setFullProfilePersonId(null);
  }, []);

  const handleRelativeCreated = useCallback((personId: string) => {
    pendingFocusId.current = personId;
    setToastMessage("Родственник добавлен");
  }, []);

  const handlePersonUpdated = useCallback((personId: string) => {
    pendingFocusId.current = personId;
    setToastMessage("Данные сохранены");
  }, []);

  const handlePersonDeleted = useCallback(
    (nextFocusPersonId: string | null) => {
      setSelectedPersonId(null);
      setToastMessage("Человек удалён");
      if (nextFocusPersonId) {
        setFocusedPersonId(nextFocusPersonId);
        pendingFocusId.current = nextFocusPersonId;
        scheduleCenter(nextFocusPersonId);
      } else {
        setFocusedPersonId(null);
      }
    },
    [scheduleCenter],
  );

  const handleToggleTreeOnly = useCallback(() => {
    setIsTreeOnly((current) => !current);
  }, []);

  const handleModeActivate = useCallback(
    (mode: TreeViewMode) => {
      if (mode === "all") {
        setViewMode("all");
        return;
      }

      const nextFocus = selectedPersonId ?? focusedPersonId;
      if (!nextFocus) {
        setViewMode(mode);
        return;
      }

      const sameFocus = nextFocus === focusedPersonId;
      const sameMode = mode === viewMode;

      setFocusedPersonId(nextFocus);
      setViewMode(mode);

      if (sameFocus && sameMode) {
        scheduleCenter(nextFocus);
        return;
      }

      scheduleCenter(nextFocus);
    },
    [focusedPersonId, scheduleCenter, selectedPersonId, viewMode],
  );

  const handleVisualModeChange = useCallback((mode: TreeVisualMode) => {
    setVisualMode(mode);
  }, []);

  const handleToggleCollapse = useCallback((personId: string) => {
    setCollapsedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setCollapsedPersonIds(new Set());
  }, []);

  const handleRetry = useCallback(() => {
    void reload();
  }, [reload]);

  const showTree = !error && people.length > 0 && hydrated;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#F3EDE3] text-[#1B4332]">
      {!isTreeOnly ? (
        <header className="shrink-0 border-b border-[#E4DDD1]/80 bg-[#FAF7F1]/92 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2.5 px-3 py-3 sm:px-5 sm:py-3.5 lg:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2D4A3E] text-[#F5F0E8] shadow-sm sm:h-10 sm:w-10">
                <Trees className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight text-[#1B4332] sm:text-2xl">
                  Наша семья
                </h1>
                <p className="truncate text-xs text-[#5C6B63] sm:text-sm">
                  История семьи в лицах и воспоминаниях
                </p>
              </div>
              <div className="shrink-0">
                <AuthButton />
              </div>
            </div>
            <SearchBar
              people={people}
              onSelectPerson={handleSearchSelect}
              highlightedPersonId={selectedPersonId ?? focusedPersonId}
            />
          </div>
        </header>
      ) : null}

      <main
        className={[
          "relative mx-auto flex min-h-0 w-full flex-1 flex-col transition-all duration-300",
          isTreeOnly
            ? "max-w-none px-0 pb-0 pt-0"
            : "max-w-[1600px] px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-2.5 lg:px-5",
        ].join(" ")}
      >
        <div
          className={[
            "relative h-full min-h-0 w-full overflow-hidden bg-[#F3EDE3] transition-all duration-300 ease-out",
            isTreeOnly
              ? "rounded-none border-0"
              : "rounded-[22px] border border-[#E0D6C6] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
            selectedPerson && !isMobile && !isTreeOnly ? "md:mr-[360px]" : "",
          ].join(" ")}
        >
          {showTree ? (
            <>
              <DataDebugPanel
                people={people}
                relationshipsCount={relationships.length}
                viewMode={viewMode}
                focusedPersonId={focusedPersonId}
                importSnapshot={importDebugSnapshot}
              />
              <ViewDebugPanel
                people={people}
                viewMode={viewMode}
                focusedPersonId={focusedPersonId}
              />
              <FamilyTree
              ref={treeRef}
              people={people}
              currentUserId={currentUserId}
              focusedPersonId={focusedPersonId}
              selectedPersonId={selectedPersonId}
              viewMode={viewMode}
              collapsedPersonIds={collapsedPersonIds}
              searchFlashPersonId={searchFlashPersonId}
              focusLabel={focusLabel}
              focusLabelShort={focusLabelShort}
              visualMode={visualMode}
              onVisualModeChange={handleVisualModeChange}
              onSelectPerson={handleSelectPerson}
              onMakeCenter={handleMakeCenter}
              onModeActivate={handleModeActivate}
              onToggleCollapse={handleToggleCollapse}
              onExpandAll={handleExpandAll}
              isTreeOnly={isTreeOnly}
              onToggleTreeOnly={handleToggleTreeOnly}
            />
            </>
          ) : null}

          <FamilyLoadingState
            isLoading={(isLoading && people.length === 0) || !hydrated}
            error={error}
            onRetry={handleRetry}
          />
        </div>
      </main>

      {selectedPerson && !isMobile ? (
        <aside className="fixed inset-y-0 right-0 z-30 hidden w-[360px] animate-panel-in border-l border-[#D9D0C3] bg-[#FFFCF7] shadow-xl md:block">
          <PersonDetails
            person={selectedPerson}
            people={people}
            focusedPersonId={focusedPersonId}
            onClose={handleCloseDetails}
            onSelectRelative={handleSelectPerson}
            onOpenFullProfile={handleOpenFullProfile}
            onRelativeCreated={handleRelativeCreated}
            onPersonUpdated={handlePersonUpdated}
            onPersonDeleted={handlePersonDeleted}
            onMakeCenter={handleMakeCenter}
            isFocusedCenter={focusedPersonId === selectedPerson.id}
            variant="sidebar"
          />
        </aside>
      ) : null}

      <MobileBottomSheet
        isOpen={Boolean(selectedPerson && isMobile)}
        onClose={handleCloseDetails}
      >
        {selectedPerson ? (
          <PersonDetails
            person={selectedPerson}
            people={people}
            focusedPersonId={focusedPersonId}
            onClose={handleCloseDetails}
            onSelectRelative={handleSelectPerson}
            onOpenFullProfile={handleOpenFullProfile}
            onRelativeCreated={handleRelativeCreated}
            onPersonUpdated={handlePersonUpdated}
            onPersonDeleted={handlePersonDeleted}
            onMakeCenter={handleMakeCenter}
            isFocusedCenter={focusedPersonId === selectedPerson.id}
            variant="sheet"
          />
        ) : null}
      </MobileBottomSheet>

      <PersonProfileModal
        isOpen={Boolean(fullProfilePerson)}
        title="Полный профиль"
        onClose={handleCloseFullProfile}
        personId={fullProfilePersonId}
      >
        {fullProfilePerson ? (
          <PersonDetails
            person={fullProfilePerson}
            people={people}
            focusedPersonId={focusedPersonId}
            onClose={handleCloseFullProfile}
            onSelectRelative={(personId) => {
              handleCloseFullProfile();
              handleSelectPerson(personId);
            }}
            onRelativeCreated={handleRelativeCreated}
            onPersonUpdated={handlePersonUpdated}
            onPersonDeleted={(nextFocus) => {
              handleCloseFullProfile();
              handlePersonDeleted(nextFocus);
            }}
            onMakeCenter={handleMakeCenter}
            isFocusedCenter={focusedPersonId === fullProfilePerson.id}
            variant="modal"
            showOpenProfileButton={false}
          />
        ) : null}
      </PersonProfileModal>

      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-2xl border border-[#D9D0C3] bg-[#FFFCF7] px-4 py-3 text-sm text-[#2D4A3E] shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-[#F3EDE3] text-sm text-[#5C6B63]">
          Загрузка…
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
