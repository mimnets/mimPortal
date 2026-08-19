# Free models first, paid ones as the fallback

Generation goes through a **chain** of providers rather than one. A Site names as many as it
likes, in order, and each request tries them in turn until one answers. The Starter's order
is OpenRouter's free models first, then Anthropic, OpenAI and DeepSeek.

This amends [ADR-0007](./0007-ai-generated-presets.md), which said "provider-agnostic, with a
default" and named `claude-opus-5` as that default. The abstraction it asked for is here; what
has changed is that a Site now configures a *list* rather than a choice, and the head of that
list is free.

## Why a chain rather than a setting

Free models are unreliable in a way paid ones are not, and unreliable in a *recoverable* way.
OpenRouter retires free models without notice, rate-limits them hard, and returns 503 under
load. Any of those is fatal to a single-provider setup and trivial for a chain: the next
provider answers and the Author sees a slightly slower reply.

The alternative was to make an Owner choose once between "free but flaky" and "reliable but
billed". That choice is a false one — almost every Site wants free for the ordinary case and
paid for the moment free is not working, which is exactly what a chain expresses.

Three of the four providers speak the same OpenAI-compatible wire format, so OpenRouter,
OpenAI and DeepSeek are one adapter with three base URLs. Anthropic has an official SDK and
uses it. Hand-rolling HTTP against a vendor that ships a client is how a request shape drifts
out of date without anything failing loudly.

## The rule that makes it safe

**A chain falls back only before the first token.** Once a provider has emitted text, a
failure is surfaced rather than retried.

This is the whole subtlety. Switching mid-stream would either repeat what the Author has
already watched appear, or splice half a sentence from one model onto half from another. Both
are worse than an error, and both are the kind of fault that looks like the Editor is broken
rather than like a provider is down. Two other cases are excluded from fallback for related
reasons: an abort is a person changing their mind, not a provider failing, and a `TypeError`
is a bug in this codebase that would otherwise be retried against four vendors and reported
as the last one's fault.

## Consequences

- **A Site can have a working assistant with no card on file.** One free OpenRouter key is
  enough. This is the same reasoning as the local disk being the default for storage
  ([ADR-0012](./0012-local-disk-is-the-default-storage.md)): the short path has to work
  before anyone has decided anything.
- **The free model list is configuration, not code.** `AI_FREE_MODELS` overrides it, because
  OpenRouter's free catalogue moves and a Site should not need a release to follow it.
- **Quality varies between requests.** A rewrite served by a free 70B model and one served by
  Claude are not the same quality, and an Author cannot tell which they got. That is the
  accepted cost of the default; a Site that cares puts a paid provider first.
- **Every provider is server-side.** Keys live in the Site's environment and the Editor sends
  an action name and some text. It never learns which vendor answered, which is what keeps
  the chain replaceable.
- **Rate limiting is per instance and in memory.** It guards against a stuck key-repeat, not
  an attacker — the endpoint already requires a session. A database write per request would
  cost more than the thing it prevents.
