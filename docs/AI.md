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
served at no cost.

1. Sign up at [openrouter.ai](https://openrouter.ai).
2. **Keys → Create Key.** No payment method is needed for the free tier.
3. Put it in `starter/.env` as `OPENROUTER_API_KEY`.

The Starter tries these free models in order, moving on when one is unavailable:

```
deepseek/deepseek-chat-v3.1:free
meta-llama/llama-3.3-70b-instruct:free
qwen/qwen-2.5-72b-instruct:free
```

**This list goes stale.** OpenRouter retires free models regularly. When these stop working,
check [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0) and
override the list — no code change needed:

```bash
AI_FREE_MODELS=some-vendor/some-model:free,another/model:free
```

Free models are rate limited per account, and shared. Expect them to be slower and
occasionally unavailable — which is what the paid fallbacks below are for.

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

## Recommended setups

| Situation | Configure |
| --- | --- |
| Trying it out | `OPENROUTER_API_KEY` only |
| A client Site, cost-conscious | `OPENROUTER_API_KEY` + `DEEPSEEK_API_KEY` |
| A client Site, quality matters | `OPENROUTER_API_KEY` + `ANTHROPIC_API_KEY` |
| No free tier, one vendor | `ANTHROPIC_API_KEY` only |

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
