/**
 * Maps raw OpenStreetMap `cuisine` / `amenity` tags to the display tags used
 * for filtering. A place can (and often does) land in several groups.
 */

const GROUPS: Record<string, string[]> = {
  greek: ["greek", "gyro", "souvlaki"],
  italian: ["italian", "pizza", "pasta", "sicilian", "neapolitan"],
  drinks: ["bar", "pub", "cocktail", "wine_bar", "brewery", "beer", "biergarten", "nightclub"],
  healthy: ["salad", "vegetarian", "vegan", "juice", "smoothie", "poke", "acai", "health"],
  dessert: ["dessert", "ice_cream", "gelato", "cake", "donut", "doughnut", "pastry", "bakery", "bubble_tea", "frozen_yogurt", "chocolate", "crepe", "waffle"],
  coffee: ["coffee_shop", "cafe", "coffee", "tea"],
  american: ["american", "burger", "barbecue", "bbq", "steak_house", "steak", "diner", "wings", "sandwich", "hot_dog"],
  mexican: ["mexican", "taco", "tex-mex", "burrito"],
  japanese: ["japanese", "sushi", "ramen", "izakaya", "udon", "yakitori"],
  chinese: ["chinese", "dim_sum", "dumpling", "dumplings", "noodle", "sichuan", "cantonese", "hotpot", "hot_pot"],
  korean: ["korean", "korean_fried_chicken", "kbbq"],
  thai: ["thai"],
  vietnamese: ["vietnamese", "pho", "banh_mi"],
  indian: ["indian", "curry", "south_indian", "pakistani", "bangladeshi"],
  mediterranean: ["mediterranean", "lebanese", "turkish", "israeli", "falafel", "kebab", "middle_eastern", "shawarma", "persian", "moroccan"],
  french: ["french", "bistro", "brasserie"],
  spanish: ["spanish", "tapas", "basque"],
  latin: ["latin_american", "peruvian", "cuban", "dominican", "colombian", "brazilian", "argentinian", "venezuelan", "el_salvadorian", "puerto_rican"],
  caribbean: ["caribbean", "jamaican", "haitian", "trinidadian"],
  seafood: ["seafood", "fish", "oyster", "fish_and_chips", "lobster", "crab"],
  breakfast: ["breakfast", "brunch", "bagel", "pancake"],
  african: ["african", "ethiopian", "nigerian", "senegalese", "west_african"],
  soul_food: ["soul_food", "southern", "cajun", "creole"],
  kosher: ["kosher"],
  halal: ["halal"],
};

const LOOKUP: Record<string, string> = {};
for (const [group, keys] of Object.entries(GROUPS)) {
  for (const k of keys) LOOKUP[k] = group;
}

export const ALL_CUISINE_TAGS = Object.keys(GROUPS);

export function labelForTag(tag: string): string {
  return tag
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Turn OSM tags into our display cuisine tags (deduped, multi-tag). */
export function cuisinesFromOsm(tags: Record<string, string>): string[] {
  const out = new Set<string>();
  const amenity = tags["amenity"] ?? "";
  const raw = (tags["cuisine"] ?? "")
    .toLowerCase()
    .split(";")
    .map((s) => s.trim().replace(/\s+/g, "_"))
    .filter(Boolean);

  if (["bar", "pub", "biergarten", "nightclub"].includes(amenity)) out.add("drinks");
  if (amenity === "cafe") out.add("coffee");
  if (amenity === "ice_cream") out.add("dessert");

  for (const c of raw) {
    const group = LOOKUP[c];
    if (group) out.add(group);
    else out.add(c); // keep unknown cuisines as their own tag
  }
  return [...out];
}

export function categoryFromOsm(tags: Record<string, string>): string {
  return tags["amenity"] ?? "restaurant";
}
