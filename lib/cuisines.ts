/**
 * Maps raw OpenStreetMap tags to the filterable attributes used in the app:
 * cuisine groups, venue types, meals, dietary info, and price category.
 * A place can (and often does) land in several groups.
 */

const GROUPS: Record<string, string[]> = {
  american: ["american", "burger", "barbecue", "bbq", "steak_house", "steak", "diner", "wings", "sandwich", "hot_dog", "cheesesteak"],
  african: ["african", "ethiopian", "nigerian", "senegalese", "west_african", "moroccan", "egyptian"],
  bagels: ["bagel", "bagel_shop"],
  bakery: ["bakery", "pastry", "patisserie"],
  breakfast: ["breakfast", "brunch", "pancake", "waffle"],
  british: ["british", "english", "scottish", "fish_and_chips"],
  caribbean: ["caribbean", "jamaican", "haitian", "trinidadian", "bahamian"],
  chinese: ["chinese", "dim_sum", "dumpling", "dumplings", "noodle", "sichuan", "cantonese", "hotpot", "hot_pot", "taiwanese", "bao"],
  coffee: ["coffee_shop", "cafe", "coffee", "tea", "bubble_tea", "boba"],
  deli: ["deli", "delicatessen"],
  dessert: ["dessert", "ice_cream", "gelato", "cake", "donut", "doughnut", "frozen_yogurt", "chocolate", "crepe", "cookie", "cupcake", "shaved_ice"],
  drinks: ["bar", "pub", "cocktail", "wine_bar", "brewery", "beer", "biergarten", "nightclub", "speakeasy", "wine", "sake"],
  eastern_european: ["polish", "ukrainian", "russian", "hungarian", "czech", "romanian", "georgian", "uzbek", "balkan"],
  filipino: ["filipino"],
  french: ["french", "bistro", "brasserie", "creperie"],
  german: ["german", "bavarian", "austrian", "swiss"],
  greek: ["greek", "gyro", "souvlaki"],
  halal: ["halal"],
  hawaiian: ["hawaiian", "poke"],
  healthy: ["salad", "juice", "smoothie", "acai", "health", "grain_bowl", "healthy"],
  indian: ["indian", "curry", "south_indian", "pakistani", "bangladeshi", "nepalese", "sri_lankan"],
  indonesian: ["indonesian", "malaysian", "singaporean"],
  italian: ["italian", "pizza", "pasta", "sicilian", "neapolitan", "roman"],
  japanese: ["japanese", "sushi", "ramen", "izakaya", "udon", "yakitori", "tempura", "onigiri", "katsu"],
  jewish: ["jewish", "kosher", "israeli"],
  korean: ["korean", "korean_fried_chicken", "kbbq", "korean_bbq"],
  latin: ["latin_american", "peruvian", "cuban", "dominican", "colombian", "brazilian", "argentinian", "venezuelan", "el_salvadorian", "salvadoran", "puerto_rican", "ecuadorian", "arepa", "empanada"],
  mediterranean: ["mediterranean", "lebanese", "turkish", "falafel", "kebab", "middle_eastern", "shawarma", "persian", "iranian", "afghan", "syrian", "yemeni"],
  mexican: ["mexican", "taco", "tacos", "tex-mex", "burrito", "quesadilla", "birria"],
  portuguese: ["portuguese"],
  seafood: ["seafood", "fish", "oyster", "lobster", "crab", "clam", "raw_bar"],
  soul_food: ["soul_food", "southern", "cajun", "creole", "fried_chicken", "chicken"],
  spanish: ["spanish", "tapas", "basque", "paella"],
  thai: ["thai"],
  vegan_vegetarian: ["vegan", "vegetarian", "plant_based"],
  vietnamese: ["vietnamese", "pho", "banh_mi"],
};

const LOOKUP: Record<string, string> = {};
for (const [group, keys] of Object.entries(GROUPS)) {
  for (const k of keys) LOOKUP[k] = group;
}

export const ALL_CUISINE_TAGS = Object.keys(GROUPS).sort();

export const CUISINE_EMOJI: Record<string, string> = {
  american: "🍔",
  african: "🍲",
  bagels: "🥯",
  bakery: "🥐",
  breakfast: "🥞",
  british: "🍟",
  caribbean: "🍗",
  chinese: "🥡",
  coffee: "☕",
  deli: "🥪",
  dessert: "🍰",
  drinks: "🍸",
  eastern_european: "🥟",
  filipino: "🍢",
  french: "🥖",
  german: "🥨",
  greek: "🥙",
  halal: "🧆",
  hawaiian: "🐟",
  healthy: "🥗",
  indian: "🍛",
  indonesian: "🍜",
  italian: "🍕",
  japanese: "🍣",
  jewish: "🥯",
  korean: "🍖",
  latin: "🫓",
  mediterranean: "🧆",
  mexican: "🌮",
  portuguese: "🐙",
  seafood: "🦞",
  soul_food: "🍗",
  spanish: "🥘",
  thai: "🍤",
  vegan_vegetarian: "🌱",
  vietnamese: "🍜",
};

export const VENUE_EMOJI: Record<string, string> = {
  food: "🍽️",
  drinks: "🍸",
  cafe: "☕",
  dessert: "🍦",
};

export function labelForTag(tag: string): string {
  const special: Record<string, string> = {
    vegan_vegetarian: "Vegan / Vegetarian",
    eastern_european: "Eastern European",
    soul_food: "Soul Food / Southern",
    bagels: "Bagels",
    latin: "Latin American",
  };
  if (special[tag]) return special[tag];
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

/**
 * Venue types: food | drinks | cafe | dessert (a place can be several — a
 * restaurant with a bar is food + drinks, which the "Food & Drinks" filter
 * matches).
 */
export function venueTypesFromOsm(tags: Record<string, string>): string[] {
  const amenity = tags["amenity"] ?? "";
  const out = new Set<string>();
  const cuisines = cuisinesFromOsm(tags);

  if (["restaurant", "fast_food", "food_court"].includes(amenity)) out.add("food");
  if (["bar", "pub", "biergarten", "nightclub"].includes(amenity)) {
    out.add("drinks");
    // bars that serve food
    if (tags["cuisine"] || tags["food"] === "yes") out.add("food");
  }
  if (amenity === "cafe") out.add("cafe");
  if (amenity === "ice_cream") out.add("dessert");
  if (cuisines.includes("dessert") || cuisines.includes("bakery")) out.add("dessert");
  if (cuisines.includes("coffee") && amenity !== "cafe") out.add("cafe");
  // restaurants with a real bar
  if (out.has("food") && (tags["bar"] === "yes" || cuisines.includes("drinks"))) out.add("drinks");
  if (out.size === 0) out.add("food");
  return [...out];
}

/** Meals served: breakfast | lunch | dinner (best-effort from open data). */
export function mealsFromOsm(tags: Record<string, string>): string[] {
  const amenity = tags["amenity"] ?? "";
  const cuisines = cuisinesFromOsm(tags);
  const out = new Set<string>();

  const breakfasty =
    tags["breakfast"] === "yes" ||
    tags["brunch"] === "yes" ||
    ["breakfast", "bagels", "bakery", "coffee"].some((c) => cuisines.includes(c)) ||
    amenity === "cafe";
  if (breakfasty) out.add("breakfast");
  if (tags["lunch"] === "yes" || ["restaurant", "fast_food", "food_court", "cafe"].includes(amenity)) {
    out.add("lunch");
  }
  if (
    tags["dinner"] === "yes" ||
    ["restaurant", "bar", "pub", "biergarten", "nightclub"].includes(amenity)
  ) {
    out.add("dinner");
  }
  return [...out];
}

/**
 * Dietary attributes. Plain value = the whole place qualifies
 * ("vegan"); `_options` suffix = has some options ("vegan_options").
 */
export function dietaryFromOsm(tags: Record<string, string>): string[] {
  const out = new Set<string>();
  const diets: [string, string][] = [
    ["diet:vegan", "vegan"],
    ["diet:vegetarian", "vegetarian"],
    ["diet:gluten_free", "gluten_free"],
    ["diet:healthy", "healthy"],
  ];
  for (const [tag, name] of diets) {
    const v = (tags[tag] ?? "").toLowerCase();
    if (v === "only") out.add(name);
    else if (v === "yes" || v === "limited") out.add(`${name}_options`);
  }
  const cuisines = cuisinesFromOsm(tags);
  if (cuisines.includes("healthy")) out.add("healthy");
  if (cuisines.includes("vegan_vegetarian")) {
    const raw = (tags["cuisine"] ?? "").toLowerCase();
    if (raw.includes("vegan")) out.add("vegan");
    else out.add("vegetarian");
  }
  // vegan implies vegetarian
  if (out.has("vegan")) out.add("vegetarian");
  if (out.has("vegan_options")) out.add("vegetarian_options");
  return [...out];
}

/** Price bucket: fast_food | cheap | moderate | fine_dining | luxury. */
export function priceCategoryFrom(
  tags: Record<string, string>,
  priceLevel?: number
): string | undefined {
  if ((tags["amenity"] ?? "") === "fast_food") return "fast_food";
  if (priceLevel == null) return undefined;
  if (priceLevel <= 1) return "cheap";
  if (priceLevel === 2) return "moderate";
  if (priceLevel === 3) return "fine_dining";
  return "luxury";
}

// ── Price estimation ──────────────────────────────────────────────────────
// Open map data rarely carries prices, so when it's missing we estimate the
// bucket the way you'd guess from a Google result: venue type + cuisine +
// name signals. Estimates are flagged so the UI can show them as "~$$".

const CHEAP_CUISINES = new Set([
  "pizza", "bagel", "bagels", "deli", "taco", "tacos", "burrito", "falafel",
  "shawarma", "kebab", "halal", "donut", "doughnut", "sandwich", "hot_dog",
  "fried_chicken", "chicken", "empanada", "arepa", "dumpling", "dumplings",
  "noodle", "pho", "banh_mi", "bubble_tea", "boba", "juice", "smoothie",
  "ice_cream", "gelato", "frozen_yogurt", "coffee_shop", "coffee", "tea",
  "bakery", "pastry", "crepe", "pancake", "waffle", "gyro", "souvlaki",
]);

const CHEAP_GROUPS = new Set(["dessert", "coffee", "bagels", "bakery", "deli", "breakfast"]);

const FINE_CUISINES = new Set([
  "sushi", "french", "oyster", "raw_bar", "fine_dining", "steak",
]);

const FINE_NAME_WORDS =
  /\b(prime|oyster|le |chez |maison|atelier|bistro|supper club|trattoria)\b/i;

// $100+ per-person signals
const LUXURY_CUISINES = new Set([
  "steak_house", "omakase", "kaiseki", "tasting_menu",
]);

const LUXURY_NAME_WORDS =
  /\b(steakhouse|steak house|chophouse|omakase|kaiseki|tasting|michelin|caviar|la grenouille)\b/i;

const CHEAP_NAME_WORDS =
  /\b(pizza|pizzeria|bagel|deli|taco|taqueria|halal|shack|cart|express|to go|takeout|donut|doughnut|dumpling|noodle|chicken|burger|sub|sandwich|bodega|luncheonette)\b/i;

/**
 * Estimate {category, level} when real price data is missing.
 * level: 1 = $ ($20–40pp) · 2 = $$ (40–70) · 3 = $$$ (70–100) · 4 = $$$$ (100+).
 * Fast food (~$10–20) is its own bucket at level 1.
 */
export function estimatePrice(
  tags: Record<string, string>,
  name: string
): { category: string; level: number } {
  const amenity = tags["amenity"] ?? "";
  if (amenity === "fast_food") return { category: "fast_food", level: 1 };

  const rawCuisines = (tags["cuisine"] ?? "")
    .toLowerCase()
    .split(";")
    .map((s) => s.trim().replace(/\s+/g, "_"))
    .filter(Boolean);
  const groups = cuisinesFromOsm(tags);

  if (rawCuisines.some((c) => LUXURY_CUISINES.has(c)) || LUXURY_NAME_WORDS.test(name)) {
    return { category: "luxury", level: 4 };
  }
  if (rawCuisines.some((c) => FINE_CUISINES.has(c)) || FINE_NAME_WORDS.test(name)) {
    return { category: "fine_dining", level: 3 };
  }
  if (
    rawCuisines.some((c) => CHEAP_CUISINES.has(c)) ||
    groups.some((g) => CHEAP_GROUPS.has(g)) ||
    CHEAP_NAME_WORDS.test(name) ||
    amenity === "ice_cream"
  ) {
    return { category: "cheap", level: 1 };
  }
  if (amenity === "cafe") return { category: "cheap", level: 1 };
  // restaurants & bars with no other signal: moderate
  return { category: "moderate", level: 2 };
}

/** Per-person dollar ranges shown throughout the app. */
export const PRICE_CATEGORY_LABELS: Record<string, string> = {
  fast_food: "Fast food · $10–20",
  cheap: "$ · 20–40",
  moderate: "$$ · 40–70",
  fine_dining: "$$$ · 70–100",
  luxury: "$$$$ · 100+",
};

export const PRICE_RANGE_BY_LEVEL: Record<number, string> = {
  1: "$20–40pp",
  2: "$40–70pp",
  3: "$70–100pp",
  4: "$100+pp",
};

export const DIETARY_LABELS: Record<string, string> = {
  healthy: "Healthy",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  gluten_free: "Gluten-free",
};

export const VENUE_LABELS: Record<string, string> = {
  food: "Restaurant",
  drinks: "Bar",
  food_and_drinks: "Restaurant & Bar",
  dessert: "Dessert",
  cafe: "Cafe",
};

export const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** Emoji for a map marker, preferring whatever the user is filtering by. */
export function emojiForPlace(
  place: { cuisines: string[]; venueTypes?: string[]; dietary?: string[] },
  activeCuisines: Set<string>,
  activeDietary: Set<string>
): string {
  if (activeCuisines.size > 0) {
    const hit = place.cuisines.find((c) => activeCuisines.has(c));
    if (hit && CUISINE_EMOJI[hit]) return CUISINE_EMOJI[hit];
  }
  if (activeDietary.size > 0 && place.dietary?.length) {
    if (activeDietary.has("healthy")) return "🥗";
    return "🌱";
  }
  for (const c of place.cuisines) {
    if (CUISINE_EMOJI[c]) return CUISINE_EMOJI[c];
  }
  for (const v of place.venueTypes ?? []) {
    if (VENUE_EMOJI[v]) return VENUE_EMOJI[v];
  }
  return "🍽️";
}
