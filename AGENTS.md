# Notes for coding agents

This repo holds examples built on the Orbbit Data API (`https://data-api.orbbit.co`), at `examples/<data-set>/<feature>/`. Each example folder has the same files:

- `<feature>.ts`: the function to copy into the user's project. No dependencies, no imports from the rest of the folder.
- `<Feature>.tsx`: an optional React component that renders the function's result.
- `app/`: a one-page Next.js demo. Do not copy it; it only shows the feature working.
- `README.md`: what the feature does, the snippet, and how to pick inputs.

When adding a feature to a user's project:

- Call the API from server code only. Read the key from `ORBBIT_DATA_API_KEY`. Never put it in browser code.
- Send it as `authorization: Bearer <key>`.
- Every value has a unit (`usd_per_lb`, `usd_per_cwt`, ...) and a date. Show both, and only compare numbers in the same unit.
- A USDA market price is not a supplier's price. Compare how prices moved, and never claim a price is too high.
- Show the source: "Market price: USDA via Orbbit Data".
- `GET /v1/commodities` is free. `GET /v1/commodities/metric-values` costs $0.01 per call however many metrics it asks for, so put every series you need in one call's `metric_names`.
- Metrics stop updating at different times. Read `last_observed_on` from `GET /v1/commodities` before relying on one.

For Branded Food Labels (`GET /v1/branded-foods`):

- Each request returns up to 200 labels for $0.01. Follow `next_cursor` until it is absent to get every label of a type.
- A label is as the brand last reported it to USDA, sometimes years ago. Show `modified_on`, and never use a label to say a product is safe for an allergy.
- Brands write ingredients their own way. Clean them before comparing (see `cleanIngredients` in `examples/branded-food-labels/competitor-product-ingredients`).
- Show the source: "Labels: USDA via Orbbit Data".

Full docs: https://docs.orbbit.co. Docs for agents: https://docs.orbbit.co/llms.txt.
