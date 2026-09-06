---
"@mimnets/core": minor
---

Button and band text now picks black or white by measuring which one actually reads, rather
than by comparing brightness to a fixed threshold. **This changes visible output on any Site
that has not stated `onPrimary` or `onAccent` itself.**

`readableOn` compared relative luminance to `0.55`, which was far too high. Counted across
every button colour the product ships — the built-in default, the Starter, and the three
ready-made designs — **five of ten were below the 4.5:1 that normal text needs**. All five
were accent colours, and every one of them passes comfortably in black:

| Colour | Was (white) | Now (black) |
| --- | --- | --- |
| `#d08a1e` Larder accent | 2.86:1 | 6.60:1 |
| `#f0568c` built-in accent | 3.27:1 | 5.77:1 |
| `#b0813b` Chambers accent | 3.47:1 | 5.44:1 |
| `#f43f5e` Signal accent | 3.67:1 | 5.14:1 |
| `#e05a26` Starter accent | 3.71:1 | 5.09:1 |

Every primary colour is unchanged.

**It is not a lower threshold, deliberately.** The textbook crossover is `0.1791`, and the
product's own default primary `#3b6cf6` sits at `0.1831` — just the wrong side of it, where
white reaches 4.50 and black only 4.19. Lowering the number would have made that button worse.
Any threshold has an edge like that somewhere; comparing the two ratios has none.

`defaultTheme` stated `onAccent: "#ffffff"` explicitly, which is the value this was wrong
about, so it is now `#111111` — the same answer the rule gives.

**Upgrading an existing Site:** nothing is required, and most Sites should simply look better.
If a Site wants its old button text back, state it: `onPrimary` and `onAccent` are still
accepted in `theme.ts` and an explicit value is always kept. Worth a look at any Site with a
mid-tone accent, since that is where the text will have flipped.
