const knownCharacters = new Set(["nolik", "mcqueen", "clown-kesha", "chase", "prince", "hatter", "kutamba", "ninja-turtle", "deadpool", "james-bond", "captain-america", "black-spider-man", "cat-noir", "luke-skywalker", "harry-potter", "hawaiian", "jack-sparrow", "alice", "korzhik", "karamelka", "ladybug", "football", "aladdin", "batman", "superman", "spider-man", "among-us", "leon", "tiktok", "creeper", "ded-moroz", "snegurochka"]);
export function characterImage(slug: string) {
  if (slug === "new-year-duo" || slug === "new-year") return "/media/characters/new-year-duo.png";
  if (knownCharacters.has(slug)) return `/media/characters/${slug}.png`;
  return ({ bumblebee: "/media/bumblebee-party.jpg", "optimus-prime": "/media/optimus.png", "iron-man": "/media/iron-man.png" } as Record<string, string>)[slug];
}
export function characterIsPhoto(slug: string) {
  return ["bumblebee", "optimus-prime", "iron-man"].includes(slug);
}
export function offeringUrl(kind: string, slug: string) {
  if (kind === "package") return `/packages/${slug}`;
  if (kind === "transformer") return `/transformers/${slug}`;
  if (kind === "show") return `/shows/${slug}`;
  if (kind === "extra") return `/extras/${slug}`;
  if (kind === "seasonal") return "/new-year";
  return "/characters";
}
