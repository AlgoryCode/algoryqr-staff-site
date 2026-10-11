"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { formatBranchCode } from "@/lib/branch";
import { STAFF_ROLE_LABEL, waiterLogout, type StaffRole } from "@/lib/waiter-api";

type StaffFrameProps = {
  displayName?: string | null;
  role: StaffRole;
  branchId?: number | null;
  children: ReactNode;
};

export function StaffFrame({ displayName, role, branchId, children }: StaffFrameProps) {
  const router = useRouter();

  const signOut = async () => {
    await waiterLogout();
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <BrandLogo size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName?.trim() || "Personel"}</p>
            <p className="text-xs text-muted-foreground">
              {STAFF_ROLE_LABEL[role]}
              {branchId != null ? ` · Şube ${formatBranchCode(branchId)}` : ""}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Çıkış
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
