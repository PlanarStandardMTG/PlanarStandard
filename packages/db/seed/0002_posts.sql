-- Seed: posts.
--
-- Twelve posts — ten published, one in review, one draft — split across both
-- kinds so every feed on the site has something in it and the status filter has
-- something to filter. The archetype names are real ones from the Season I map;
-- the analysis is invented.

insert into posts (slug, title, subtitle, excerpt, tags, status, kind, author_id, published_at, body_markdown) values

-- ---------------------------------------------------------------- official ---
(
  'season-i-begins-lorwyn-eclipsed',
  'Season I begins: Lorwyn Eclipsed',
  'Twelve weeks, nine events, one trophy',
  'Season I runs from 21 January to 18 April. Here is the schedule, the legal pool, and how points work.',
  array['season-i', 'announcement'],
  'published', 'official',
  '11111111-1111-4111-8111-000000000001',
  '2026-01-19T17:00:00Z',
  $md$
Season I of Planar Standard — **Lorwyn Eclipsed** — opens on 21 January and runs
through 18 April. Nine events, one trophy, and the first season with a published
leaderboard from day one.

## The pool

Season I is legal with Shadows of Sunlight, Eclipsed, Edge of Eternities, Tarkir
Dragonstorm, Aetherdrift, and Foundations.

As always, Planar Standard is intended to always feature the previous two years
of Universe Within sets. Foundations is excluded from rotation and stays legal
for the foreseeable future.

## The schedule

Events run every other Saturday, with the finale on 18 April. Registration opens
the Monday before each event in Discord.

## Points

Every event awards points on placement. The top eight on points at the end of the
season are invited to the finale. Ratings are separate from points — the
leaderboard tracks skill over time, the points table tracks this season only.

Good luck. Bring something unfair.
$md$
),
(
  'banned-and-restricted-2026-03-02',
  'Banned and restricted update, 2 March 2026',
  'One card banned, effective immediately',
  'Beetle Drain''s engine has been the defining constraint on deckbuilding for six weeks. One card is leaving the format.',
  array['banned-and-restricted', 'announcement'],
  'published', 'official',
  '11111111-1111-4111-8111-000000000001',
  '2026-03-02T18:00:00Z',
  $md$
Effective immediately, one card is banned in Planar Standard.

## The change

The Beetle Drain engine has appeared in **41% of decks** across the last four
events, and in every single Top 4 since the second event of the season. That is
not a healthy share, and more to the point it is not an interesting one: the
games it produces are decided by whether the engine assembles, not by how either
player plays them.

We looked hard at whether the answer was a ban or a better answer card. The
answer cards exist. They are not enough, and asking every deck in the format to
maindeck them is itself a deckbuilding tax that narrows the format further.

## What we expect

Golgari Midrange and Azorius Control both lose a matchup they were favoured in,
and we think the next four events will look more like the first two than the last
four. We will publish the share numbers again after the 14 March event.

## What is not changing

Nothing else. The rest of the format is inside the range we would expect for
week six, and several of the decks that look oppressive on stream are under 5% of
the field.

Questions go in `#rules-questions` on Discord.
$md$
),
(
  'season-ii-schedule-and-rotation',
  'Season II schedule and the rotation window',
  'What rotates, what stays, and when',
  'Season II opens 9 May. Two sets rotate out, Foundations stays, and the event cadence changes.',
  array['season-ii', 'announcement', 'rotation'],
  'published', 'official',
  '11111111-1111-4111-8111-000000000001',
  '2026-05-04T16:00:00Z',
  $md$
Season II opens on 9 May with a slightly smaller pool and a slightly faster
cadence.

## Rotation

Planar Standard always features the previous two years of Universe Within sets.
Two sets leave the pool at the season boundary. **Foundations is excluded from
rotation** and remains legal.

The legal set list on the [rules page](/rules) is generated from the format
version in the database, so it is correct the moment an announcement lands — it
cannot go stale behind a deploy.

## Cadence

Season I ran fortnightly. Season II moves to weekly events with a shorter season,
which keeps the same number of events in less calendar time and makes the
leaderboard move faster.

## Decklists

Decklist submission is now open to players directly rather than going through an
organizer. Paste a list, get it validated against the legal pool, and it is
attached to your entry.
$md$
),
(
  'season-ii-wrap-up',
  'Season II wrap-up',
  'Where the metagame landed, and what we are watching',
  'Nine events, 290 decks, and a format that finally stopped revolving around a single card.',
  array['season-ii', 'metagame'],
  'published', 'official',
  '11111111-1111-4111-8111-000000000001',
  '2026-08-03T15:00:00Z',
  $md$
Season II is done. Some numbers, and what they mean for Season III.

## The shape of the field

290 decks across nine events. The top of the field was three archetypes —
Azorius Control, Golgari Midrange, and Dimir Faeries — but none of them broke
15% share, and the gap between third and tenth was small enough that most weeks
looked genuinely different from each other.

Compare that with Season I, where a single engine sat above 40% for six weeks.
This is what we were hoping the March ban would buy, and it bought it.

## The long tail

Sixty-one distinct archetypes were registered at least once. Most of them are
one person's pet deck, and that is exactly as it should be — a format where the
long tail is empty is a format where brewing has stopped.

Elf Kindred deserves a specific mention for going from a joke to a Top 8 deck
over about five weeks, entirely on the back of one player refusing to drop it.

## Season III

Season III opens in September. No B&R changes are planned. The archetype map and
the card statistics from this season are on the site now.
$md$
),
(
  'the-hub-is-live',
  'The hub is live',
  'Decklists, ratings, and the archetype map in one place',
  'Everything that used to live in a spreadsheet and a pinned Discord message now has a URL.',
  array['site', 'announcement'],
  'published', 'official',
  '11111111-1111-4111-8111-000000000001',
  '2026-09-08T12:00:00Z',
  $md$
For two years the format's records have lived in a spreadsheet, an HTML file
somebody regenerated by hand, and a pinned message. All three worked. None of
them were linkable, and none of them survived the person who maintained them
taking a week off.

So: the hub.

## What is here now

- **Decklists** — submit a list, have it checked against the legal pool, and have
  it attached to your event entry.
- **The archetype map** — the same force-directed map, rebuilt so it is generated
  from the decklists rather than maintained separately.
- **Ratings** — an Elo leaderboard that replays every match from scratch each
  time it runs, so a correction to a result from three months ago fixes every
  rating downstream of it.

## What is not here yet

Matchup data needs another season of pairings before it says anything
trustworthy. Card statistics are live but suppressed below twenty games — you
will see "insufficient data" rather than a number computed from four matches.

## It is open source

Every number on this site is computed from data you can read, by code you can
read. If a statistic looks wrong, the methodology page says exactly how it was
derived, and the repository will take your pull request.
$md$
),

-- --------------------------------------------------------------- community ---
(
  'azorius-control-is-the-yardstick',
  'Azorius Control is the format''s yardstick',
  'If your deck cannot beat it, your deck is not real',
  'Six months of results say the same thing: Azorius Control is the deck every other deck is measured against.',
  array['azorius-control', 'metagame', 'deck-guide'],
  'published', 'community',
  '11111111-1111-4111-8111-000000000002',
  '2026-02-11T09:30:00Z',
  $md$
There is a version of this article that argues Azorius Control is the best deck
in Planar Standard. This is not that article, because it probably is not. What it
is, reliably, is the deck you have to have a plan for.

## Why it is the yardstick

Control decks punish decks that do nothing. That sounds obvious and it is, but it
has a specific consequence in a format this wide: a brew that beats the other
fifty-nine archetypes and folds to Azorius will still go 2-3, because Azorius is
the one deck you are guaranteed to play against.

## The three cards that matter

Everything else in the list is flexible. These are not:

1. **The sweeper.** Not because it is unbeatable — because it sets the number of
   creatures you are allowed to commit, and that number is the whole matchup.
2. **The two-mana interaction.** It is what lets them untap with a counter up on
   turn four instead of turn six.
3. **The win condition that does not die to their own sweeper.** Whichever one
   they picked, it is the card you have to answer and the only one.

## How to actually beat it

Stop playing around the sweeper. Most players I watch commit two threats, get
swept, and then commit two more into an untapped blue mana. Commit *one*, force
the answer, and keep the pressure on their land drops rather than their life
total.

The games you lose are the ones where they got to spend mana efficiently every
turn. The games you win are the ones where they spent turn three doing nothing
because you did not give them a target.
$md$
),
(
  'beating-dimir-faeries-on-a-budget',
  'Beating Dimir Faeries with a sideboard you already own',
  'Four cards, none of them rare',
  'Faeries is the best-positioned deck in the format and the cheapest to hate out. Here are the four cards to find.',
  array['dimir-faeries', 'sideboard', 'budget'],
  'published', 'community',
  '11111111-1111-4111-8111-000000000004',
  '2026-03-24T11:00:00Z',
  $md$
Dimir Faeries has been the second or third most-registered deck for five events
running, and the number of people complaining about it in Discord suggests most
of us are not sideboarding correctly against it.

The good news is that the answers are commons.

## What the deck actually does

Faeries wins by making your turns cost more than theirs. It does not have a fast
clock and it does not have inevitability — what it has is a run of two-mana
plays that each trade up, and a flier that ends the game in five swings while you
are still untapping.

If you break the sequence of cheap interaction, the deck is a pile of 1/2s.

## The four cards

- **A two-mana sweeper effect.** One damage to everything is enough. Half their
  board is x/1 and the other half is x/2.
- **Cheap graveyard interaction**, for the recursion plan out of the sideboard.
- **An uncounterable threat.** Not a good one. Any one.
- **A land that produces mana on the turn you play it**, so you can hold up your
  own interaction on their turn instead of tapping out on yours.

None of these are expensive. Three of them are in Foundations, which never
rotates, so this is a sideboard you build once.

## Sideboarding

Take out your expensive removal. All of it. Every card in their deck costs two,
and a four-mana answer to a two-mana threat is how you lose a game you were
winning.
$md$
),
(
  'elf-kindred-twelve-events-later',
  'Elf Kindred, twelve events later',
  'A joke deck that stopped being a joke',
  'I registered Elves at twelve consecutive events. Here is what changed, and what I would change again.',
  array['elf-kindred', 'deck-guide', 'tournament-report'],
  'published', 'community',
  '11111111-1111-4111-8111-000000000005',
  '2026-06-15T19:45:00Z',
  $md$
When I first registered Elf Kindred, somebody asked me if I had brought the wrong
deck box. Twelve events later it has a Top 8 and a stable share of the field, and
I have opinions.

## What changed

Not the deck. The format.

Elves was always capable of the turn-four kills it gets now. What it lacked was a
metagame where people were allowed to tap out. When the format was defined by a
single engine, everybody's deck had interaction at every point on the curve
because they needed it for the mirror. Once that was gone, decks got greedier,
and a deck that punishes greed got better without changing a card.

## The eleven cards I would not cut

The lord effects and the mana creatures are the deck. Everything else has been
through three or four versions.

What I got wrong for the first five events was treating the mana creatures as
ramp. They are not ramp, they are lords that happen to tap for mana — the deck
does not want to cast a five-drop, it wants to attack with four creatures on turn
three.

## The matchup I still cannot beat

Sweepers, obviously. Azorius Control is roughly 30/70 and I have stopped
pretending otherwise. My plan is to dodge it, which is not a plan, but it is
honest.

If you want to play a deck that is favoured against most of the field and
unfavoured against the deck that is always there, this is the one.
$md$
),
(
  'building-on-a-budget',
  'A beginner''s guide to building on a budget',
  'You can play this format for the price of a draft',
  'Foundations never rotates, which makes it the cheapest possible foundation for a first deck.',
  array['budget', 'getting-started', 'deck-guide'],
  'published', 'community',
  '11111111-1111-4111-8111-000000000004',
  '2026-07-20T08:15:00Z',
  $md$
The single most useful fact about Planar Standard for a new player is that
**Foundations does not rotate**. Every card you buy from it is a card you keep.

That changes the maths on a first deck completely.

## Start with the mana

The most common mistake I see is spending the whole budget on spells and then
playing eighteen basics and four taplands. A deck with worse spells and better
mana wins more matches than the reverse, and good mana is mostly uncommons.

## Pick a deck that does one thing

Midrange decks are the most expensive decks to build badly. They need a card for
every situation, and every one of those cards is individually replaceable, which
means you feel the cost of every downgrade.

Aggro and combo decks are cheap because the expensive cards are the ones that
give you options, and those decks do not want options. They want the same eight
cards every game.

## What to actually buy first

1. The mana base for two colours you want to play in a year's time.
2. A playset of whatever the cheap removal spell is this season.
3. The one rare your deck genuinely cannot function without. There is usually
   exactly one.

Everything else can be the third-best version for now. Nobody at a Thursday event
has ever checked whether your four-drop is the optimal four-drop.
$md$
),
(
  'goblin-aristocrats-going-wide',
  'Goblin Aristocrats and the case for going wide',
  'Why the format punished creature decks, and why it stopped',
  'Three sweepers left the format at rotation. Nobody seems to have noticed what that means.',
  array['goblin-aristocrats', 'metagame'],
  'published', 'community',
  '11111111-1111-4111-8111-000000000005',
  '2026-09-11T20:00:00Z',
  $md$
Rotation took three sweepers out of the format. The archetype map from Season II
still looks like a format with three sweepers in it.

That gap is where I have been living for two weeks.

## The argument

Going wide is bad when the punishment is cheap and unconditional. Take away the
cheap unconditional punishment and the same decks become good without changing —
this is the Elf Kindred story from June, and I think it is about to be the
Goblin Aristocrats story.

The difference is that Aristocrats does not fold to the sweepers that are left,
because it converts the board into damage in response. The deck's floor against
a sweeper is "you took six and I drew a card", which is a floor most creature
decks would take.

## What I would register tomorrow

The stock list, with the sacrifice outlet count moved from three to four. Every
game I have lost with the deck has been a game where I had the board and not the
outlet, and no game has been lost to drawing the fourth one.

## The caveat

This is two weeks of testing and no tournament results. Treat it as a hypothesis.
I will have a real record in a month, and if I am wrong I will write that up
too — the archive on this site makes that a lot harder to quietly skip.
$md$
),

-- ------------------------------------------- not published, for the filters ---
(
  'matchup-matrix-first-look',
  'First look at the matchup matrix',
  'Early numbers, small samples',
  'A walk through the new matchup data, and why most of the cells are still empty.',
  array['matchups', 'metagame'],
  'review', 'community',
  '11111111-1111-4111-8111-000000000002',
  null,
  $md$
Draft for review. The matchup matrix went live last week and most of it says
"insufficient data", which is the correct answer but deserves an explanation.

TODO: pull the actual n per cell once the Season II import finishes.
$md$
),
(
  'season-iii-predictions',
  'Season III predictions',
  null,
  null,
  array['season-iii'],
  'draft', 'community',
  '11111111-1111-4111-8111-000000000005',
  null,
  $md$
Notes to self, not finished.

- Aristocrats is underrated, see the going-wide piece
- Somebody is going to break the new land cycle and it will not be me
- Azorius is still going to be 12% of the field and we will all still act surprised
$md$
);
