"use client";

import { create } from "zustand";

import type { AccessProfile } from "@/lib/auth-user";

export type PackageAccessStatus = "idle" | "loading" | "ready" | "guest" | "error";

export type PackageEntitlement = {
  productCode: string;
  featureCode: string | null;
  quantity: number | null;
  usedQuantity: number | null;
  unlimited: boolean;
  open: boolean;
};

export type PackageAccessSnapshot = {
  profile: AccessProfile;
  periodEnd: string | null;
  entitlements: PackageEntitlement[];
};

type PackageAccessState = {
  profile: AccessProfile | null;
  periodEnd: string | null;
  entitlements: PackageEntitlement[];
  status: PackageAccessStatus;
  setProfile: (profile: AccessProfile) => void;
  setSnapshot: (snapshot: PackageAccessSnapshot) => void;
  setStatus: (status: PackageAccessStatus) => void;
  clear: () => void;
};

export const usePackageStore = create<PackageAccessState>((set) => ({
  profile: null,
  periodEnd: null,
  entitlements: [],
  status: "idle",
  setProfile: (profile) => set({ profile, status: "ready" }),
  setSnapshot: (snapshot) =>
    set({
      profile: snapshot.profile,
      periodEnd: snapshot.periodEnd,
      entitlements: snapshot.entitlements,
      status: "ready",
    }),
  setStatus: (status) => set({ status }),
  clear: () => set({ profile: null, periodEnd: null, entitlements: [], status: "idle" }),
}));
