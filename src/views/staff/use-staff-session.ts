"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  parseStaffRole,
  resolveStaffSession,
  staffHomePath,
  staffRoleMatchesApp,
  type StaffRole,
  type WaiterMe,
} from "@/lib/waiter-api";

export function useStaffSession(expected: StaffRole) {
  const router = useRouter();
  const [me, setMe] = useState<WaiterMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveStaffSession()
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          router.replace("/");
          return;
        }
        const role = parseStaffRole(session.me.staffRole);
        if (!staffRoleMatchesApp(role, expected)) {
          router.replace(staffHomePath(role));
          return;
        }
        setMe(session.me);
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [expected, router]);

  return me;
}
