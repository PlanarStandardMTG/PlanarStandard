"use client";

import { loadRatings } from "./load-ratings";

export function leaderboard(): string {
  return loadRatings();
}
