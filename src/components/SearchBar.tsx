"use client";

import { Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import { getFullName } from "@/data/family";
import type { Person } from "@/types/family";

interface SearchBarProps {
  people: Person[];
  onSelectPerson: (personId: string) => void;
  highlightedPersonId?: string | null;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const EDGE_PADDING = 12;
const GAP_BELOW_INPUT = 8;

function computeDropdownPosition(
  inputRect: DOMRect,
): DropdownPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isMobile = viewportWidth < 768;

  const preferredWidth = inputRect.width;
  const maxAllowedWidth = Math.max(
    0,
    viewportWidth - EDGE_PADDING * 2,
  );
  const width = Math.min(preferredWidth, maxAllowedWidth);

  let left = inputRect.left;
  if (left + width > viewportWidth - EDGE_PADDING) {
    left = viewportWidth - EDGE_PADDING - width;
  }
  left = Math.max(EDGE_PADDING, left);

  const top = inputRect.bottom + GAP_BELOW_INPUT;
  const spaceBelow = viewportHeight - top - EDGE_PADDING;
  const hardCap = isMobile
    ? Math.min(320, viewportHeight * 0.5)
    : 320;
  const maxHeight = Math.max(120, Math.min(hardCap, spaceBelow));

  return { top, left, width, maxHeight };
}

export function SearchBar({
  people,
  onSelectPerson,
  highlightedPersonId,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return people.filter((person) => {
      const fullName = getFullName(person).toLowerCase();
      const shortName = `${person.firstName} ${person.lastName || person.middleName || ""}`
        .toLowerCase()
        .trim();
      return (
        fullName.includes(normalizedQuery) ||
        shortName.includes(normalizedQuery)
      );
    });
  }, [people, query]);

  const showDropdown = isOpen && query.trim().length > 0;

  const updatePosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    setPosition(computeDropdownPosition(input.getBoundingClientRect()));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!showDropdown) {
      return;
    }
    updatePosition();
  }, [showDropdown, query, results.length, updatePosition]);

  useEffect(() => {
    if (!showDropdown) {
      return;
    }

    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [showDropdown, updatePosition]);

  useEffect(() => {
    if (!showDropdown) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) {
        return;
      }
      if (listRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDropdown]);

  useEffect(() => {
    if (highlightedPersonId) {
      const person = people.find((item) => item.id === highlightedPersonId);
      if (person) {
        setQuery(getFullName(person));
        setIsOpen(false);
      }
    }
  }, [highlightedPersonId, people]);

  const handleSelect = (person: Person) => {
    setQuery(getFullName(person));
    setIsOpen(false);
    onSelectPerson(person.id);
  };

  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const dropdownStyle: CSSProperties | undefined = position
    ? {
        position: "fixed",
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        zIndex: 200,
        overflowY: "auto",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        borderRadius: 16,
        border: "1px solid #D9D0C3",
        background: "#FFFCF7",
        boxShadow: "0 12px 32px rgba(27, 67, 50, 0.16)",
      }
    : undefined;

  const dropdown =
    mounted && showDropdown && position ? (
      <div
        ref={listRef}
        role="listbox"
        aria-label="Результаты поиска"
        className="search-results-dropdown"
        style={dropdownStyle}
      >
        {results.length === 0 ? (
          <div className="px-4 py-3 text-sm text-[#6B776F]">
            Родственники не найдены
          </div>
        ) : (
          <ul className="py-1.5">
            {results.map((person) => (
              <li key={person.id} role="option">
                <button
                  type="button"
                  onClick={() => handleSelect(person)}
                  className="flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#F3EEE4] active:bg-[#EDE8DF]"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF3EF] text-xs font-semibold text-[#2D4A3E]">
                    {person.firstName.charAt(0)}
                    {(person.lastName || person.middleName || "").charAt(0)}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-[#1B4332]">
                      {getFullName(person)}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6B776F]">
                      {person.relationshipLabel}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    ) : null;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <label htmlFor="family-search" className="sr-only">
        Поиск родственника
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7A877F]" />
        <input
          ref={inputRef}
          id="family-search"
          type="text"
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            setIsOpen(nextValue.trim().length > 0);
          }}
          onFocus={() => {
            if (query.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder="Найти родственника по имени..."
          className="h-11 w-full rounded-2xl border border-[#D9D0C3] bg-[#FFFCF7] py-2.5 pl-12 pr-12 text-sm text-[#1B4332] shadow-sm outline-none transition focus:border-[#C4A962] focus:ring-2 focus:ring-[#C4A962]/25"
          autoComplete="off"
          enterKeyHint="search"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#7A877F] transition hover:bg-[#EDE8DF] hover:text-[#2D4A3E]"
            aria-label="Очистить поиск"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
