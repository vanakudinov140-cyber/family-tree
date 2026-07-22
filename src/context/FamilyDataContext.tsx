"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getFamilyData,
  type FamilyData,
  type FamilyDataSource,
} from "@/services/family-service";
import type { FamilyRelationship, Person } from "@/types/family";

interface FamilyDataContextValue {
  people: Person[];
  relationships: FamilyRelationship[];
  /** @deprecated Use linkedPersonId */
  currentUserId: string;
  /** Person linked to the account, if any — never Auth uid / focus / selection. */
  linkedPersonId: string;
  source: FamilyDataSource | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<FamilyData | null>;
  getPersonById: (id: string) => Person | undefined;
}

const FamilyDataContext = createContext<FamilyDataContextValue | null>(null);

export function FamilyDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FamilyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadInFlight = useRef<Promise<FamilyData | null> | null>(null);
  const reloadTimer = useRef<number | null>(null);

  const load = useCallback(async (options?: { background?: boolean }) => {
    if (reloadInFlight.current) {
      return reloadInFlight.current;
    }

    const background = Boolean(options?.background);

    const run = (async (): Promise<FamilyData | null> => {
      if (!background) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const familyData = await getFamilyData();
        setData(familyData);
        return familyData;
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить данные семьи";
        setError(message);
        if (!background) {
          setData(null);
        }
        return null;
      } finally {
        setIsLoading(false);
        reloadInFlight.current = null;
      }
    })();

    reloadInFlight.current = run;
    return run;
  }, []);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current !== null) {
      window.clearTimeout(reloadTimer.current);
    }

    // Debounce bursty realtime events after batch imports.
    reloadTimer.current = window.setTimeout(() => {
      reloadTimer.current = null;
      void load({ background: true });
    }, 400);
  }, [load]);

  const reload = useCallback(async () => {
    if (reloadTimer.current !== null) {
      window.clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
    }
    return load({ background: false });
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    const channel = client
      .channel("family-data-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        () => {
          scheduleReload();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationships" },
        () => {
          scheduleReload();
        },
      )
      .subscribe();

    return () => {
      if (reloadTimer.current !== null) {
        window.clearTimeout(reloadTimer.current);
        reloadTimer.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [scheduleReload]);

  const peopleMap = useMemo(
    () => new Map((data?.people ?? []).map((person) => [person.id, person])),
    [data?.people],
  );

  const value = useMemo<FamilyDataContextValue>(
    () => ({
      people: data?.people ?? [],
      relationships: data?.relationships ?? [],
      currentUserId: data?.linkedPersonId ?? data?.currentUserId ?? "",
      linkedPersonId: data?.linkedPersonId ?? data?.currentUserId ?? "",
      source: data?.source ?? null,
      isLoading,
      error,
      reload,
      getPersonById: (id: string) => peopleMap.get(id),
    }),
    [data, error, isLoading, peopleMap, reload],
  );

  return (
    <FamilyDataContext.Provider value={value}>
      {children}
    </FamilyDataContext.Provider>
  );
}

export function useFamilyData(): FamilyDataContextValue {
  const context = useContext(FamilyDataContext);
  if (!context) {
    throw new Error("useFamilyData must be used within FamilyDataProvider");
  }
  return context;
}
