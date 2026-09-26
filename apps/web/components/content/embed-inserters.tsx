"use client";

import { formatEmbed } from "@ps/core";
import { useState, useTransition, type ReactNode } from "react";

import {
  listFinisherOptions,
  uploadPostImage,
  type FinisherOption,
} from "@/app/dashboard/community/actions";
import { cn } from "@/lib/cn";

/**
 * A small form per live component (E20.24, E20.25, E20.36): pick what to show,
 * and it writes the `:::name{…}` line into the post. The line is all a post
 * stores, so anything inserted can still be edited by hand afterwards.
 */
export interface DeckOption {
  readonly id: string;
  readonly name: string;
  readonly visibility: string;
}

export interface TournamentOption {
  readonly slug: string;
  readonly name: string;
  readonly date: string;
}

type Insert = (line: string) => void;

const INPUT =
  "w-full rounded-md border border-ink-300 bg-paper px-2.5 py-1.5 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";
const BUTTON =
  "cursor-pointer rounded-md border border-ink-300 px-2.5 py-1 text-xs font-medium " +
  "hover:bg-ink-100 disabled:cursor-default disabled:opacity-50 dark:border-ink-700 dark:hover:bg-ink-900";

export function ImageInserter({ insert }: { insert: Insert }) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  function upload(file: File | undefined) {
    if (file === undefined) return;
    const form = new FormData();
    form.set("image", file);
    setProblem(null);
    startUpload(async () => {
      const result = await uploadPostImage(form);
      if (result.ok) setSrc(result.url);
      else setProblem(result.problem);
    });
  }

  return (
    <Inserter title="Image" note="Upload a picture or link to one. Reddit gets a link to it.">
      <Field label="Upload">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={uploading}
          onChange={(e) => upload(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-ink-300 file:bg-transparent file:px-2.5 file:py-1 file:text-xs dark:file:border-ink-700"
        />
        {uploading && <p className="mt-1 text-xs text-ink-500">Uploading…</p>}
        {problem !== null && (
          <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">
            {problem}
          </p>
        )}
      </Field>
      <Field label="…or its address">
        <input
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          placeholder="https://…"
          className={INPUT}
        />
      </Field>
      <Field label="Alt text (what it shows)">
        <input value={alt} onChange={(e) => setAlt(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Caption (optional)">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} className={INPUT} />
      </Field>
      <InsertButton
        disabled={src.trim() === "" || alt.trim() === "" || uploading}
        onClick={() => {
          insert(
            formatEmbed("image", {
              src: src.trim(),
              alt: alt.trim(),
              ...(caption.trim() === "" ? {} : { caption: caption.trim() }),
            }),
          );
          setSrc("");
          setAlt("");
          setCaption("");
        }}
      />
    </Inserter>
  );
}

/** One of the author's decks, or any deck by id. Empty string means none chosen. */
function DeckPicker({
  decks,
  value,
  onChange,
  optional,
}: {
  decks: readonly DeckOption[];
  value: string;
  onChange: (id: string) => void;
  optional: boolean;
}) {
  const mine = decks.some((deck) => deck.id === value);
  return (
    <>
      <Field label={optional ? "Deck (optional)" : "Your decks"}>
        <select
          value={mine ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        >
          <option value="">{decks.length === 0 ? "You have no decks yet" : "Choose…"}</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
              {deck.visibility === "private" ? " (private — readers can't see it)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="…or a deck id">
        <input
          value={mine ? "" : value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="From the deck page's address"
          className={cn(INPUT, "font-mono text-xs")}
        />
      </Field>
    </>
  );
}

export function DecklistInserter({
  insert,
  decks,
}: {
  insert: Insert;
  decks: readonly DeckOption[];
}) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");

  return (
    <Inserter title="Decklist" note="Shown by section on the site; Reddit gets the list as text.">
      <DeckPicker decks={decks} value={id} onChange={setId} optional={false} />
      <Field label="Heading (optional, instead of its name)">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
      </Field>
      <InsertButton
        disabled={id === ""}
        onClick={() => {
          insert(formatEmbed("decklist", { id, ...(title.trim() === "" ? {} : { title }) }));
          setId("");
          setTitle("");
        }}
      />
    </Inserter>
  );
}

const SHOW_OPTIONS = [
  { value: "winner", label: "Winner" },
  { value: "top2", label: "Top 2" },
  { value: "top4", label: "Top 4" },
] as const;

export function TournamentInserter({
  insert,
  decks,
  tournaments,
}: {
  insert: Insert;
  decks: readonly DeckOption[];
  tournaments: readonly TournamentOption[];
}) {
  const [slug, setSlug] = useState("");
  const [show, setShow] = useState<string>("top4");
  const [deck, setDeck] = useState("");
  const [player, setPlayer] = useState("");
  const [finishers, setFinishers] = useState<readonly FinisherOption[]>([]);
  const [loading, startLoading] = useTransition();

  function choose(nextSlug: string, nextShow: string) {
    setSlug(nextSlug);
    setShow(nextShow);
    setPlayer("");
    setFinishers([]);
    if (nextSlug === "") return;
    startLoading(async () => setFinishers(await listFinisherOptions(nextSlug, nextShow)));
  }

  return (
    <Inserter
      title="Tournament"
      note="A card with the results, and a deck inside it. Reddit gets the results, then the deck."
    >
      <Field label="Event">
        <select value={slug} onChange={(e) => choose(e.target.value, show)} className={INPUT}>
          <option value="">
            {tournaments.length === 0 ? "No events have results yet" : "Choose…"}
          </option>
          {tournaments.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name} — {t.date}
            </option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-ink-600 dark:text-ink-400">Show</legend>
        <div className="flex gap-4 text-sm">
          {SHOW_OPTIONS.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="tournament-show"
                checked={show === option.value}
                onChange={() => choose(slug, option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <DeckPicker decks={decks} value={deck} onChange={setDeck} optional />
      {deck !== "" && (
        <Field label="Put the deck">
          <select
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            disabled={loading}
            className={INPUT}
          >
            <option value="">Beside the results (paired with the event)</option>
            {finishers.map((f) => (
              <option key={f.playerSlug} value={f.playerSlug}>
                Under {f.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <InsertButton
        disabled={slug === ""}
        onClick={() => {
          insert(
            formatEmbed("tournament", {
              slug,
              show,
              ...(deck === "" ? {} : { deck }),
              ...(deck === "" || player === "" ? {} : { player }),
            }),
          );
          setDeck("");
          setPlayer("");
        }}
      />
    </Inserter>
  );
}

function Inserter({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border border-ink-200 dark:border-ink-800">
      <summary className="cursor-pointer px-3 py-2">
        <span className="font-medium">{title}</span>{" "}
        <span className="text-ink-500 dark:text-ink-400">— {note}</span>
      </summary>
      <div className="grid gap-3 border-t border-ink-200 px-3 py-3 dark:border-ink-800">
        {children}
      </div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-400">{label}</span>
      {children}
    </label>
  );
}

function InsertButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <div>
      <button type="button" disabled={disabled} onClick={onClick} className={BUTTON}>
        Insert into the post
      </button>
    </div>
  );
}
