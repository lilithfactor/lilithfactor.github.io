import { test } from "node:test";
import assert from "node:assert/strict";
import { plain, names, splitLinks, slugify, linkLabel } from "./sync-notion.mjs";

test("plain flattens rich_text and title shapes", () => {
  assert.equal(plain({ rich_text: [{ plain_text: "a " }, { plain_text: "b" }] }), "a b");
  assert.equal(plain({ title: [{ plain_text: "Name" }] }), "Name");
  assert.equal(plain(undefined), "");
});

test("names extracts multi_select values", () => {
  assert.deepEqual(names({ multi_select: [{ name: "B2B" }, { name: "SaaS" }] }), ["B2B", "SaaS"]);
  assert.deepEqual(names(undefined), []);
});

test("splitLinks handles the real comma-separated rich-text shape", () => {
  // Actual shape from the Projects database: URL, URL with trailing space
  const input =
    "https://play.google.com/store/apps/details?id=com.muretabi.app, https://muretabi.com/ ";
  assert.deepEqual(splitLinks(input), [
    "https://play.google.com/store/apps/details?id=com.muretabi.app",
    "https://muretabi.com/",
  ]);
});

test("splitLinks strips markdown-ish trailing punctuation and dedupes", () => {
  assert.deepEqual(splitLinks("see https://a.com/x), then https://a.com/x"), ["https://a.com/x"]);
  assert.deepEqual(splitLinks(""), []);
  assert.deepEqual(splitLinks(null), []);
});

test("slugify: outcome-style titles survive", () => {
  assert.equal(slugify("60% Faster Onboarding, Halved Bounce"), "60-faster-onboarding-halved-bounce");
  assert.equal(slugify("Answers to “Where should we go?”"), "answers-to-where-should-we-go");
  assert.equal(slugify("Re-designing Fermi’s Onboarding Flow"), "re-designing-fermis-onboarding-flow");
});

test("linkLabel maps hosts", () => {
  assert.equal(linkLabel("https://play.google.com/store/apps/x"), "Play Store");
  assert.equal(linkLabel("https://github.com/lilithfactor/slimly"), "GitHub");
  assert.equal(linkLabel("https://slimly.co.in/"), "Visit");
});
