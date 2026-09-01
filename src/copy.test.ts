import { describe, expect, test } from "bun:test";
import { type LoadedConfig, validateEmphasis } from "./config.ts";
import { findEmphasis } from "./copy.ts";

describe("findEmphasis", () => {
  test("finds the first phrase without requiring matching case", () => {
    expect(findEmphasis("Plan less. Ship Faster.", "ship faster")).toEqual({ start: 11, end: 22 });
  });

  test("trims the configured phrase", () => {
    expect(findEmphasis("Make it yours", "  it yours  ")).toEqual({ start: 5, end: 13 });
  });

  test("keeps source indices when earlier case folding changes string length", () => {
    expect(findEmphasis("İ Plan Faster", "plan faster")).toEqual({ start: 2, end: 13 });
  });

  test("ignores blank and unmatched phrases", () => {
    expect(findEmphasis("Make it yours", "  ")).toBeNull();
    expect(findEmphasis("Make it yours", "something else")).toBeNull();
  });
});

describe("validateEmphasis", () => {
  const config = (headline: string, headlineEmphasis: string) =>
    ({
      scenes: [
        {
          kind: "screenshot",
          id: "home",
          headline: { "en-US": headline },
          headlineEmphasis: { "en-US": headlineEmphasis },
        },
      ],
    }) as LoadedConfig;

  test("accepts a localized phrase contained in its headline", () => {
    expect(() => validateEmphasis(config("Make it yours", "it yours"))).not.toThrow();
  });

  test("rejects a phrase that would silently lose its accent", () => {
    expect(() => validateEmphasis(config("Make it yours", "ship faster"))).toThrow(
      'Scene "home" headlineEmphasis for "en-US" is not in its headline.',
    );
  });

  test("uses a blank override to clear configured emphasis", () => {
    expect(() => validateEmphasis(config("Make it yours", ""))).not.toThrow();
  });

  test("rejects a phrase across an explicit line break", () => {
    expect(() => validateEmphasis(config("Make it\nyours", "it\nyours"))).toThrow(
      'Scene "home" headlineEmphasis for "en-US" must be one phrase without a line break.',
    );
  });
});
