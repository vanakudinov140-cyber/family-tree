"use client";

import { useState } from "react";

import { AuthDialog } from "@/components/auth/AuthDialog";
import { UserMenu } from "@/components/auth/UserMenu";
import { useAuth } from "@/context/AuthContext";

export function AuthButton() {
  const { user, isLoading, isAuthConfigured } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!isAuthConfigured) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="h-9 w-20 animate-pulse rounded-xl bg-[#E8DFD0]/80 sm:h-10 sm:w-24" />
    );
  }

  if (user) {
    return <UserMenu />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsDialogOpen(true)}
        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-3 text-sm font-medium text-[#F5F0E8] transition hover:bg-[#1B4332] sm:min-h-10 sm:px-4"
      >
        Войти
      </button>
      <AuthDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialMode="signin"
      />
    </>
  );
}
