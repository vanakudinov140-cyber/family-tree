"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import { AdminCollaborationDialog } from "@/components/admin/AdminCollaborationDialog";
import { FamilyImportDialog } from "@/components/admin/FamilyImportDialog";
import { MyProposalsDialog } from "@/components/collaboration/MyProposalsDialog";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/permissions";
import {
  FamilyImportError,
  downloadFamilyBackup,
} from "@/services/family-import-service";

const EDGE_PADDING = 12;
const GAP_BELOW = 8;
const MENU_WIDTH = 260;

interface MenuPosition {
  top: number;
  left: number;
}

function computeMenuPosition(buttonRect: DOMRect): MenuPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(MENU_WIDTH, viewportWidth - EDGE_PADDING * 2);

  let left = buttonRect.right - width;

  if (left < EDGE_PADDING) {
    left = EDGE_PADDING;
  }
  if (left + width > viewportWidth - EDGE_PADDING) {
    left = Math.max(EDGE_PADDING, viewportWidth - EDGE_PADDING - width);
  }

  let top = buttonRect.bottom + GAP_BELOW;
  const estimatedHeight = 280;
  if (top + estimatedHeight > viewportHeight - EDGE_PADDING) {
    const above = buttonRect.top - GAP_BELOW - estimatedHeight;
    if (above >= EDGE_PADDING) {
      top = above;
    } else {
      top = Math.max(
        EDGE_PADDING,
        viewportHeight - EDGE_PADDING - estimatedHeight,
      );
    }
  }

  return { top, left };
}

export function UserMenu() {
  const {
    user,
    profile,
    role,
    signOut,
    isLoading,
    canImportFamily,
    canSuggestChanges,
    canReviewProposals,
    roleChangedNotice,
    clearRoleChangedNotice,
  } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [myProposalsOpen, setMyProposalsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    setPosition(computeMenuPosition(button.getBoundingClientRect()));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
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
  }, [isOpen]);

  if (!user) {
    return null;
  }

  const displayName =
    profile?.full_name?.trim() ||
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "") ||
    user.email ||
    "Пользователь";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setIsOpen(false);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleBackup = async () => {
    setBackupError(null);
    setIsBackupLoading(true);
    try {
      await downloadFamilyBackup();
      setIsOpen(false);
    } catch (error) {
      setBackupError(
        error instanceof FamilyImportError || error instanceof Error
          ? error.message
          : "Не удалось скачать копию",
      );
    } finally {
      setIsBackupLoading(false);
    }
  };

  const menuStyle: CSSProperties | undefined = position
    ? {
        position: "fixed",
        top: position.top,
        left: position.left,
        width: Math.min(MENU_WIDTH, window.innerWidth - EDGE_PADDING * 2),
        zIndex: 250,
        borderRadius: 16,
        border: "1px solid #D9D0C3",
        background: "#FFFCF7",
        boxShadow: "0 12px 32px rgba(27, 67, 50, 0.16)",
        padding: 12,
      }
    : undefined;

  const menu =
    mounted && isOpen && position ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Меню пользователя"
        className="user-menu-dropdown"
        style={menuStyle}
      >
        <p className="truncate text-sm font-medium text-[#1B4332]">
          {displayName}
        </p>
        {user.email ? (
          <p className="mt-0.5 truncate text-xs text-[#6B776F]">{user.email}</p>
        ) : null}
        <p className="mt-2 text-xs text-[#5C6B63]">
          Роль: {roleLabel(role)}
        </p>

        {roleChangedNotice ? (
          <p className="mt-2 rounded-lg border border-[#E8D4A8] bg-[#FFF6E8] px-2 py-1 text-xs text-[#7A5A1E]">
            {roleChangedNotice}
            <button
              type="button"
              className="ml-2 underline"
              onClick={clearRoleChangedNotice}
            >
              OK
            </button>
          </p>
        ) : null}

        {canSuggestChanges ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              setMyProposalsOpen(true);
            }}
            className="mt-3 flex min-h-10 w-full items-center justify-center rounded-xl border border-[#D9D0C3] bg-white px-3 text-sm font-medium text-[#2D4A3E] transition hover:border-[#C4A962]"
          >
            Мои предложения
          </button>
        ) : null}

        {canReviewProposals ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              setAdminOpen(true);
            }}
            className="mt-2 flex min-h-10 w-full items-center justify-center rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-3 text-sm font-medium text-[#F5F0E8] transition hover:bg-[#1B4332]"
          >
            Администрирование
          </button>
        ) : null}

        {canImportFamily ? (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                setImportOpen(true);
              }}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-[#D9D0C3] bg-white px-3 text-sm font-medium text-[#2D4A3E] transition hover:border-[#C4A962]"
            >
              Импорт семьи
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={isBackupLoading}
              onClick={() => void handleBackup()}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-[#D9D0C3] bg-white px-3 text-sm font-medium text-[#2D4A3E] transition hover:border-[#C4A962] disabled:opacity-60"
            >
              {isBackupLoading ? "Подготовка…" : "Скачать резервную копию"}
            </button>
            {backupError ? (
              <p className="text-xs text-[#8B3A2F]">{backupError}</p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          role="menuitem"
          disabled={isSigningOut || isLoading}
          onClick={() => void handleSignOut()}
          className="mt-3 flex min-h-10 w-full items-center justify-center rounded-xl border border-[#D9D0C3] bg-white px-3 text-sm font-medium text-[#2D4A3E] transition hover:border-[#C4A962] disabled:opacity-60"
        >
          {isSigningOut ? "Выход…" : "Выйти"}
        </button>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex max-w-[160px] items-center gap-2 rounded-xl border border-[#D9D0C3] bg-[#FFFCF7] px-3 py-2 text-left text-sm text-[#2D4A3E] transition hover:border-[#C4A962] sm:max-w-[220px]"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="min-w-0 truncate font-medium">{displayName}</span>
      </button>

      {menu ? createPortal(menu, document.body) : null}
      <FamilyImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
      <AdminCollaborationDialog
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
      />
      <MyProposalsDialog
        isOpen={myProposalsOpen}
        onClose={() => setMyProposalsOpen(false)}
      />
    </>
  );
}
