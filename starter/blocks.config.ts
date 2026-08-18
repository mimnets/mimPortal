import { createRegistry } from "@mimnets/core";
import { standardBlocks } from "@mimnets/blocks";

/**
 * Every Block Type this Site can render, in one readable list.
 *
 * Registration is explicit rather than auto-discovered: magic discovery is delightful for
 * three months and then nobody can work out where a Block came from. Add a Site's own
 * Blocks from ./blocks alongside the standard library.
 */
export const registry = createRegistry([...standardBlocks]);
