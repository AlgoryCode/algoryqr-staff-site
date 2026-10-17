"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  clearStaffProfile,
  loadStaffSession,
  parseStaffRole,
  pingStaffAuthCookies,
  staffAppForRole,
  STAFF_GATE_PATH,
  staffHomePath,
  staffRoleMatchesApp,
  type WaiterMe,
} from "@/lib/waiter-api";
import { PersonelWaiterScreen } from "@/views/personel/PersonelWaiterScreen";

export default function GarsonPage() {
  const router = useRouter();
  const [me, setMe] = useState<WaiterMe | null | undefined>(undefined);

  useEffect(() => {
    const session = loadStaffSession();
    if (!session) {
      // #region agent log
      fetch("/api/debug-agent/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hypothesisId: "H6",
          location: "garson/page.tsx",
          message: "no sessionStorage profile -> redirect login",
          data: {},
          runId: "post-fix-2",
        }),
      }).catch(() => {});
      // #endregion
      router.replace(STAFF_GATE_PATH);
      return;
    }
    const role = parseStaffRole(session.me.staffRole);
    if (!staffRoleMatchesApp(role, "WAITER")) {
      // #region agent log
      fetch("/api/debug-agent/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hypothesisId: "H8",
          location: "garson/page.tsx",
          message: "role mismatch -> redirect",
          data: { role, expected: "WAITER" },
          runId: "post-fix-2",
        }),
      }).catch(() => {});
      // #endregion
      router.replace(staffHomePath(role));
      return;
    }
    void (async () => {
      const cookiesOk = await pingStaffAuthCookies(staffAppForRole(role));
      if (!cookiesOk) {
        // #region agent log
        fetch("/api/debug-agent/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hypothesisId: "H16",
            location: "garson/page.tsx",
            message: "profile without cookies -> clear and login",
            data: { staffId: session.me.staffId },
            runId: "post-fix-6",
          }),
        }).catch(() => {});
        // #endregion
        clearStaffProfile();
        router.replace(STAFF_GATE_PATH);
        return;
      }
      setMe(session.me);
    })();
  }, [router]);

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (me === null) return null;

  return <PersonelWaiterScreen me={me} />;
}
