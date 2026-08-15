# Working in this repo

Read `brain/README.md` first — it is the map. `brain/eng/architecture.md` holds
the directives that override convenience.

## 3D

**Any change to `src/stages/desk/` consults the `threejs-*` skills first.**
They are symlinked into `.claude/skills/` from
`/Users/lilithfactor/ZeroToOne/skills/threejs-skills/` — geometry, lighting,
materials, loaders, interaction, shaders, textures, animation,
postprocessing, fundamentals. Load the ones the change touches before writing
code, not after something looks wrong.

The links point outside the repo, so they resolve on this machine only. That
is fine — this is a one-person project.

## Local first

Nothing is pushed until Pranav has looked at it on `localhost:4321`. The site
is live and people may be reading it. Commit locally, keep going, and wait to
be told.

## The tuner

`?tune` opens the live control panel. In `npm run dev` its **Save** button
writes `src/stages/desk/tuned.json` straight to disk, so a value moved with a
slider is a value that survives a reload and a build. Fold anything long-lived
back into the constants it came from and clear the file — the JSON is a
scratchpad, not the source of truth.
