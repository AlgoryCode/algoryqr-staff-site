"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { parseStaffRole, resolveStaffSession, type WaiterMe } from "@/lib/waiter-api";

import StaffCourierView from "@/views/staff/StaffCourierView";
import StaffKitchenView from "@/views/staff/StaffKitchenView";
import StaffLoginView from "@/views/staff/StaffLoginView";

import { PersonelWaiterScreen } from "./PersonelWaiterScreen";

export default function PersonelApp() {
  const [me, setMe] = useState<WaiterMe | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    resolveStaffSession()
      .then((session) => {
        if (!cancelled) setMe(session?.me ?? null);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (me === null) {
    return (
      <StaffLoginView
        onAuthenticated={() => {
          void resolveStaffSession().then((session) => {
            setMe(session?.me ?? null);
          });
        }}
      />
    );
  }

  const role = parseStaffRole(me.staffRole);
  if (role === "KITCHEN") return <StaffKitchenView />;
  if (role === "COURIER") return <StaffCourierView />;
  return <PersonelWaiterScreen me={me} />;
}
