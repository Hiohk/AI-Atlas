import type { SeedResource } from "./seed-types.ts";
import { buildingResources } from "./seed-resources-building.ts";
import { learningResources } from "./seed-resources-learning.ts";
import { paperResources } from "./seed-resources-papers.ts";

/**
 * The catalogue, split by how a reader uses it rather than by resource type:
 * research to understand the field, material to learn it, tooling to build with it.
 */
export const seedResources: SeedResource[] = [...paperResources, ...learningResources, ...buildingResources];
