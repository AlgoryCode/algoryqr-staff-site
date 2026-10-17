"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  loadStaffSession,
  parseStaffRole,
  STAFF_GATE_PATH,
  staffHomePath,
  staffRoleMatchesApp,
  type StaffRole,
  type WaiterMe,
} from "@/lib/waiter-api";

export function useStaffSession(expected: StaffRole) {
  const router = useRouter();
  const [me, setMe] = useState<WaiterMe | null>(null);

  useEffect(() => {
    const session = loadStaffSession();
    if (!session) {
      router.replace(STAFF_GATE_PATH);
      return;
    }
    const role = parseStaffRole(session.me.staffRole);
    if (!staffRoleMatchesApp(role, expected)) {
      router.replace(staffHomePath(role));
      return;
    }
    setMe(session.me);
  }, [expected, router]);

  return me;
}
