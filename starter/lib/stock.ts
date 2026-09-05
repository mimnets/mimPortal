import {
  pexelsStock,
  unconfiguredStock,
  unsplashStock,
  type StockAdapter,
} from "@mimnets/core/stock";

/**
 * Which StockAdapter this Site searches, decided once from the environment.
 *
 * Unconfigured is the default and is not a failure state: a Site with no key applies Presets
 * exactly as it did before stock photography existed, with the image fields left empty. That
 * is the same reasoning as email — a contact form on a Site with no mail configured still
 * records every enquiry — and it is why nothing here throws.
 *
 * Unsplash is preferred when both are set, because it is the one whose terms this Site can
 * actually satisfy: it reports uses back, which Unsplash requires and Pexels has no endpoint
 * for. Setting only PEXELS_API_KEY picks Pexels.
 *
 * Keys stay in the environment. There is no Settings screen for this and there should not be:
 * the Dashboard chooses among what the environment already enabled, and never stores a secret.
 */

let cached: StockAdapter | null = null;

export function stock(): StockAdapter {
  if (cached) return cached;

  const unsplash = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplash) {
    cached = unsplashStock(unsplash);
    return cached;
  }

  const pexels = process.env.PEXELS_API_KEY;
  if (pexels) {
    cached = pexelsStock(pexels);
    return cached;
  }

  cached = unconfiguredStock();
  return cached;
}

/** For tests, which set the environment after this module has already been imported. */
export function resetStock(): void {
  cached = null;
}
