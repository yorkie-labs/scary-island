// Every region of the island, in GDD order. Each builder adds its models,
// monsters, pickups and triggers to the game.
import { buildBeach, BEACH_MODELS, BEACH_SPAWN } from './beach.js';
import { buildCamp, CAMP_MODELS } from './camp.js';
import { buildForest, FOREST_MODELS } from './forest.js';
import { buildMine, MINE_MODELS } from './mine.js';
import { buildVillage, VILLAGE_MODELS } from './village.js';
import { buildHarbor, HARBOR_MODELS } from './harbor.js';

export { BEACH_SPAWN };
export const REGION_BUILDERS = [buildBeach, buildCamp, buildForest, buildMine, buildVillage, buildHarbor];
export const ALL_MODELS = [...new Set([...BEACH_MODELS, ...CAMP_MODELS, ...FOREST_MODELS, ...MINE_MODELS, ...VILLAGE_MODELS, ...HARBOR_MODELS])];

// Time of day per region (stage.mjs line: 0 day, .55 golden, .82 dusk, 1 night),
// following the GDD palette §10.2.
export const REGION_TIME = { beach: 0.12, camp: 0.5, forest: 0.84, mine: 0.9, village: 0.93, harbor: 0.62 };
