import type { CatalogEntry, HotSeat } from "@/lib/hotseat-types";
import { kodak } from "./hotseats/kodak";

/** Playable Hot Seats. Add a new file in ./hotseats and register it here. */
export const HOT_SEATS: Record<string, HotSeat> = { kodak };

/** Everything shown on the map, including ones still being written. */
export const CATALOG: CatalogEntry[] = [
  { id: "kodak", company: kodak.company, title: kodak.title, hook: kodak.hook, cover: kodak.cover, complexity: kodak.complexity, available: true },
  { id: "blockbuster", company: "Blockbuster", title: "The $50 million offer", hook: "A tiny DVD-by-mail startup wants you to buy it.", complexity: 1, available: false },
  { id: "nokia", company: "Nokia", title: "The phone that ruled the world", hook: "Everyone owns your phone. Then a touchscreen arrives.", complexity: 3, available: false },
  { id: "maggi", company: "Maggi", title: "Two minutes to crisis", hook: "India's favourite noodles get pulled off the shelves.", complexity: 2, available: false },
  { id: "netflix", company: "Netflix", title: "Kill your own business", hook: "Your DVD business is booming. Do you bet on streaming?", complexity: 3, available: false },
  { id: "jio", company: "Jio", title: "Free for everyone", hook: "Launch a telecom network by giving data away.", complexity: 4, available: false },
];
