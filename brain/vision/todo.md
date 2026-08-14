# TODO

Build-scoped tasks. Ideas live in [vision.md](vision.md); the flow is in
[workflow.md](../work/workflow.md).

**State, 2026-08-14: the live desk is shipped.** https://lilithfactor.github.io/
is a paper-craft desk with printed outcomes, click-to-open panels, an
adjustable lamp, sound, cursor parallax, and full STAR case-study pages.
Everything below the line is what remains.

---

## The rule: every object means something

*Set 2026-08-14.* Every 3D object on the desk is clickable and carries
significance. Nothing is set dressing — an object that opens nothing is a
texture pretending to be a control. Models chosen and fetched; see
[models.md](../design/models.md) for the object → section mapping.

- [ ] **Where did `lamp-hifi.glb` and `record-player-hifi.glb` come from?**
  Both are now the desk's two hero models (see [models.md](../design/models.md)),
  and neither has a recorded source, author or licence. CC-BY needs a credit;
  a non-commercial or no-derivatives licence would rule them out entirely.
  Until this is filled into `public/models/ATTRIBUTION.md`, the models must not
  ship. Drop-in replacements are named in `scripts/fetch-models.mjs`.

Content still needed before the two new objects can be wired:

- [ ] **Rubik's cube → speedcubing scores.** What should the panel show — PBs by
  event, an average, a competition history? Cleanest home is a new WareHouse
  database so it syncs like everything else.
- [ ] **Turntable → Spotify.** Which URL: a profile, a specific playlist, or the
  same playlist that already scores the desk? It is also the music control, so
  clicking it should probably do both.
- [ ] **Legal pad, pencil, post-its, mug** — placed but meaningless, which the
  rule forbids. Either give each one a job (a now/next note, a
  currently-reading aside) or leave them off the desk.

## Blocked on Pranav

- [ ] **ZenMux key** — saved correctly (`sk-mg-…`, 73 chars) but the API
  rejects every inference call with the same 403 a fake key gets. Most likely
  unfunded; possibly video not enabled. Until a call succeeds, oil-motion
  cannot generate a frame, which blocks the **walking figure** (and it also
  needs a reference image of you — `video_job.py` is image→video).
- [ ] **Recommendation photos + LinkedIn URLs** in the WareHouse database —
  the highest-leverage content addition available.
- [ ] **Custom domain decision** (`pranavupadhyay.com` vs staying on
  `lilithfactor.github.io`).
- [ ] **Notion webhook** for instant publish (cron is the 30-min guarantee):
  a Notion automation POSTing `repository_dispatch` needs a GitHub PAT.
- [ ] Write STAR bodies for the two sparse case studies (Configurator,
  Brand-led agent) — the other three now render in full.

## Next build

- [ ] **Wire the models into the scene.** 19 models sit in `public/models/`
  fetched, salvaged and verified — and *nothing renders them yet*. The desk is
  still entirely procedural. Needs: a loader that strips incoming materials and
  applies the paper Lambert + cut colours, bounding-box normalisation (authored
  scale is meaningless across sources — surveyed models ranged 0.005 to 48 units
  for similar real-world objects), placement against `PLACEMENTS`, and
  re-pointing `lamp.ts` at the new `head` node.
- [ ] Desk explorables: drag-to-turn cube face, chess board with a real
  position *(cut from the finished-desk push — the two stalled agents never
  reached them)*.
- [ ] Turntable object on the desk wired to the same audio as the corner
  control (the control works everywhere; the 3D object is not yet clickable).
- [ ] OG images per page, generated at build.
- [ ] Cookieless analytics + the two tracking questions in vision.md.
- [ ] Real-device pass: one mid-tier Android + one iPhone, cellular.
- [ ] Lighthouse CI gate in deploy.yml.

## Done (this arc)

- [x] Phases 0–4 as originally scoped — see git history from `b79e3bd`.
- [x] Live desk pivot: paper-craft scene, panels, handles, no raycaster.
- [x] STAR bodies synced recursively + images downloaded; outcome-first pages.
- [x] Printed outcomes on the desk sheets; adjustable lamp driving real light;
  night desk; cursor parallax; paper fibre/deckle skin.
- [x] Soundscape (opt-in, one switch) + mobile chip + warm corner.
- [x] Ops: read-only Notion token, timestamp-only sync commits killed,
  workflows pinned, brain docs corrected (STAR, ids, schema types).
- [x] Desk leaking onto case-study pages fixed (StageMount was in the shared
  layout; now homepage-only — article pages ship zero JS). See learning.md.
