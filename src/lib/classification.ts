// 2022 political classification of a locality: top party, Arab-plurality rule
// and the continuous pro/anti-Netanyahu balance. Pure functions only.

import type { BlocVotes, Classification, ClassificationFlag, PartyDef, PartyGroup } from "./types";

export type PartyRegistry = Map<string, PartyDef>;

export function buildRegistry(parties: PartyDef[]): PartyRegistry {
  const reg: PartyRegistry = new Map();
  for (const p of parties) {
    if (reg.has(p.letter)) throw new Error(`duplicate party letter in config: ${p.letter}`);
    reg.set(p.letter, p);
  }
  return reg;
}

export interface ClassificationOptions {
  /**
   * If votes for letters missing from the registry exceed this share of valid
   * votes, the party classification is treated as insufficient and the balance
   * is reported as unavailable.
   */
  maxUnknownShare: number;
}

export const DEFAULT_CLASSIFICATION_OPTIONS: ClassificationOptions = { maxUnknownShare: 0.05 };

/** (pro − anti) / (pro + anti), or null when the denominator is zero. */
export function politicalBalance(pro: number, anti: number): number | null {
  const denom = pro + anti;
  if (!(denom > 0)) return null;
  return (pro - anti) / denom;
}

/**
 * Classify one locality from its 2022 per-party valid votes.
 *
 * Tie rule (explicit, and always flagged): when several parties share the top
 * vote count, the locality is gray only if every tied party is an Arab party —
 * then an Arab party leads whichever way the tie is broken. If the tie mixes
 * Arab and non-Arab parties, no single Arab party is the most-voted-for party,
 * so the locality is not gray and falls through to the blue–red balance.
 */
export function classifyLocality(
  votes: Record<string, number>,
  registry: PartyRegistry,
  options: ClassificationOptions = DEFAULT_CLASSIFICATION_OPTIONS,
): Classification {
  const blocVotes: BlocVotes = { pro_netanyahu: 0, anti_netanyahu: 0, arab_parties: 0, other_or_unclassified: 0 };
  const unknownLetters: string[] = [];
  let unknownVotes = 0;
  let valid = 0;
  let topVotes = 0;
  let topParties: string[] = [];

  for (const [letter, raw] of Object.entries(votes)) {
    const n = Number(raw) || 0;
    if (n < 0) throw new Error(`negative vote count for ${letter}`);
    valid += n;
    const party = registry.get(letter);
    const group: PartyGroup = party ? party.group : "other_or_unclassified";
    blocVotes[group] += n;
    if (!party && n > 0) {
      unknownLetters.push(letter);
      unknownVotes += n;
    }
    if (n > 0 && n > topVotes) {
      topVotes = n;
      topParties = [letter];
    } else if (n > 0 && n === topVotes) {
      topParties.push(letter);
    }
  }
  topParties.sort();

  const flags: ClassificationFlag[] = [];
  const share = (x: number) => (valid > 0 ? x / valid : null);
  const isTopTie = topParties.length > 1;
  const isArab = (l: string) => registry.get(l)?.group === "arab_parties";
  const arabTop = topParties.filter(isArab).length;
  const isArabPlurality = topParties.length > 0 && arabTop === topParties.length;

  if (isTopTie) flags.push("top_party_tie");
  if (isTopTie && arabTop > 0 && arabTop < topParties.length) flags.push("top_party_tie_arab_and_non_arab");
  if (unknownLetters.length) flags.push("unknown_party_letters");

  let balance = politicalBalance(blocVotes.pro_netanyahu, blocVotes.anti_netanyahu);
  if (valid === 0) flags.push("no_valid_votes");
  else if (balance === null) flags.push("no_bloc_votes");
  if (valid > 0 && unknownVotes / valid > options.maxUnknownShare) {
    flags.push("unknown_votes_above_limit");
    balance = null;
  }

  let category: Classification["category"];
  if (isArabPlurality) category = "arab_plurality";
  else if (balance !== null) category = "bloc_balance";
  else category = "unavailable";

  return {
    category,
    topParties,
    topPartyVotes: topVotes,
    topPartyShare: share(topVotes),
    isTopTie,
    isArabPlurality,
    blocVotes,
    validVotes: valid,
    proShare: share(blocVotes.pro_netanyahu),
    antiShare: share(blocVotes.anti_netanyahu),
    arabShare: share(blocVotes.arab_parties),
    otherShare: share(blocVotes.other_or_unclassified),
    balance,
    unknownLetters: unknownLetters.sort(),
    flags,
  };
}
