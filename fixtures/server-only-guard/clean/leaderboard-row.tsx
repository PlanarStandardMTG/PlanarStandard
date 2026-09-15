"use client";

import { formatRating } from "./format-rating";

export function leaderboardRow(rating: number): string {
  return formatRating(rating);
}
