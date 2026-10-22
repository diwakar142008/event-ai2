export const EVENT_TYPES = [
  { value: "wedding", label: "Wedding", note: "Ceremony, dinner, and the after-party hour" },
  { value: "engagement", label: "Engagement", note: "An intimate announcement celebration" },
  { value: "birthday", label: "Birthday", note: "Milestones, dinners, and house parties" },
  { value: "anniversary", label: "Anniversary", note: "A considered room for a shared history" },
  { value: "college_festival", label: "College festival", note: "Campus programme, stalls, and stage" },
  { value: "cultural_event", label: "Cultural event", note: "Performance, heritage, and community" },
  { value: "community_celebration", label: "Community", note: "Neighbourhood and association gatherings" },
  { value: "corporate_event", label: "Corporate", note: "Launches, offsites, and receptions" },
  { value: "private_party", label: "Private party", note: "A hosted evening with a point of view" },
] as const;

export const THEMES = [
  { value: "romantic_garden", label: "Romantic garden", note: "Seasonal stems, candlelight, softness" },
  { value: "modern_editorial", label: "Modern editorial", note: "Monochrome, architectural, precise" },
  { value: "warm_minimal", label: "Warm minimal", note: "Restraint, texture, quiet luxury" },
  { value: "playful_color", label: "Playful colour", note: "Bold colour, paper, movement" },
  { value: "heritage_classic", label: "Heritage classic", note: "Velvet, silver, ceremony" },
  { value: "coastal_air", label: "Coastal air", note: "Bleached linen, sea light, ease" },
  { value: "disco_night", label: "Disco night", note: "Mirror, smoke, late hours" },
  { value: "natural_rustic", label: "Natural rustic", note: "Timber, linen, local produce" },
] as const;

export const LOCATION_TIERS = [
  { value: "metro", label: "Metro city", note: "Highest supplier density and cost" },
  { value: "large_city", label: "Large city", note: "Broad choice, mid-range cost" },
  { value: "regional", label: "Regional", note: "Fewer suppliers, lower base cost" },
] as const;

export const VENUE_TYPES = [
  { value: "garden_outdoor", label: "Garden / outdoor" },
  { value: "hotel_ballroom", label: "Hotel ballroom" },
  { value: "loft_indoor", label: "Loft / industrial" },
  { value: "banquet_hall", label: "Banquet hall" },
  { value: "community_hall", label: "Community hall" },
  { value: "private_residence", label: "Private residence" },
] as const;

export const CATERING_LEVELS = [
  { value: "none", label: "None", note: "No catering service" },
  { value: "light", label: "Light", note: "Canapés and drinks" },
  { value: "full", label: "Full service", note: "Seated or family-style meal" },
  { value: "premium", label: "Premium", note: "Multi-course, high staffing" },
] as const;

export const DECOR_LEVELS = [
  { value: "minimal", label: "Minimal" },
  { value: "classic", label: "Classic" },
  { value: "luxe", label: "Luxe" },
] as const;

export const PHOTOGRAPHY_LEVELS = [
  { value: "none", label: "None" },
  { value: "partial", label: "Partial coverage" },
  { value: "full", label: "Full coverage" },
] as const;

export function labelFor(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
