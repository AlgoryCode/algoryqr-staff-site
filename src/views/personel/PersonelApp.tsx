"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { loadStaffSession, parseStaffRole, type WaiterMe } from "@/lib/waiter-api";

import StaffCourierView from "@/views/staff/StaffCourierView";
import StaffKitchenView from "@/views/staff/StaffKitchenView";
import StaffLoginView from "@/views/staff/StaffLoginView";

import { PersonelWaiterScreen } from "./PersonelWaiterScreen";

export default function PersonelApp() {
  const [me, setMe] = useState<WaiterMe | null | undefined>(undefined);

  useEffect(() => {
    const session = loadStaffSession();
    setMe(session?.me ?? null);
  }, []);

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (me === null) {
    return <StaffLoginView onAuthenticated={setMe} />;
  }

  const role = parseStaffRole(me.staffRole);
  if (role === "KITCHEN") return <StaffKitchenView />;
  if (role === "COURIER") return <StaffCourierView />;
  return <PersonelWaiterScreen me={me} />;
}
