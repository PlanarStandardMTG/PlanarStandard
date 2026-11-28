# `repos/push`

Reads and writes over `push_subscriptions` (E26.28).

**Inputs.** The member's own client to save or remove their device; the service-role
client to list the devices of the people a notification is for.

**Outputs.** `PushSubscriptionRecord` from `@ps/contracts`.

**Gotchas.** The endpoint is unique, so a browser re-subscribing saves nothing new. A push
service answering 404 or 410 means the device is gone: the sender removes it.
