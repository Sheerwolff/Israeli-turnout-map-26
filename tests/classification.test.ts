import { describe, expect, it } from "vitest";
import parties from "../config/parties-2022.json";
import { buildRegistry, classifyLocality, politicalBalance } from "../src/lib/classification";
import type { PartyDef } from "../src/lib/types";

// Small synthetic registry so each case is explicit about which group a letter belongs to.
const reg = buildRegistry([
  { letter: "P1", name_he: "", name_en: "Pro A", group: "pro_netanyahu" },
  { letter: "P2", name_he: "", name_en: "Pro B", group: "pro_netanyahu" },
  { letter: "A1", name_he: "", name_en: "Anti A", group: "anti_netanyahu" },
  { letter: "A2", name_he: "", name_en: "Anti B", group: "anti_netanyahu" },
  { letter: "R1", name_he: "", name_en: "Arab A", group: "arab_parties" },
  { letter: "R2", name_he: "", name_en: "Arab B", group: "arab_parties" },
  { letter: "R3", name_he: "", name_en: "Arab C", group: "arab_parties" },
  { letter: "O1", name_he: "", name_en: "Other", group: "other_or_unclassified" },
]);

describe("political classification", () => {
  it("case 1: an Arab party plurality below 50% is gray", () => {
    const c = classifyLocality({ R1: 40, P1: 22, A1: 18, P2: 12, O1: 8 }, reg);
    expect(c.topParties).toEqual(["R1"]);
    expect(c.topPartyShare).toBeCloseTo(0.4);
    expect(c.isArabPlurality).toBe(true);
    expect(c.category).toBe("arab_plurality");
  });

  it("case 2: Arab parties collectively large but no Arab party on top → blue–red, not gray", () => {
    // Arab parties together 45%, but the single largest party is pro-Netanyahu.
    const c = classifyLocality({ P1: 30, R1: 15, R2: 15, R3: 15, A1: 25 }, reg);
    expect(c.topParties).toEqual(["P1"]);
    expect(c.arabShare).toBeCloseTo(0.45);
    expect(c.isArabPlurality).toBe(false);
    expect(c.category).toBe("bloc_balance");
    expect(c.balance).toBeCloseTo((30 - 25) / 55);
  });

  it("case 3: strong pro-Netanyahu balance is strongly positive", () => {
    const c = classifyLocality({ P1: 600, P2: 200, A1: 100, O1: 50 }, reg);
    expect(c.category).toBe("bloc_balance");
    expect(c.balance).toBeCloseTo((800 - 100) / 900);
    expect(c.balance!).toBeGreaterThan(0.7);
  });

  it("case 4: strong anti-Netanyahu balance is strongly negative", () => {
    const c = classifyLocality({ A1: 500, A2: 300, P1: 100 }, reg);
    expect(c.balance).toBeCloseTo((100 - 800) / 900);
    expect(c.balance!).toBeLessThan(-0.7);
  });

  it("case 5: equal bloc totals give a balance of exactly 0", () => {
    const c = classifyLocality({ P1: 250, A1: 150, A2: 100, O1: 40 }, reg);
    expect(c.category).toBe("bloc_balance");
    expect(c.balance).toBe(0);
  });

  it("case 6: no votes for either bloc → balance unavailable, no invented hue", () => {
    const c = classifyLocality({ O1: 100, P1: 0, A1: 0 }, reg);
    expect(c.balance).toBeNull();
    expect(c.category).toBe("unavailable");
    expect(c.flags).toContain("no_bloc_votes");
    expect(politicalBalance(0, 0)).toBeNull();
  });

  it("case 6b: Arab plurality with no bloc votes is still gray", () => {
    const c = classifyLocality({ R1: 100, O1: 3 }, reg);
    expect(c.category).toBe("arab_plurality");
    expect(c.balance).toBeNull();
  });

  describe("case 7: tied top parties", () => {
    it("a tie between two non-Arab parties is flagged and nobody is silently picked", () => {
      const c = classifyLocality({ P1: 100, A1: 100, O1: 10 }, reg);
      expect(c.isTopTie).toBe(true);
      expect(c.topParties).toEqual(["A1", "P1"]);
      expect(c.flags).toContain("top_party_tie");
      expect(c.category).toBe("bloc_balance");
      expect(c.balance).toBe(0);
    });

    it("a tie made up only of Arab parties is gray (an Arab party leads either way) and flagged", () => {
      const c = classifyLocality({ R1: 100, R2: 100, P1: 50 }, reg);
      expect(c.isTopTie).toBe(true);
      expect(c.isArabPlurality).toBe(true);
      expect(c.flags).toContain("top_party_tie");
    });

    it("a tie between an Arab and a non-Arab party is not gray and is flagged as mixed", () => {
      const c = classifyLocality({ R1: 100, P1: 100, A1: 20 }, reg);
      expect(c.isArabPlurality).toBe(false);
      expect(c.category).toBe("bloc_balance");
      expect(c.flags).toEqual(expect.arrayContaining(["top_party_tie", "top_party_tie_arab_and_non_arab"]));
    });
  });

  it("balance denominator excludes Arab and unclassified votes", () => {
    const c = classifyLocality({ P1: 30, A1: 10, R1: 25, O1: 35 }, reg);
    expect(c.balance).toBeCloseTo(0.5);
    expect(c.proShare).toBeCloseTo(0.3);
    expect(c.antiShare).toBeCloseTo(0.1);
  });

  it("letters missing from the config are flagged, never assigned to a bloc", () => {
    const c = classifyLocality({ P1: 50, A1: 40, XX: 10 }, reg);
    expect(c.unknownLetters).toEqual(["XX"]);
    expect(c.blocVotes.other_or_unclassified).toBe(10);
    expect(c.flags).toContain("unknown_votes_above_limit");
    expect(c.balance).toBeNull();
  });

  it("no valid votes at all", () => {
    const c = classifyLocality({ P1: 0 }, reg);
    expect(c.topParties).toEqual([]);
    expect(c.category).toBe("unavailable");
    expect(c.flags).toContain("no_valid_votes");
  });
});

describe("party configuration (config/parties-2022.json)", () => {
  const list = parties.parties as PartyDef[];
  it("has unique letters and only known groups", () => {
    expect(new Set(list.map((p) => p.letter)).size).toBe(list.length);
    for (const p of list) expect(["pro_netanyahu", "anti_netanyahu", "arab_parties", "other_or_unclassified"]).toContain(p.group);
  });
  it("places the 2022 lists that won seats in the documented groups", () => {
    const g = (l: string) => list.find((p) => p.letter === l)?.group;
    expect(["מחל", "ט", "שס", "ג"].map(g)).toEqual(Array(4).fill("pro_netanyahu"));
    expect(["פה", "כן", "ל", "אמת"].map(g)).toEqual(Array(4).fill("anti_netanyahu"));
    expect(["עם", "ום"].map(g)).toEqual(Array(2).fill("arab_parties"));
  });
});
