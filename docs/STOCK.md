# Stock photographs

A generated Preset can write a law firm's copy and choose its palette, and then every image is
a grey rectangle. This is what fills them.

It is optional. A Site with no key configured applies Presets exactly as it did before this
existed — each image field stays empty, with the description the Preset wrote still in its alt
text, so an Author opening the media library knows what belongs there.

## Setting it up

One key, in the environment. Nothing is stored in the database and there is no settings screen,
for the same reason as the AI providers: the Dashboard chooses among what the environment
already enabled and never holds a secret.

```bash
# Either one. Unsplash is preferred when both are set.
UNSPLASH_ACCESS_KEY=…
PEXELS_API_KEY=…
```

**Unsplash** — register an application at
[unsplash.com/oauth/applications](https://unsplash.com/oauth/applications). The access key is
the one marked *Access Key*, not the secret. A demo application allows fifty requests an hour,
which is ample: photographs are fetched once, when a Preset is applied, and never again.

**Pexels** — request a key at [pexels.com/api](https://www.pexels.com/api/). Two hundred
requests an hour on the free tier.

Unsplash is preferred when both are present because it is the one whose terms this Site can
fully satisfy — see below.

## What each licence asks of you

Both are free to use commercially, and neither requires a photographer's permission. Both ask
for a credit, and this is why `media` records `credit`, `credit_url`, `source` and `source_url`
for every photograph: a Site that stored where a picture came from can decide later how to
display it, and one that did not cannot.

**Unsplash additionally requires that a use is reported** to their API when a photograph is
taken. Their guidelines are explicit that downloading the image file does not count. This Site
does it automatically, and never blocks on it: a Site that already has the picture should not
lose it because an analytics call timed out.

Neither licence permits redistributing the photographs as a stock library of your own, which is
not something this does — each picture is downloaded into one Site for use on that Site.

## How it behaves

**Photographs are downloaded, never hotlinked.** The bytes land in the Site's own media store
and the layout holds a storage key, not a URL ([ADR-0012](./adr/0012-local-disk-is-the-default-storage.md)).
A Page can never end up pointing at a third party who rate-limits it, moves it or takes it
down, and moving the Site to a bucket later changes one environment variable and no Page.

**Nothing is fetched until a Preset is applied.** An Owner is offered three or four Presets and
takes one. Fetching for the other three would be paying for work nobody asked for, against a
rate limit, every time somebody looks at the choices.

**A failure is never fatal.** An image that cannot be found or fetched is left exactly as it
was — empty, with its description intact — and the Preset applies around it. A Site with three
photographs and one grey rectangle is a Site; a Preset that refused to apply because a provider
was rate-limited is a bug report.

**The same photograph is not used twice on one Page**, which is the difference between a page
that looks designed and one that looks generated.

## Where the search terms come from

The model writes them. An image field in a generated Preset looks like this:

```json
{ "key": "", "alt": "a chef plating a dish in a small kitchen", "width": null, "height": null }
```

`key` is empty because a generated layout cannot reference a file that does not exist yet, and
`alt` is the description. One field doing both jobs: with no provider configured it is still
the alt text somebody would have had to write, and with one it is also the search.

A **Section background** has no alt text of its own — it is decorative, and describing it to a
screen reader would be noise — so there is nothing for a Preset to have described. The
Section's own first heading is used as the search term instead, and a Section with no heading
is skipped rather than searched for an empty string.

## Adding another provider

`StockAdapter` is in `packages/core/src/stock/adapter.ts`, and it is the same shape as the
StorageAdapter and the EmailAdapter. A provider needs `name`, `configured` and `search`;
`trackUse` is optional and exists because Unsplash requires it and Pexels has no equivalent —
which is why it is absent on Pexels rather than an empty method.

Then add it to `starter/lib/stock.ts`, which is the one place that reads the environment and
decides.
