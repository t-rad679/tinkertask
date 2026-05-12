import { Injectable } from '@nestjs/common';

interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * In-process per-key sliding-window counter store.
 * Not distributed — each server process has its own counters.
 * Sufficient for single-instance deploys; replace with Redis for multi-instance.
 */
@Injectable()
export class CounterStore {
  private readonly buckets = new Map<string, Bucket>();

  /**
   * Increment the counter for `key` within `windowMs`.
   * Returns true if the request is allowed (count <= max), false if rate-limited.
   */
  hit(key: string, windowMs: number, max: number): boolean {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      // Start a new window
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    existing.count += 1;
    return existing.count <= max;
  }

  /** Returns seconds until the current window resets for a given key and windowMs. */
  retryAfterSeconds(key: string, windowMs: number): number {
    const existing = this.buckets.get(key);
    if (!existing) return 0;
    const elapsed = Date.now() - existing.windowStart;
    return Math.ceil((windowMs - elapsed) / 1000);
  }
}
