# The like counter

The plant on the window sill grows when people like the page. This is where the
number lives and how to set it up.

It takes about ten minutes and you do not need to know any SQL — there is one
block to copy and one button to press. **Until you do it, nothing is broken.**
With no database configured the count lives in each visitor's own browser and
the plant grows for them alone; setting it up is what makes the number shared.

> This replaces `workers/likes/`, a Cloudflare Worker that has been deleted. It
> existed because Notion's API sends no CORS headers, so a browser could never
> call it, and because a Notion token has write access to the whole CMS and
> could not be put in a bundle. Supabase has neither problem: it sends CORS, and
> its anon key is meant to be published. That removed the relay, the second
> deploy target and about 380 lines.

---

## 1. Make a project

1. Go to **supabase.com**, sign in with GitHub, and press **New project**.
2. Name it anything (`plant` is fine). Pick the region closest to you.
3. It asks for a database password. Generate one, save it in your password
   manager, and then forget about it — nothing below needs it.
4. Wait a minute or two while it builds.

The free plan is enough. There is no card and no spending limit; if something
ever went wrong the project gets throttled, not invoiced.

## 2. Paste the SQL

In the left sidebar: **SQL Editor** → **New query**. Paste all of this in and
press **Run**. It is safe to run twice.

```sql
-- ============================================================================
-- THE PLANT. One row, one verb.
-- Paste whole into the Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- The row. There is only ever one, and the CHECK is what guarantees it: a
-- second insert fails rather than quietly giving you two plants to wonder about.
--
-- `day` and `today` are the day's ceiling, and they are the only hardening in
-- this schema that is not free. See the note under "What someone can still do".
create table if not exists public.plant (
  id     smallint primary key default 1 check (id = 1),
  likes  integer  not null default 0 check (likes >= 0),
  day    date     not null default current_date,
  today  integer  not null default 0
);

insert into public.plant (id) values (1) on conflict (id) do nothing;

-- --- The locks --------------------------------------------------------------
alter table public.plant enable row level security;

-- Supabase's default privileges hand `anon` full rights on every new table in
-- `public`. Take the write half back at the GRANT level, so a policy written
-- carelessly a year from now still cannot open a write path. Then hand back one
-- column: `likes` is the only thing a browser has any business reading.
revoke all on public.plant from anon, authenticated;
grant select (likes) on public.plant to anon, authenticated;

drop policy if exists "plant is public" on public.plant;
create policy "plant is public"
  on public.plant for select to anon, authenticated using (true);

-- There is deliberately NO insert, update or delete policy. Row-level security
-- denies what it has not been told to permit, so the only write path in this
-- schema is the function below.

-- --- The one verb -----------------------------------------------------------
-- It takes NO ARGUMENTS. That is the security boundary: there is no parameter
-- to smuggle a value through, so the only mutation anybody on the internet can
-- reach is "likes = likes + 1".
--
-- security definer  — runs as the owner, which is how it writes past the
--                     read-only policy above.
-- set search_path = '' — mandatory, not decoration. Without it someone who can
--                     create a schema could shadow `plant` and have this run
--                     against their table with the owner's rights. Emptying it
--                     forces every name below to be schema-qualified.
create or replace function public.water_plant()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare total integer;
begin
  -- One UPDATE, so two clicks in the same millisecond take a row lock and both
  -- count. Every expression here reads the OLD row, which is what makes the
  -- ceiling work: on a new day `today` restarts at 1, and once today's count
  -- has passed the ceiling the increment adds 0 and the true total comes back
  -- anyway. Change 500 to whatever you like; it is a day's worth of damage.
  update public.plant
     set today = case when day = current_date then today + 1 else 1 end,
         day   = current_date,
         likes = likes + case
                   when day = current_date and today >= 500 then 0 else 1
                 end
   where id = 1
  returning likes into total;
  return total;
end;
$$;

-- Postgres grants EXECUTE on every new function to PUBLIC. Always revoke it.
revoke all on function public.water_plant() from public;
grant execute on function public.water_plant() to anon, authenticated;
```

You should see **Success. No rows returned**. That is right — it made things
rather than fetching anything.

## 3. Copy the two values

Left sidebar: **Project Settings** (the gear) → **API**.

| On that page | Goes in `.env` as |
|---|---|
| **Project URL**, like `https://abcdefgh.supabase.co` | `PUBLIC_SUPABASE_URL` |
| **Project API keys** → the **`anon` `public`** one, a long `eyJ...` string | `PUBLIC_SUPABASE_ANON_KEY` |

So `.env` in the repo root gets two lines:

```
PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Do not copy the `service_role` key.** It is on the same page and it bypasses
every lock in the SQL above. The `anon` one is the only one that belongs in a
file the site builds from.

Restart `npm run dev` — Astro reads `.env` at startup, so a running server will
not notice.

### And in GitHub, for the live site

Repo **Settings → Secrets and variables → Actions → Variables** tab → **New
repository variable**, twice, with the same two names and values.

Variables, not secrets. Both values ship in the bundle by design, so there is
nothing to hide, and a secret gets masked to `***` in build logs — which one day
masks it inside a file you are trying to read and wastes an afternoon.

`deploy.yml` already passes both to the build.

---

## Changing the number by hand

Left sidebar: **Table Editor** → **plant**. One row. Click the `likes` cell,
type a number, press Enter.

That is the whole procedure. It takes effect on the next page load — no deploy,
no commit, no build. This is the reason the count lives here and not in the
repo: it is a fact about the world, and a fact you cannot correct from your
phone on a train is a fact you will not correct.

The other three things about the plant are **not** here, on purpose:

| Thing | Where | Why there |
|---|---|---|
| The count | this table | a fact; changes without a deploy |
| When it grows — `plant.t1`..`plant.t4` | `?tune` → Plant, saved to `tuned.json` | a design decision; belongs in a diff |
| A starting number — `plant.seed` | same | visible and versioned beats hidden and forgotten |
| Pinning a stage — `plant.pin` | same | an override; -1 means "read the count" |

See `src/stages/desk/params.ts` for those. Open the site with `?tune`, drag,
press **Save**, and the values land in `src/stages/desk/tuned.json`.

---

## Keeping it awake

A free Supabase project pauses after about a week with no traffic. A paused
project answers nothing, and the site falls back to each visitor's local count —
so the plant still works, but the shared number quietly stops being shared.

The content sync already runs every 30 minutes, so it does the ping. There is a
step at the end of `.github/workflows/sync-content.yml`:

```yaml
      # Keeps the plant's database awake. A free Supabase project pauses after
      # about a week idle, and this workflow already runs every 30 minutes, so
      # a HEAD on one row is the cheapest possible insurance.
      #
      # continue-on-error, and it does nothing at all when the variables are
      # unset: a sleeping plant must never be the reason content fails to
      # deploy.
      - name: Keep the plant's database awake
        if: vars.PUBLIC_SUPABASE_URL != ''
        continue-on-error: true
        run: |
          curl -sS -I -o /dev/null \
            -H "apikey: ${{ vars.PUBLIC_SUPABASE_ANON_KEY }}" \
            "${{ vars.PUBLIC_SUPABASE_URL }}/rest/v1/plant?select=likes&limit=1"
```

No new workflow, no new schedule, no new secret.

---

## What someone can still do, plainly

The anon key is in the bundle. Anyone who opens devtools can find it and call
the function from a terminal. That is not a flaw to fix — it is how the key
works, and the locks above are what make it survivable.

**They can add likes.** Up to 500 a day, then the function stops counting until
midnight UTC and returns the true total to everybody. So the number can drift
upward by a bounded amount. It cannot become absurd overnight.

**They can spend the day's ceiling on purpose,** which means real visitors click
a button that does nothing until tomorrow. That is a real, cheap attack and the
design chooses it over an uncapped counter. The alternative is per-visitor rate
limiting, which needs a table of IP addresses — a privacy cost and a maintenance
cost, to guarantee the accuracy of a houseplant. Not worth it.

**They cannot** set the count to a chosen value, lower it, delete the row or the
table, read any other column or table, or learn anything about any visitor —
nothing identifying is stored, so there is nothing to leak. The function takes
no arguments, so there is nothing to inject.

**If it ever happens,** two statements in the SQL editor and no deploy:

```sql
update public.plant set likes = 42 where id = 1;          -- put it back
revoke execute on function public.water_plant() from anon; -- stop the button
```

The second turns the button into a no-op site-wide in about three seconds. The
page keeps rendering, because a failed call is the same as no database at all
and the site already handles that.

**One caveat worth writing down.** The anon key is public, so row-level security
is the only thing protecting *anything* in this project. Today it holds one
table and that is trivially fine. The day a second table is added here without
RLS enabled, that key reads it. Keep this project for the plant.

---

## If something does not work

**The plant is there but the number never changes between browsers.** The
variables were not set at build time. Check `.env`, restart the dev server, and
for the live site check the two repository *variables*.

**A 404 on `rpc/water_plant` right after running the SQL.** Supabase caches the
list of callable functions. Give it a minute, or **Project Settings → API →
Reload schema**.

**A 401 or 403.** The key is wrong, or the `grant`/`revoke` lines did not run.
Re-run the whole SQL block; it is safe to repeat.

**Nothing in the console and the count stays at 0.** That is the fallback
working as designed. The desk never waits on this and never shows an error for
it — see the header of `src/stages/desk/likes.ts`.
