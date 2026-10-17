"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  clearStaffProfile,
  loadStaffSession,
  parseStaffRole,
  pingStaffAuthCookies,
  staffAppForRole,
  staffHomePath,
} from "@/lib/waiter-api";
import StaffLoginView from "@/views/staff/StaffLoginView";

export default function StaffHomePage() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const session = loadStaffSession();
      if (!session) return;
      const role = parseStaffRole(session.me.staffRole);
      const cookiesOk = await pingStaffAuthCookies(staffAppForRole(role));
      if (!cookiesOk) {
        clearStaffProfile();
        return;
      }
      router.replace(staffHomePath(role));
    })();
  }, [router]);

  return <StaffLoginView />;
}
