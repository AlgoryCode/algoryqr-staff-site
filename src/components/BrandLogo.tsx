import Image from "next/image";

import { cn } from "@/lib/utils";

const BRAND_LOGO_SRC = "/brand/algory-logo.png";
const LOGO_WIDTH = 854;
const LOGO_HEIGHT = 848;

type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
};

const sizeClasses = {
  sm: "h-9 sm:h-10",
  md: "h-10 sm:h-11",
  lg: "h-12 sm:h-14",
} as const;

export function BrandLogo({ className, size = "sm", priority = false }: BrandLogoProps) {
  return (
    <Image
      src={BRAND_LOGO_SRC}
      alt="AlgoryQR"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      quality={100}
      unoptimized
      sizes="56px"
      priority={priority}
      className={cn("w-auto shrink-0", sizeClasses[size], className)}
    />
  );
}
