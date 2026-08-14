# TODO

Build-scoped tasks. Ideas live in [vision.md](vision.md); the flow is in
[workflow.md](../work/workflow.md).

**State, 2026-08-14: the live desk is shipped.** https://lilithfactor.github.io/
is a paper-craft desk with printed outcomes, click-to-open panels, an
adjustable lamp, sound, cursor parallax, and full STAR case-study pages.
Everything below the line is what remains.

---

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
