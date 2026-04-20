import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function fetchWithDelay<T>(
  items: (() => Promise<T>)[],
  delayMs: number = 300
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (const fn of items) {
    try {
      const value = await fn();
      results.push({ status: "fulfilled", value });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}