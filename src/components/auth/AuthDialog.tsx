"use client";

import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/context/AuthContext";
import { AuthServiceError } from "@/services/auth-service";

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "signin" | "signup";
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  overflow: "hidden",
  overscrollBehavior: "none",
};

const backdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  border: "none",
  padding: 0,
  margin: 0,
  background: "rgba(27, 67, 50, 0.35)",
  backdropFilter: "blur(1px)",
  cursor: "pointer",
};

const panelStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  width: "min(480px, calc(100vw - 32px))",
  maxHeight: "calc(100dvh - 32px)",
  overflow: "hidden",
  borderRadius: 24,
  border: "1px solid #D9D0C3",
  background: "#FFFCF7",
  boxShadow: "0 25px 50px -12px rgba(27, 67, 50, 0.25)",
};

const headerStyle: CSSProperties = {
  flexShrink: 0,
  borderBottom: "1px solid #EDE8DF",
  padding: "16px 20px 12px",
};

const bodyStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  padding: "16px 20px",
};

const footerStyle: CSSProperties = {
  flexShrink: 0,
  borderTop: "1px solid #EDE8DF",
  padding: "16px 20px",
};

export function AuthDialog({
  isOpen,
  onClose,
  initialMode = "signin",
}: AuthDialogProps) {
  const { signIn, signUp, isAuthConfigured } = useAuth();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setMode(initialMode);
    setError(null);
    setInfo(null);
    setPasswordConfirm("");
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !mounted) {
    return null;
  }

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setError(null);
    setInfo(null);
    setPassword("");
    setPasswordConfirm("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!isAuthConfigured) {
      setError("Авторизация недоступна: Supabase не настроен");
      return;
    }

    if (!email.trim() || !password) {
      setError("Введите email и пароль");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Пароль должен содержать не менее 6 символов");
        return;
      }
      if (password !== passwordConfirm) {
        setError("Пароли не совпадают");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        onClose();
      } else {
        await signUp(email, password, fullName);
        setInfo(
          "Регистрация выполнена. Если включено подтверждение email, проверьте почту, затем войдите.",
        );
        setMode("signin");
        setPassword("");
        setPasswordConfirm("");
      }
    } catch (submitError) {
      const message =
        submitError instanceof AuthServiceError
          ? submitError.message
          : "Не удалось выполнить авторизацию";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClassName =
    "w-full rounded-xl border border-[#D9D0C3] bg-white px-3 py-2.5 outline-none focus:border-[#C4A962]";

  const dialog = (
    <div
      className="auth-dialog-overlay"
      style={overlayStyle}
      role="presentation"
    >
      <button
        type="button"
        aria-label="Закрыть окно входа"
        style={backdropStyle}
        onClick={() => {
          if (!isSubmitting) {
            onClose();
          }
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="auth-dialog-panel"
        style={panelStyle}
      >
        <div style={headerStyle}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-xl font-semibold text-[#1B4332]"
              >
                {mode === "signin" ? "Вход" : "Регистрация"}
              </h2>
              <p className="mt-1 text-sm text-[#5C6B63]">
                {mode === "signin"
                  ? "Войдите, чтобы управлять семейным деревом"
                  : "Создайте аккаунт родственника"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="shrink-0 rounded-full px-3 py-1 text-sm text-[#5C6B63] hover:bg-[#F3EEE4] disabled:opacity-60"
            >
              Закрыть
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Режим авторизации"
            className="grid grid-cols-2 gap-1 rounded-xl bg-[#F3EEE4] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              disabled={isSubmitting}
              onClick={() => switchMode("signin")}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === "signin"
                  ? "bg-[#2D4A3E] text-[#F5F0E8] shadow-sm"
                  : "text-[#2D4A3E] hover:bg-[#E8DFD0]/70",
              ].join(" ")}
            >
              Вход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              disabled={isSubmitting}
              onClick={() => switchMode("signup")}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === "signup"
                  ? "bg-[#2D4A3E] text-[#F5F0E8] shadow-sm"
                  : "text-[#2D4A3E] hover:bg-[#E8DFD0]/70",
              ].join(" ")}
            >
              Регистрация
            </button>
          </div>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          style={{ minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}
          onSubmit={handleSubmit}
        >
          <div className="auth-dialog-body space-y-3" style={bodyStyle}>
            {mode === "signup" ? (
              <label className="block text-sm text-[#2D4A3E]">
                <span className="mb-1 block font-medium">Имя</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={fieldClassName}
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label className="block text-sm text-[#2D4A3E]">
              <span className="mb-1 block font-medium">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={fieldClassName}
                autoComplete="email"
              />
            </label>

            <label className="block text-sm text-[#2D4A3E]">
              <span className="mb-1 block font-medium">Пароль</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={fieldClassName}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
            </label>

            {mode === "signup" ? (
              <label className="block text-sm text-[#2D4A3E]">
                <span className="mb-1 block font-medium">
                  Подтверждение пароля
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  className={fieldClassName}
                  autoComplete="new-password"
                />
              </label>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="rounded-xl border border-[#D9D0C3] bg-[#FAF7F1] px-3 py-2 text-sm text-[#2D4A3E]">
                {info}
              </p>
            ) : null}
          </div>

          <div style={footerStyle}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2D4A3E] px-4 py-2.5 text-sm font-medium text-[#F5F0E8] transition hover:bg-[#1B4332] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Подождите…"
                : mode === "signin"
                  ? "Войти"
                  : "Создать аккаунт"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
