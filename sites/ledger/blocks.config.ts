import { createRegistry } from "@mimnets/core";
import { standardBlocks } from "@mimnets/blocks";

import { deadlinesBlock } from "./blocks/deadlines";

/**
 * Every Block Type this Site can render, in one readable list.
 *
 * Ledger registers the standard library plus one Block of its own. That one line is the
 * whole of what M8 set out to prove: a Site extends the product without forking it, and the
 * standard Blocks arrive as an installed package rather than as source it has to maintain.
 */
export const registry = createRegistry([...standardBlocks, deadlinesBlock]);
