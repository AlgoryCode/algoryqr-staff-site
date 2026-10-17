"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { loadStaffSession, parseStaffRole, STAFF_GATE_PATH, staffHomePath } from "@/lib/waiter-api";
import StaffKitchenView from "@/views/staff/StaffKitchenView";

export default function MutfakPage() {
  const router = useRouter();

  useEffect(() => {
    const session = loadStaffSession();
    if (!session) {
      router.replace(STAFF_GATE_PATH);
      return;
    }
    const role = parseStaffRole(session.me.staffRole);
    if (role !== "KITCHEN") {
      router.replace(staffHomePath(role));
    }
  }, [router]);

  return <StaffKitchenView />;
}
