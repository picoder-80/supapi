export interface Category {
  id: string;
  label: string;
  emoji: string;
  subcategories: { id: string; label: string }[];
}

export const CATEGORIES: Category[] = [
  {
    id: "autos", label: "Autos", emoji: "🚗",
    subcategories: [
      { id: "cars",              label: "Cars" },
      { id: "certified_cars",    label: "Certified Cars" },
      { id: "number_plates",     label: "Number Plates" },
      { id: "motorcycles",       label: "Motorcycles" },
      { id: "car_accessories",   label: "Car Accessories & Parts" },
      { id: "moto_accessories",  label: "Motorcycle Accessories & Parts" },
      { id: "other_accessories", label: "Other Accessories & Parts" },
      { id: "commercial",        label: "Commercial Vehicle & Boats" },
    ],
  },
  {
    id: "leisure", label: "Leisure", emoji: "⛷️",
    subcategories: [
      { id: "sports_outdoors",   label: "Sports & Outdoors" },
      { id: "hobby_collectibles",label: "Hobby & Collectibles" },
      { id: "music_movies",      label: "Music / Movies / Books / Magazines" },
      { id: "tickets_vouchers",  label: "Tickets & Vouchers" },
      { id: "music_instruments", label: "Music Instruments" },
      { id: "textbooks",         label: "Textbooks" },
    ],
  },
  {
    id: "property", label: "Property", emoji: "🏠",
    subcategories: [
      { id: "prop_sale",    label: "Properties for Sale" },
      { id: "prop_rent",    label: "Properties for Rent" },
      { id: "prop_auction", label: "Properties for Auction" },
      { id: "new_prop",     label: "New Properties" },
      { id: "room_rent",    label: "Room for Rent" },
    ],
  },
  {
    id: "jobs_services", label: "Jobs & Services", emoji: "💼",
    subcategories: [
      { id: "jobs",     label: "Jobs" },
      { id: "services", label: "Services" },
    ],
  },
  {
    id: "pets", label: "Pets", emoji: "🐾",
    subcategories: [
      { id: "pets", label: "Pets" },
    ],
  },
  {
    id: "travel", label: "Travel", emoji: "✈️",
    subcategories: [
      { id: "accommodation", label: "Accommodation & Homestays" },
      { id: "tours",         label: "Tours & Holidays" },
    ],
  },
  {
    id: "electronics", label: "Electronics", emoji: "📱",
    subcategories: [
      { id: "phones_gadgets",   label: "Mobile Phones & Gadgets" },
      { id: "phone_accessories",label: "Accessories for Phones & Gadgets" },
      { id: "tv_audio",         label: "TV / Audio / Video" },
      { id: "computers",        label: "Computers & Accessories" },
      { id: "cameras",          label: "Cameras & Photography" },
      { id: "games_consoles",   label: "Games & Consoles" },
    ],
  },
  {
    id: "home_personal", label: "Home & Personal", emoji: "🏡",
    subcategories: [
      { id: "women",       label: "Women's Collection" },
      { id: "men",         label: "Men's Collection" },
      { id: "unisex",      label: "Unisex Collection" },
      { id: "bed_bath",    label: "Bed & Bath" },
      { id: "appliances",  label: "Home Appliances & Kitchen" },
      { id: "furniture",   label: "Furniture & Decoration" },
      { id: "garden",      label: "Garden Items" },
    ],
  },
  {
    id: "b2b", label: "Business to Business", emoji: "🏢",
    subcategories: [
      { id: "biz_equipment", label: "Professional / Business Equipment" },
      { id: "biz_sale",      label: "Business for Sale" },
    ],
  },
  {
    id: "food", label: "Food", emoji: "🍜",
    subcategories: [
      { id: "food", label: "Food & Beverages" },
    ],
  },
  {
    id: "swap", label: "Items for Swap", emoji: "🔄",
    subcategories: [
      { id: "swap", label: "Items for Swap" },
    ],
  },
  {
    id: "others", label: "Everything Else", emoji: "📦",
    subcategories: [
      { id: "others", label: "Others" },
    ],
  },
];

export const ALL_CATEGORY_IDS = CATEGORIES.map(c => c.id);

export function getCategoryById(id: string) {
  return CATEGORIES.find(c => c.id === id);
}

export function getSubcategoryLabel(catId: string, subId: string) {
  const cat = getCategoryById(catId);
  return cat?.subcategories.find(s => s.id === subId)?.label ?? subId;
}

export const CONDITIONS = [
  { id: "new",         label: "Brand New" },
  { id: "like_new",    label: "Like New" },
  { id: "good",        label: "Good" },
  { id: "fair",        label: "Fair" },
  { id: "for_parts",   label: "For Parts" },
];

export const BUYING_METHODS = [
  { id: "meetup", label: "Meetup Only",    emoji: "📍" },
  { id: "ship",   label: "Shipping Only",  emoji: "📦" },
  { id: "both",   label: "Meetup or Ship", emoji: "🤝" },
];
