import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeData(data: any) {
  // simple sanitizer
  return JSON.parse(JSON.stringify(data));
}
