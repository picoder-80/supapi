import supadomusCategoriesRaw from "./supadomus-categories.json";

export interface CategoryDeepNode {
  id: string;
  label: string;
}

export interface Subcategory {
  id: string;
  label: string;
  deep: CategoryDeepNode[];
}

export interface Category {
  id: string;
  label: string;
  emoji: string;
  subcategories: Subcategory[];
}

type RawCategory = {
  slug: string;
  name: string;
  icon: string;
  subcategories: Array<{
    slug: string;
    name: string;
    deep: Array<{ slug: string; name: string }>;
  }>;
};

function normalizeCategories(raw: RawCategory[]): Category[] {
  return raw.map((c) => ({
    id: c.slug,
    label: c.name,
    emoji: c.icon,
    subcategories: (c.subcategories ?? []).map((s) => ({
      id: s.slug,
      label: s.name,
      deep: (s.deep ?? []).map((d) => ({ id: d.slug, label: d.name })),
    })),
  }));
}

export const CATEGORIES: Category[] = normalizeCategories(supadomusCategoriesRaw as RawCategory[]);
export const ALL_CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function getCategoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

export function getSubcategory(catId: string, subId: string): Subcategory | undefined {
  return getCategoryById(catId)?.subcategories.find((s) => s.id === subId);
}

export function getSubcategoryLabel(catId: string, subId: string) {
  return getSubcategory(catId, subId)?.label ?? subId;
}

export function getDeepLabel(catId: string, subId: string, deepId: string) {
  const sub = getSubcategory(catId, subId);
  return sub?.deep.find((d) => d.id === deepId)?.label ?? deepId;
}

export function formatListingCategoryPath(
  category: string,
  subcategory: string,
  categoryDeep?: string | null
): string {
  if (!category) return "";
  const cat = getCategoryById(category);
  const top = cat ? `${cat.emoji} ${cat.label}` : category;
  if (!subcategory) return top;
  const subL = getSubcategoryLabel(category, subcategory);
  if (!categoryDeep) return `${top} · ${subL}`;
  const deepL = getDeepLabel(category, subcategory, categoryDeep);
  return `${top} · ${subL} · ${deepL}`;
}
