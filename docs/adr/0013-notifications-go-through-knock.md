# Notifications go through Knock

Cadence sends every Notification through one hosted vendor, Knock, and builds its own Notification Feed UI on Knock's headless feed API. Knock was the only vendor whose free plan met the whole brief: 10K messages a month, signed per-user tokens our server issues for whichever user is in the session (so the DevUI switcher keeps working), preferences by category × channel, and a mature feed API.

## Considered Options

- **Courier.** Runner-up: scoped JWTs, topic × channel preferences and pay-as-you-go pricing, but web push still needs FCM or OneSignal.
- **MagicBell.** Has its own web push, but its free tier is only 1K deliveries a month and the next tier is $249/mo.
- **Novu Cloud.** Cheapest paid tier, but feed auth is a static HMAC with no expiry and preferences have no categories.
- **SuprSend.** Has its own web push, but vendor-stored and category preferences are not on its free plan.

## Consequences

Knock has no web push of its own: if web push makes the cut, it goes through Firebase Cloud Messaging, which means a Firebase project, the Firebase SDK and a service worker. For now Cadence stays on Knock's free plan; its next plan is $250/mo, which we have not weighed. Swapping vendors later means rewiring token signing, triggering, preferences and the feed.

We may revisit this decision as the customer base and Notification volume grow, and the paid-plan cost starts to matter.
