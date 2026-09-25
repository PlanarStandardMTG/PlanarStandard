/**
 * A made-up article, standing in for the editor that does not exist yet
 * (E20.22 scaffolds the flow; E20.2 builds the page that feeds it).
 *
 * Everything downstream of this — the status decision, RLS, the review queue —
 * is real. Only the words are not. Delete this file when E20.2 lands.
 */
export interface SampleArticle {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly bodyMarkdown: string;
  readonly tags: readonly string[];
}

const TOPICS = [
  "Why the mono-red mirror is closer than it looks",
  "Sideboarding against the Dimir control shell",
  "Three cards the metagame is sleeping on",
  "What a week of League data says about Selesnya",
  "The case for playing twenty-five lands",
] as const;

export function sampleArticle(now: Date, pick: number = Math.random()): SampleArticle {
  const title = TOPICS[Math.floor(pick * TOPICS.length) % TOPICS.length] ?? TOPICS[0];
  const stamp = now.getTime().toString(36);

  return {
    slug: `sample-${slugify(title)}-${stamp}`,
    title,
    excerpt: `A sample article, submitted ${now.toISOString().slice(0, 10)} to exercise the review flow.`,
    bodyMarkdown: [
      "_Sample content — generated to test submission and review, not written by anyone._",
      "",
      "## The claim",
      "",
      "Something about the format is under-discussed, and the numbers bear it out.",
      "",
      "## The evidence",
      "",
      "- A first observation from recent events.",
      "- A second, pointing the same way.",
      "",
      "## What to do about it",
      "",
      "Adjust the list, and see how the next event goes.",
    ].join("\n"),
    tags: ["sample"],
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
