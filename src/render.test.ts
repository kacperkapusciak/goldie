import { describe, expect, test } from "bun:test";
import { compareFileSets, screenshotJobs } from "./render.ts";

type Resolved = Parameters<typeof screenshotJobs>[0][number];

const scene = (id: string, span: number) =>
  ({
    scene: { id },
    layout: { span },
    secondScene: undefined,
  }) as Resolved;

describe("screenshotJobs", () => {
  test("numbers every Store tile and names panorama slices", () => {
    const jobs = screenshotJobs([scene("home", 1), scene("story", 2), scene("chat", 1)]);

    expect(jobs.map((job) => job.names)).toEqual([
      ["01-home.png"],
      ["02-story-1.png", "03-story-2.png"],
      ["04-chat.png"],
    ]);
  });
});

describe("compareFileSets", () => {
  const expected = ["01-home.png", "02-chat.png"];

  test("accepts the exact output set regardless of directory order", () => {
    expect(compareFileSets(expected, ["02-chat.png", "01-home.png"])).toEqual({
      missing: [],
      extra: [],
    });
  });

  test("reports every file missing from an empty export", () => {
    expect(compareFileSets(expected, [])).toEqual({ missing: expected, extra: [] });
  });

  test("reports missing and stale files together", () => {
    expect(compareFileSets(expected, ["01-home.png", "03-old.png"])).toEqual({
      missing: ["02-chat.png"],
      extra: ["03-old.png"],
    });
  });
});
