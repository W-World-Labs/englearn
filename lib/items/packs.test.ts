import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { CEFRLevel, Item } from "@/lib/types";
import {
  DEDICATED_PACK_IDS,
  dedicatedPackStats,
  findItemById,
  getActivePackItems,
  getPackItemById,
  getPackItems,
  hasDedicatedPack,
  resolveContentPack,
  type ContentPackId,
} from "./packs";
import { getItemsByModule } from "@/lib/items";

const MODULE_MINIMUMS: Record<string, number> = {
  vocabulary: 20,
  grammar: 28,
  reading: 5,
  listening: 5,
};

describe("content packs", () => {
  it("resolves dedicated packs", () => {
    expect(resolveContentPack("zh")).toBe("zh");
    expect(resolveContentPack("ko")).toBe("ko");
    expect(resolveContentPack("ja")).toBe("ja");
    expect(resolveContentPack("es")).toBe("es");
    expect(resolveContentPack("fr")).toBe("en");
  });

  it("loads non-empty banks", () => {
    expect(getPackItems("zh").length).toBeGreaterThan(50);
    expect(getPackItems("ko").length).toBeGreaterThan(50);
    expect(getPackItems("ja").length).toBeGreaterThan(50);
    expect(getPackItems("es").length).toBeGreaterThan(50);
    expect(getPackItems("en").length).toBeGreaterThan(200);
  });

  it("keeps minimum per-module depth in every dedicated pack", () => {
    for (const packId of DEDICATED_PACK_IDS) {
      const items = getActivePackItems(packId);
      const counts = new Map<string, number>();
      for (const item of items) {
        counts.set(item.module, (counts.get(item.module) ?? 0) + 1);
      }
      for (const [module, minimum] of Object.entries(MODULE_MINIMUMS)) {
        expect(
          counts.get(module) ?? 0,
          `${packId} ${module} has ${counts.get(module) ?? 0} items (min ${minimum})`,
        ).toBeGreaterThanOrEqual(minimum);
      }
      const openCount =
        (counts.get("speaking") ?? 0) + (counts.get("writing") ?? 0);
      expect(openCount, `${packId} open items`).toBeGreaterThanOrEqual(10);
    }
  });
});

// CEFR is a fixed six-level scale, so these constants are not growth-sensitive
// (unlike bank sizes; see FAILURES F6).
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const ITEM_MODULES = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "writing",
] as const;
const ITEM_FORMATS = [
  "yesno",
  "mcq",
  "reading-mcq",
  "listening-mcq",
  "open",
] as const;
const PACK_CONTENT_LANG: Record<ContentPackId, string> = {
  en: "en-US",
  zh: "zh-CN",
  ko: "ko-KR",
  ja: "ja-JP",
  es: "es-ES",
};
const cefrRank = (level: CEFRLevel) => CEFR_LEVELS.indexOf(level);

function itemsByModule(packId: ContentPackId): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of getPackItems(packId)) {
    const group = groups.get(item.module) ?? [];
    group.push(item);
    groups.set(item.module, group);
  }
  return groups;
}

describe("content pack integrity", () => {
  it("keeps the full item shape in every pack for all five languages", () => {
    for (const packId of DEDICATED_PACK_IDS) {
      const items = getPackItems(packId);
      expect(items.length, `${packId} is non-empty`).toBeGreaterThan(0);
      for (const item of items) {
        const where = `${packId}:${item.id}`;
        expect(typeof item.id, `${where} id`).toBe("string");
        expect(item.id.length, `${where} id length`).toBeGreaterThan(0);
        expect(ITEM_MODULES, `${where} module`).toContain(item.module);
        expect(ITEM_FORMATS, `${where} format`).toContain(item.format);
        expect(CEFR_LEVELS, `${where} cefr`).toContain(item.cefr);
        expect(typeof item.prompt, `${where} prompt`).toBe("string");
        expect(item.prompt.length, `${where} prompt length`).toBeGreaterThan(0);
        expect(Number.isFinite(item.irt.a), `${where} irt.a`).toBe(true);
        expect(Number.isFinite(item.irt.b), `${where} irt.b`).toBe(true);
        // concatPack stamps the pack's BCP-47 tag when the source file omits it.
        expect(item.contentLang, `${where} contentLang`).toBe(
          PACK_CONTENT_LANG[packId],
        );
      }
    }
  });

  it("introduces CEFR levels in non-decreasing order inside every module", () => {
    for (const packId of DEDICATED_PACK_IDS) {
      for (const [module, items] of itemsByModule(packId)) {
        const seen = new Set<CEFRLevel>();
        let highest = -1;
        for (const item of items) {
          if (seen.has(item.cefr)) continue;
          seen.add(item.cefr);
          const rank = cefrRank(item.cefr);
          expect(
            rank,
            `${packId}/${module} first introduces ${item.cefr} after rank ${highest}`,
          ).toBeGreaterThanOrEqual(highest);
          highest = Math.max(highest, rank);
        }
      }
    }
  });

  it("covers a contiguous CEFR range in every module with no level gaps", () => {
    for (const packId of DEDICATED_PACK_IDS) {
      for (const [module, items] of itemsByModule(packId)) {
        const levels = [...new Set(items.map((item) => item.cefr))]
          .map(cefrRank)
          .sort((a, b) => a - b);
        expect(levels.length, `${packId}/${module} has levels`).toBeGreaterThan(
          0,
        );
        for (let i = 1; i < levels.length; i += 1)
          expect(
            levels[i] - levels[i - 1],
            `${packId}/${module} gap between ${CEFR_LEVELS[levels[i - 1]]} and ${CEFR_LEVELS[levels[i]]}`,
          ).toBe(1);
      }
    }
  });

  it("covers all six CEFR levels across the catalogue and a four-level band per pack", () => {
    const union = new Set<CEFRLevel>();
    for (const packId of DEDICATED_PACK_IDS) {
      const levels = [...new Set(getPackItems(packId).map((i) => i.cefr))]
        .map(cefrRank)
        .sort((a, b) => a - b);
      for (const level of levels) union.add(CEFR_LEVELS[level]);
      expect(
        levels[levels.length - 1] - levels[0] + 1,
        `${packId} contiguous band`,
      ).toBe(levels.length);
      // Every dedicated pack must teach a substantial CEFR span (>= 4 of 6).
      expect(
        levels.length,
        `${packId} covers ${levels.length} CEFR levels`,
      ).toBeGreaterThanOrEqual(4);
    }
    expect([...union].sort()).toEqual([...CEFR_LEVELS].sort());
  });

  it("indexes every item by id in both the pack map and the global lookup", () => {
    for (const packId of DEDICATED_PACK_IDS) {
      for (const item of getPackItems(packId)) {
        expect(getPackItemById(packId, item.id), item.id).toBe(item);
        expect(findItemById(item.id), item.id).toBe(item);
      }
    }
    const stats = dedicatedPackStats();
    expect(stats.map((s) => s.id).sort()).toEqual(
      [...DEDICATED_PACK_IDS].sort(),
    );
    for (const { id, total } of stats)
      expect(total, `${id} total`).toBe(getPackItems(id).length);
  });

  it("isolates packs by id and falls back safely for unknown languages and items", () => {
    const idsByPack = new Map<ContentPackId, Set<string>>();
    for (const packId of DEDICATED_PACK_IDS) {
      const ids = getPackItems(packId).map((item) => item.id);
      expect(new Set(ids).size, `${packId} unique ids`).toBe(ids.length);
      idsByPack.set(packId, new Set(ids));
    }
    for (const owner of DEDICATED_PACK_IDS) {
      for (const other of DEDICATED_PACK_IDS) {
        if (owner === other) continue;
        const foreign = [...idsByPack.get(other)!][0];
        expect(
          getPackItemById(owner, foreign),
          `${other} id ${foreign} must not leak into ${owner}`,
        ).toBeNull();
      }
    }
    expect(getPackItemById("en", "does-not-exist")).toBeNull();
    expect(findItemById("does-not-exist")).toBeNull();
    expect(resolveContentPack("fr")).toBe("en");
    // Empty input normalizes to the English fallback, which is itself dedicated.
    expect(resolveContentPack("")).toBe("en");
    expect(hasDedicatedPack("fr")).toBe(false);
    expect(hasDedicatedPack("")).toBe(true);
  });

  it("normalizes language variants to their dedicated pack", () => {
    const expected: Array<[string, ContentPackId]> = [
      ["en", "en"],
      ["en-US", "en"],
      ["zh", "zh"],
      ["zh-CN", "zh"],
      ["ko", "ko"],
      ["ko-KR", "ko"],
      ["ja", "ja"],
      ["ja-JP", "ja"],
      ["es", "es"],
      ["es-ES", "es"],
    ];
    for (const [input, packId] of expected) {
      expect(resolveContentPack(input), input).toBe(packId);
      expect(hasDedicatedPack(input), input).toBe(true);
    }
  });

  it("returns deterministic selection results across repeated calls", () => {
    for (const packId of DEDICATED_PACK_IDS) {
      const first = getPackItems(packId);
      expect(getPackItems(packId), `${packId} stable array`).toBe(first);
      for (const item of first.slice(0, 5))
        expect(getPackItemById(packId, item.id), item.id).toBe(item);
      expect(resolveContentPack(packId), packId).toBe(packId);
    }
    expect(dedicatedPackStats()).toEqual(dedicatedPackStats());
  });

  it("keeps the generator's 3:1 pseudoword design in the four generated vocabulary packs", () => {
    for (const packId of ["zh", "ja", "ko", "es"] as const) {
      const vocab = getPackItems(packId).filter(
        (item) => item.module === "vocabulary",
      );
      const fake = vocab.filter((item) => item.isPseudoword === true).length;
      const real = vocab.length - fake;
      expect(fake, `${packId} pseudowords`).toBeGreaterThan(0);
      expect(fake * 3, `${packId} real:pseudoword 3:1`).toBe(real);
    }
    const enVocab = getPackItems("en").filter(
      (item) => item.module === "vocabulary",
    );
    expect(enVocab.some((item) => item.isPseudoword === true)).toBe(true);
    expect(enVocab.some((item) => item.isPseudoword !== true)).toBe(true);
  });
});
// Frozen prefixes protect persisted answer indices and IDs during expansions.
const HISTORICAL_PACK_DIGESTS = {
  "zh": {
    "grammar": "9dfd22e2c53f9d300da7b4b82e474fdce875b6e221b7580c8ce23788b6a2b0e9",
    "open": "963b7484bc626dd86b1e65c9a76dd3705acb325baf855d12eef140e506def913"
  },
  "ja": {
    "grammar": "b068864b061ab75991a9fe1e53dadeaf3f4b39a130428723ab6d6320e9a914c2",
    "open": "5d792cf1deeaecd106867dc2f9522531aeeb8c6ebfffef20b4fb21ace21695d0"
  },
  "ko": {
    "grammar": "d45452ae928770e010841202df6945b8511f1317d889e7b8dc1299452b42ce64",
    "open": "df03d980f884114ef2db43bb3f5cc0a33899c75cfb36a9228190f83f2d23639a"
  },
  "es": {
    "grammar": "37db3532d4d0bce4b2ea1fc5551aed4525c99d0d8caae4adf704af6e9b0eaa6b",
    "open": "c52940209af6a4ef86446cd1f022f26a628656a733bf709ad9c554f3faaa9baa"
  }
} as const;
it("preserves every historical grammar/open item and validates the appended expansion", () => {
  for (const pack of ["zh", "ja", "ko", "es"] as const) {
    for (const kind of ["grammar", "open"] as const) {
      const rows = getPackItems(pack).filter(item => kind === "open" ? item.format === "open" : item.module === "grammar");
      const prefixLength = kind === "grammar" ? 20 : 8;
      const digest = createHash("sha256").update(JSON.stringify(rows.slice(0, prefixLength))).digest("hex");
      expect(digest, `${pack}/${kind} historical prefix`).toBe(HISTORICAL_PACK_DIGESTS[pack][kind]);
      const fresh = rows.slice(prefixLength);
      expect(fresh.length).toBeGreaterThanOrEqual(kind === "grammar" ? 4 : 2);
      const prompts = rows.map(item => item.prompt);
      expect(new Set(prompts).size, `${pack}/${kind} distinct prompts`).toBe(prompts.length);
      for (const item of fresh) {
        if (kind === "grammar") {
          expect(new Set(item.options).size, item.id).toBe(4);
          expect(Number.isInteger(item.answerIndex), item.id).toBe(true);
          expect(item.options?.[item.answerIndex!], item.id).toBeTruthy();
        } else {
          expect(item.prompt.length, item.id).toBeGreaterThan(60);
          expect(item.rubric, item.id).toBeTruthy();
        }
      }
      if (kind === "grammar") {
        expect(fresh.slice(0, 4).map(item => item.answerIndex)).toEqual([0, 1, 2, 3]);
        // The newest four items are the 2026-09-22 depth pass; keys stay rotated.
        expect(rows.slice(-4).map(item => item.answerIndex), `${pack} newest grammar keys`).toEqual([0, 1, 2, 3]);
        expect(rows.slice(-4).every(item => item.retired !== true), `${pack} newest grammar active`).toBe(true);
      }
    }
  }
});

describe("retired pack items", () => {
  const RETIRED_ZH_GRAMMAR = ["zh-gra-006", "zh-gra-014", "zh-gra-017"] as const;

  it("keeps retired items resolvable by id for historical session replay", () => {
    for (const id of RETIRED_ZH_GRAMMAR) {
      const viaPack = getPackItemById("zh", id);
      expect(viaPack?.retired, id).toBe(true);
      expect(findItemById(id), id).toBe(viaPack);
      // Answer keys stay immutable: options and answerIndex are still served.
      expect(viaPack?.options?.length, id).toBeGreaterThan(0);
      expect(Number.isInteger(viaPack?.answerIndex), id).toBe(true);
    }
  });

  it("excludes retired items from new selection banks but keeps them in the raw pack", () => {
    const rawIds = getPackItems("zh").map((item) => item.id);
    const activeIds = getActivePackItems("zh").map((item) => item.id);
    const bankIds = getItemsByModule("grammar", "zh").map((item) => item.id);
    for (const id of RETIRED_ZH_GRAMMAR) {
      expect(rawIds, id).toContain(id);
      expect(activeIds, id).not.toContain(id);
      expect(bankIds, id).not.toContain(id);
    }
    expect(getActivePackItems("zh").some((item) => item.retired)).toBe(false);
  });

  it("links every retired zh grammar item to an active replacement", () => {
    const zh = getPackItems("zh");
    for (const id of RETIRED_ZH_GRAMMAR) {
      const successors = zh.filter(
        (item) => item.replaces === id && item.module === "grammar" && !item.retired,
      );
      expect(successors.length, `${id} replacement`).toBeGreaterThanOrEqual(1);
      for (const item of successors) {
        expect(new Set(item.options).size, item.id).toBe(4);
        expect(item.options?.[item.answerIndex!], item.id).toBeTruthy();
      }
    }
  });
});

it("excludes ambiguous English grammar from new tests while preserving historical answer keys", () => {
  const historical = {
    "gra-004": 2,
    "gra-006": 2,
    "gra-028": 1,
    "gra-034": 2,
    "gra-044": 1,
  };
  const active = getActivePackItems("en");
  for (const [id, key] of Object.entries(historical)) {
    const item = getPackItemById("en", id)!;
    expect(item.retired).toBe(true);
    expect(item.answerIndex).toBe(key);
    expect(active.some(q => q.id === id)).toBe(false);
    expect(findItemById(id)).toBe(item);
  }
});
