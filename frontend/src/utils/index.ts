import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MICRO_POINTS_DIVISOR_NUMBER = 1_000_000;

export function formatPoints(microPoints: bigint | number): string {
  const points = Number(microPoints) / MICRO_POINTS_DIVISOR_NUMBER;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2, 
  }).format(points);
}

export function formatCompactPoints(microPoints: bigint | number): string {
   const points = Number(microPoints) / MICRO_POINTS_DIVISOR_NUMBER;
   return new Intl.NumberFormat('en-US', {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(points);
}

export function parsePoints(pointsStr: string): bigint {
  const cleanStr = pointsStr.replace(/,/g, '');
  const points = parseFloat(cleanStr);
  if (isNaN(points)) return 0n;
  return BigInt(Math.round(points * MICRO_POINTS_DIVISOR_NUMBER));
}
