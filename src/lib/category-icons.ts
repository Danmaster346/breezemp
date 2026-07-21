// Иконки для категорий (по slug) — единый набор lucide.
import {
  Car,
  Sparkles,
  Refrigerator,
  Baby,
  Home,
  Package,
  HeartPulse,
  Gamepad2,
  Wrench,
  PenTool,
  BookOpen,
  Palette,
  Sofa,
  Footprints,
  Shirt,
  UtensilsCrossed,
  Trees,
  Dumbbell,
  PawPrint,
  Paintbrush,
  Smartphone,
  Gem,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  auto: Car,
  accessories: Sparkles,
  appliances: Refrigerator,
  kids: Baby,
  home: Home,
  other: Package,
  health: HeartPulse,
  games: Gamepad2,
  tools: Wrench,
  stationery: PenTool,
  books: BookOpen,
  beauty: Palette,
  furniture: Sofa,
  obuv: Footprints,
  clothing: Shirt,
  food: UtensilsCrossed,
  garden: Trees,
  sport: Dumbbell,
  pets: PawPrint,
  hobby: Paintbrush,
  electronics: Smartphone,
  jewelry: Gem,
};

export function getCategoryIcon(slug: string | null | undefined): LucideIcon {
  if (!slug) return Package;
  return CATEGORY_ICON[slug] ?? Package;
}
