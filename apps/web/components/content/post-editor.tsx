"use client";

import type { PostKind } from "@ps/contracts";
import {
  DISCORD_MESSAGE_LIMIT,
  type DraftProblem,
  type PlannedEmbed,
  type PostDraftInput,
} from "@ps/core";
import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";

import {
  previewPost,
  savePost,
  type Preview,
  type SaveState,
} from "@/app/dashboard/community/actions";
import { cn } from "@/lib/cn";

/**
 * The post editor (E20.2), for community and news posts alike: Markdown in, with the published page and both
 * exports one tab away.
 *
 * The site's first client component, because an editor that forgets what you
 * typed on a failed save is not one. Everything that decides anything still
 * happens on the server: saving is a server action that checks and writes under
 * RLS, and the preview is rendered there too, so components can load their data
 * and the preview is the real page rather than a second renderer's guess at it.
 */
export interface EditorComponent {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly example: string;
}

export interface PostEditorProps {
  readonly id: string | null;
  readonly kind: PostKind;
  readonly slug: string;
  readonly initial: PostDraftInput;
  readonly submitLabel: string;
  readonly saveLabel: string;
  readonly statusNote: string;
  readonly liveComponents: readonly EditorComponent[];
  readonly plannedComponents: readonly PlannedEmbed[];
}

type Tab = "write" | "preview" | "reddit" | "discord";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "write", label: "Write" },
  { id: "preview", label: "Preview" },
  { id: "reddit", label: "Reddit" },
  { id: "discord", label: "Discord" },
];

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

export function PostEditor(props: PostEditorProps) {
  const [draft, setDraft] = useState<PostDraftInput>(props.initial);
  const [tab, setTab] = useState<Tab>("write");
  const [preview, setPreview] = useState<{ for: string; value: Preview } | null>(null);
  const [previewing, startPreview] = useTransition();
  const [state, saveAction, saving] = useActionState<SaveState, FormData>(savePost, {
    problems: [],
  });
  const body = useRef<HTMLTextAreaElement>(null);

  const set = (field: keyof PostDraftInput) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const fingerprint = JSON.stringify(draft);

  function show(next: Tab) {
    setTab(next);
    if (next !== "write" && preview?.for !== fingerprint) {
      startPreview(async () => {
        setPreview({
          for: fingerprint,
          value: await previewPost({ ...draft, slug: props.slug, kind: props.kind }),
        });
      });
    }
  }

  function edit(transform: (text: string, start: number, end: number) => [string, number, number]) {
    const area = body.current;
    if (area === null) return;
    const [text, start, end] = transform(
      draft.bodyMarkdown,
      area.selectionStart,
      area.selectionEnd,
    );
    set("bodyMarkdown")(text);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start, end);
    });
  }

  const problems = describe(state.problems, props.plannedComponents);

  return (
    <form action={saveAction} className="space-y-5">
      <input type="hidden" name="id" value={props.id ?? ""} />
      <input type="hidden" name="kind" value={props.kind} />

      {state.failed === "not-editable" && (
        <Banner tone="warn">This post can no longer be edited from here.</Banner>
      )}
      {state.failed === "not-allowed" && (
        <Banner tone="warn">Only an admin can write a news post.</Banner>
      )}

      <div>
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          value={draft.title}
          onChange={(e) => set("title")(e.target.value)}
          className={cn(FIELD, "font-serif text-lg")}
          placeholder="What is this post about?"
        />
        <FieldProblems messages={problems.title} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="subtitle" className="text-sm font-medium">
            Subtitle <span className="font-normal text-ink-500">(optional)</span>
          </label>
          <input
            id="subtitle"
            name="subtitle"
            value={draft.subtitle}
            onChange={(e) => set("subtitle")(e.target.value)}
            className={FIELD}
          />
          <FieldProblems messages={problems.subtitle} />
        </div>
        <div>
          <label htmlFor="tags" className="text-sm font-medium">
            Tags <span className="font-normal text-ink-500">(comma-separated, up to five)</span>
          </label>
          <input
            id="tags"
            name="tags"
            value={draft.tags}
            onChange={(e) => set("tags")(e.target.value)}
            className={FIELD}
            placeholder="season-ii, rakdos"
          />
          <FieldProblems messages={problems.tags} />
        </div>
      </div>

      <div>
        <label htmlFor="excerpt" className="text-sm font-medium">
          Excerpt <span className="font-normal text-ink-500">(optional — shown in the feed)</span>
        </label>
        <input
          id="excerpt"
          name="excerpt"
          value={draft.excerpt}
          onChange={(e) => set("excerpt")(e.target.value)}
          className={FIELD}
        />
        <FieldProblems messages={problems.excerpt} />
      </div>

      <div>
        <div
          role="tablist"
          aria-label="Editor view"
          className="flex gap-1 border-b border-ink-200 dark:border-ink-800"
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => show(id)}
              className={cn(
                "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium",
                tab === id
                  ? "border-eclipse-600 text-ink-900 dark:border-eclipse-400 dark:text-ink-100"
                  : "border-transparent text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Kept mounted on every tab so the textarea is always part of the form. */}
        <div hidden={tab !== "write"} className="pt-3">
          <Toolbar edit={edit} />
          <textarea
            ref={body}
            id="bodyMarkdown"
            name="bodyMarkdown"
            aria-label="Body, in Markdown"
            value={draft.bodyMarkdown}
            onChange={(e) => set("bodyMarkdown")(e.target.value)}
            rows={22}
            className={cn(FIELD, "mt-2 font-mono text-[13px]/6")}
            placeholder={
              "Write in Markdown.\n\n## A heading\n\nA paragraph, a **bold** word, a [link](https://…)."
            }
          />
          <FieldProblems messages={problems.body} />
          <ComponentsPanel
            live={props.liveComponents}
            planned={props.plannedComponents}
            insert={(line) =>
              edit((text, start) => {
                const before = text.slice(0, start).replace(/\n*$/, "");
                const after = text.slice(start).replace(/^\n*/, "");
                const head = before === "" ? "" : `${before}\n\n`;
                const next = `${head}${line}\n\n${after}`;
                const caret = head.length + line.length;
                return [next, caret, caret];
              })
            }
          />
        </div>

        {tab !== "write" && (
          <div className="pt-4" aria-busy={previewing}>
            {preview === null || previewing ? (
              <p className="py-10 text-center text-sm text-ink-500">Rendering…</p>
            ) : tab === "preview" ? (
              <div className="rounded-lg border border-ink-200 p-6 dark:border-ink-800">
                {preview.value.rendered}
              </div>
            ) : (
              <ExportView
                text={tab === "reddit" ? preview.value.reddit : preview.value.discord}
                limit={tab === "discord" ? DISCORD_MESSAGE_LIMIT : null}
                note={
                  tab === "reddit"
                    ? "Paste into a Reddit text post. Tables become lists, images become links, and every link points at the site."
                    : "Paste into a Discord message. Long posts are cut at a paragraph and always keep the link to the full post."
                }
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-200 pt-5 dark:border-ink-800">
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={saving}
          className="cursor-pointer rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-60 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white"
        >
          {props.submitLabel}
        </button>
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={saving}
          className="cursor-pointer rounded-lg border border-ink-300 px-4 py-2 text-sm font-medium hover:bg-ink-100 disabled:opacity-60 dark:border-ink-700 dark:hover:bg-ink-900"
        >
          {props.saveLabel}
        </button>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          {saving ? "Saving…" : props.statusNote}
        </p>
      </div>
    </form>
  );
}

type Edit = (
  transform: (text: string, start: number, end: number) => [string, number, number],
) => void;

function Toolbar({ edit }: { edit: Edit }) {
  const wrap = (before: string, after: string, placeholder: string) =>
    edit((text, start, end) => {
      const selected = text.slice(start, end) || placeholder;
      const next = text.slice(0, start) + before + selected + after + text.slice(end);
      return [next, start + before.length, start + before.length + selected.length];
    });

  const prefix = (marker: string) =>
    edit((text, start, end) => {
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const block = text.slice(lineStart, end);
      const prefixed = block
        .split("\n")
        .map((line) => marker + line)
        .join("\n");
      const next = text.slice(0, lineStart) + prefixed + text.slice(end);
      return [next, lineStart, lineStart + prefixed.length];
    });

  const tools: readonly { label: string; title: string; run: () => void; className?: string }[] = [
    { label: "B", title: "Bold", run: () => wrap("**", "**", "bold"), className: "font-bold" },
    { label: "I", title: "Italic", run: () => wrap("_", "_", "italic"), className: "italic" },
    { label: "H", title: "Heading", run: () => prefix("## ") },
    { label: "Link", title: "Link", run: () => wrap("[", "](https://)", "text") },
    { label: "• List", title: "Bulleted list", run: () => prefix("- ") },
    { label: "❝ Quote", title: "Quote", run: () => prefix("> ") },
    { label: "</>", title: "Code", run: () => wrap("`", "`", "code"), className: "font-mono" },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((tool) => (
        <button
          key={tool.title}
          type="button"
          title={tool.title}
          onClick={tool.run}
          className={cn(
            "cursor-pointer rounded-md border border-ink-200 px-2.5 py-1 text-xs hover:bg-ink-100 dark:border-ink-800 dark:hover:bg-ink-900",
            tool.className,
          )}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The extension point, as an author sees it: what can be placed in a post
 * now, and what is coming along with how each will look outside the site.
 */
function ComponentsPanel({
  live,
  planned,
  insert,
}: {
  live: readonly EditorComponent[];
  planned: readonly PlannedEmbed[];
  insert: (line: string) => void;
}) {
  return (
    <details className="mt-4 rounded-lg border border-ink-200 dark:border-ink-800">
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
        Components{" "}
        <span className="font-normal text-ink-500 dark:text-ink-400">
          — {live.length === 0 ? "none available yet" : `${live.length} available`},{" "}
          {planned.length} planned
        </span>
      </summary>
      <div className="space-y-4 border-t border-ink-200 px-4 py-4 text-sm dark:border-ink-800">
        <p className="text-ink-600 dark:text-ink-400">
          A component is one line on its own, like{" "}
          <code className="rounded bg-ink-100 px-1 text-xs dark:bg-ink-800">
            :::name{"{"}key=&quot;value&quot;{"}"}
          </code>
          . The site shows it live; Reddit and Discord get a text version of it.
        </p>

        {live.map((component) => (
          <div key={component.name} className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">{component.label}</p>
              <p className="text-ink-600 dark:text-ink-400">{component.description}</p>
            </div>
            <button
              type="button"
              onClick={() => insert(component.example)}
              className="shrink-0 cursor-pointer rounded-md border border-ink-300 px-2.5 py-1 text-xs font-medium hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-900"
            >
              Insert
            </button>
          </div>
        ))}

        <ul className="space-y-4">
          {planned.map((component) => (
            <li key={component.name} className="opacity-80">
              <p className="font-medium">
                {component.label}{" "}
                <span className="ml-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-normal text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                  coming soon
                </span>
              </p>
              <p className="text-ink-600 dark:text-ink-400">{component.description}</p>
              <code className="mt-1 block text-xs text-ink-500">{component.example}</code>
              <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-xs text-ink-600 dark:text-ink-400">
                <dt className="font-medium text-ink-700 dark:text-ink-300">Site</dt>
                <dd>{component.site}</dd>
                <dt className="font-medium text-ink-700 dark:text-ink-300">Reddit</dt>
                <dd>{component.reddit}</dd>
                <dt className="font-medium text-ink-700 dark:text-ink-300">Discord</dt>
                <dd>{component.discord}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function ExportView({ text, limit, note }: { text: string; limit: number | null; note: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600 dark:text-ink-400">{note}</p>
        <div className="flex items-center gap-3">
          {limit !== null && (
            <span className="text-xs text-ink-500">
              {text.length} / {limit}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="cursor-pointer rounded-md border border-ink-300 px-2.5 py-1 text-xs font-medium hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-900"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="max-h-[32rem] overflow-auto rounded-lg bg-ink-100 p-4 font-mono text-[13px]/6 whitespace-pre-wrap dark:bg-ink-900">
        {text}
      </pre>
    </div>
  );
}

const PROBLEM_TEXT: Readonly<Record<string, string>> = {
  "title:empty": "Give it a title.",
  "title:long": "That title is too long.",
  "subtitle:long": "That subtitle is too long.",
  "excerpt:long": "That excerpt is too long — keep it to a sentence or two.",
  "tags:many": "Five tags at most.",
  "tags:invalid": "Tags are lowercase letters, digits and hyphens.",
  "body:empty": "There is nothing to submit yet.",
  "body:long": "That is longer than a post can be.",
};

function describe(
  problems: readonly DraftProblem[],
  planned: readonly PlannedEmbed[],
): Readonly<Record<string, readonly string[]>> {
  const out: Record<string, string[]> = {};
  for (const problem of problems) {
    const detail = "detail" in problem ? problem.detail : "";
    const coming = planned.find((component) => component.name === detail);
    const message =
      problem.code === "unknown-embed"
        ? coming === undefined
          ? `There is no component called “${problem.detail}”.`
          : `${coming.label} is not available yet — remove it to submit, or save a draft.`
        : problem.code === "bad-embed"
          ? `Component problem — ${problem.detail}.`
          : (PROBLEM_TEXT[`${problem.field}:${problem.code}`] ?? "Check this field.");
    (out[problem.field] ??= []).push(message);
  }
  return out;
}

function FieldProblems({ messages }: { messages: readonly string[] | undefined }) {
  if (messages === undefined || messages.length === 0) return null;
  return (
    <ul role="alert" className="mt-1.5 space-y-0.5 text-sm text-red-700 dark:text-red-400">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

function Banner({ tone, children }: { tone: "warn"; children: ReactNode }) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        tone === "warn" &&
          "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
      )}
    >
      {children}
    </p>
  );
}
