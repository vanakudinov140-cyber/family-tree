"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/context/AuthContext";
import { FamilyDataProvider } from "@/context/FamilyDataContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FamilyDataProvider>{children}</FamilyDataProvider>
    </AuthProvider>
  );
}
