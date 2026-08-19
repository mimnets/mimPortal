# Setting up the AI assistant

The Editor can rewrite, shorten, expand, proofread, write alt text and draft a search
description — acting on whichever field an Author is editing. It is off until a Site has at
least one provider configured, and the buttons do not appear at all until then. A button
that always fails is worse than no button.

Providers are tried **in order**. Free first, paid after
([ADR-0014](./adr/0014-free-models-first-paid-as-fallback.md)). When a free model is rate
limited, retired or overloaded, the next one answers and the Author sees a slightly slower
reply rather than an error.

---

## The short version

One key gets you a working assistant at no cost:

```bash
# starter/.env
OPENROUTER_API_KEY=sk-or-v1-...
```

Restart the Site. The buttons appear under text fields in the Editor.

---

## Option 1 — OpenRouter (free, recommended starting point)

[OpenRouter](https://openrouter.ai) fronts a catalogue from many vendors, including models
served at no cost. This is the whole setup, start to finish.

### 1. Create an account

Go to [openrouter.ai](https://openrouter.ai) and click **Sign in** (top right). You can sign
up with Google, GitHub, or an email address. **No payment method is required** — the free
tier works on a bare account.

### 2. Create an API key

1. Click your avatar (top right) → **Keys**, or go to
   [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
2. Click **Create Key**.
3. Give it a name — the Site it belongs to, e.g. `acme-website`. This is only a label.
4. Leave **Credit limit** empty. On a free-tier account there is nothing to spend; setting a
   limit of 0 will make paid models fail later in a way that is confusing to debug.
5. Click **Create**, then **copy the key immediately** — it starts `sk-or-v1-` and OpenRouter
   shows it once. If you lose it, delete the key and make another; there is no way to view it
   again.

### 3. Put it in the Site

Open `starter/.env` — create it by copying `starter/.env.example` if it does not exist — and add:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Restart the Site (`pnpm dev`). Keys are read once at boot, so a running Site will not pick up
a new one.

### 4. Check it worked

Sign in to the Dashboard and open **Design**. If the key is working you get a brief box and a
model picker; if it is not, you get a line saying no provider is configured. You can also
open any Page in the Editor — small **Rewrite** / **Shorten** buttons appear under text
fields.

### Which free models

The Starter tries these in order, and they are verified against the live API by
`packages/core/src/ai/openrouter.test.ts`:

```
nvidia/nemotron-3-super-120b-a12b:free
google/gemma-4-26b-a4b-it:free
openrouter/free
```

`openrouter/free` is OpenRouter’s own router across whatever is currently free. It sits last
rather than first: it cannot go stale, but it picks a different model on each call and some of
those return nothing.

**This list will go out of date.** OpenRouter retires free models without notice — the first
three names shipped here had already been retired when the live test was written, which is
why that test exists. To find current ones:

1. Go to [openrouter.ai/models](https://openrouter.ai/models).
2. Set **Prompt pricing** to **FREE** (or use
   [this filter](https://openrouter.ai/models?max_price=0)).
3. Prefer a general instruction-tuned model with a large context. Avoid ones named for a
   narrow job — `content-safety`, `code`, `note`, `clip` — they are classifiers and media
   models, not writers.
4. Copy the model ID exactly, including the `:free` suffix, and set:

```bash
AI_FREE_MODELS=vendor/model-a:free,vendor/model-b:free
```

Then run `pnpm test` — the live test will tell you whether they actually answer.

### What the free tier costs you

Nothing in money. It costs reliability: free models are shared, rate-limited per account, and
slower. Expect the occasional failure. That is precisely what the paid fallbacks below are
for, and why the chain exists.

### A paid OpenRouter model

If you would rather stay on one account, name a paid model and it is tried after the free
ones:

```bash
AI_OPENROUTER_MODEL=anthropic/claude-opus-4.5
```

---

## Option 2 — Paid providers as fallbacks

Any of these can be set. Each is tried in this order, after the free models:

### Anthropic

```bash
ANTHROPIC_API_KEY=sk-ant-...
AI_ANTHROPIC_MODEL=claude-opus-5      # optional; this is the default
```

Get a key at [console.anthropic.com](https://console.anthropic.com) → **API Keys**. Requires
credit on the account. This is the highest-quality option and the default named in ADR-0007.

### OpenAI

```bash
OPENAI_API_KEY=sk-proj-...
AI_OPENAI_MODEL=gpt-5                 # optional
```

Get a key at [platform.openai.com](https://platform.openai.com/api-keys). Requires billing to
be set up — a new account with no credit returns a quota error, which the chain treats as a
failure and moves past.

### DeepSeek

```bash
DEEPSEEK_API_KEY=sk-...
AI_DEEPSEEK_MODEL=deepseek-chat       # optional
```

Get a key at [platform.deepseek.com](https://platform.deepseek.com). Substantially cheaper
than the other two, and a reasonable last resort in the chain.

---

## Option 3 — Your own endpoint

Anything that speaks the OpenAI or the Anthropic wire format: a self-hosted model, a company
gateway, Azure OpenAI, Together, Groq, Fireworks, an LLM proxy, or a vendor not listed above.

```bash
AI_CUSTOM_BASE_URL=https://your-endpoint.example/v1
AI_CUSTOM_API_KEY=your-key
AI_CUSTOM_MODEL=the-model-name
AI_CUSTOM_FORMAT=openai          # "openai" (default) or "anthropic"
AI_CUSTOM_NAME=Our gateway       # what it is called in the Dashboard
```

**Which format.** If the endpoint has a `/chat/completions` path, it is `openai`. If it has
`/v1/messages`, it is `anthropic`. Most third-party services are OpenAI-compatible; the
Anthropic setting exists for gateways in front of Claude.

**The base URL includes the version segment and stops there.** Give the part before
`/chat/completions`:

| Service | `AI_CUSTOM_BASE_URL` | Format |
| --- | --- | --- |
| Together | `https://api.together.xyz/v1` | `openai` |
| Groq | `https://api.groq.com/openai/v1` | `openai` |
| Fireworks | `https://api.fireworks.ai/inference/v1` | `openai` |
| Ollama (local) | `http://localhost:11434/v1` | `openai` |
| LM Studio (local) | `http://localhost:1234/v1` | `openai` |
| An Anthropic gateway | `https://your-gateway.example` | `anthropic` |

A custom endpoint is tried **before** the named vendors below and after the free OpenRouter
models — an Owner who configured one meant it. To use it first and skip the free tier, leave
`OPENROUTER_API_KEY` unset, or pick it explicitly from the model list on the Design screen.

A local model needs no key; set `AI_CUSTOM_API_KEY` to anything non-empty, or leave it out.

---

## Designing from an image

The **Design** screen can work from a picture instead of a description: a screenshot, a photo
of a brochure, or a Figma frame exported as PNG.

The work is split deliberately:

- **Colours come from the image’s pixels**, read in your browser with a canvas. They are
  exact. A vision model *describes* colour — it will say "a deep forest green" and then give
  a hex value that is approximately that — so it is not asked.
- **The arrangement comes from a vision model**, which is the part pixels cannot answer.

This needs a model that can read images. Not all can, including free ones. These free ones
can, and are used automatically when present:

```
google/gemma-4-26b-a4b-it:free
google/gemma-4-31b-it:free
openrouter/free
```

Expect it to take around a minute on the free tier. Any paid Anthropic or OpenAI model reads
images and is much faster.

**A Figma link will not work.** A Figma URL is a JavaScript application — fetching it returns
markup with no design in it. Open the frame in Figma and use **Export → PNG**, then upload
that.

**It approximates; it does not reproduce.** A Site can only be built from its registered Block
Types, so the result matches the palette, the tone, and the section rhythm, and maps what it
sees onto the closest Blocks available. A design using something the library has no Block for
comes back as the nearest thing.

---

## Recommended setups

| Situation | Configure |
| --- | --- |
| Trying it out | `OPENROUTER_API_KEY` only |
| A client Site, cost-conscious | `OPENROUTER_API_KEY` + `DEEPSEEK_API_KEY` |
| A client Site, quality matters | `OPENROUTER_API_KEY` + `ANTHROPIC_API_KEY` |
| No free tier, one vendor | `ANTHROPIC_API_KEY` only |
| Self-hosted or a gateway | `AI_CUSTOM_*` |

---

## Limits

```bash
AI_REQUESTS_PER_MINUTE=20             # per signed-in person, default 20
```

This is a cost guard, not a security control — the endpoint already requires a session. It is
held in memory, so it is per running instance.

---

## What an Author can and cannot do

- The assistant only ever **fills in a field the Author is already editing.** It cannot add
  Blocks, change a layout, publish, or touch a Page the Author is not on.
- Nothing is saved automatically. Generated text lands in the field as a draft edit like any
  other, and the Author still presses Save.
- **Stop** restores exactly what was there before. An Author who changes their mind halfway is
  not left with half a sentence.
- Keys never reach the browser. The Editor sends an action name and some text, and gets text
  back — it does not know which vendor answered.

## When something goes wrong

| What you see | What it means |
| --- | --- |
| No buttons under any field | No provider configured. Set one of the keys above and restart. |
| "Every provider failed…" | Each one is listed with its reason — rate limited, key rejected, model not available. |
| "model not available" on a free model | OpenRouter retired it. Update `AI_FREE_MODELS`. |
| "key rejected" | Wrong key, or the account has no credit. |
| "That is a lot of requests at once" | The per-minute limit. Raise `AI_REQUESTS_PER_MINUTE` if it is genuinely too low. |
| Text appears then stops mid-sentence | A provider died mid-stream. The chain deliberately does **not** switch mid-reply — press the button again. |
