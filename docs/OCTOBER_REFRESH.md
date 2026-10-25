# October 2026 stock refresh

The `S2026-10` pharmacy snapshot was captured on 25 October 2026 in Nairobi
(24 October 23:32 through 25 October 00:40 UTC). It contains **70,178 source
listings**, **58,022 resolved products**, **40,737 reported in stock**, **29,438
reported out of stock**, and **3 listings with unknown stock**. The known-stock
availability rate is **58.1%**. This is captured online stock evidence, not a
live or nationally representative inventory measure.

Fifteen of the eighteen panel sources were captured. PharmaPlus, MyDawa and
Faiz were recovered. Pharmily pagination now reaches its natural end rather
than a 500-page cap. HealthyU and Rangechem use their full storefront feeds.
Malibu stock comes from product detail records instead of a blanket default.
HealthyU is scoped to Sarit warehouse `RNC47-01`. PharmaPlus may include
distant-store fulfilment; transit stock is excluded.

Three sources are explicitly unavailable for October:

- **Portal Pharmacy:** HTTP 500 and browser-confirmed origin timeout 504.
- **OneStop Pharmacy:** Store API HTTP 500 and storefront timeouts.
- **MedMarket:** catalogue route 404; a current product page returned unrelated
  gambling content. That content is excluded because source integrity could
  not be established.

September observations remain in DuckDB history and in the original workbooks.
Unavailable-source tabs in the October workbooks retain clearly labelled
September history, excluded from October totals. They are not fresh stock.
The Drug Index reference remains its separately dated **15 October 2026**
capture; no pharmacy stock is inferred from clinical reference records.

## Validation and release

`docs/data/2026-10-25-sources.json` records per-source counts, capture windows,
scope and canonical input hashes. Full response archives, reference payloads,
workbooks and authentication material remain outside the Git repository.

The pipeline checks exact catalogue totals, unique source identities and
sidecar hashes. URL and SKU identity strategies require complete uniqueness;
a few reused slugs no longer produce duplicate listing IDs. Unknown stock is
projected to `not_published`, including within otherwise reporting feeds.

Source filters use permanent bit assignments, preserving the original
September URL bits. New sources occupy bits 15–17. Browser masks are 32-bit;
listing-array indexes are separate from filter bits. The sign bit is reserved.

To rebuild this deliberately partial panel with strict validation for all
other sources, use the documented outage allowlist explicitly:

```sh
node pipeline/build.js --snapshot S2026-10 --strict --allow-unavailable medmarket,portal,onestop
npm run verify
npm run export:app
npm run check:app
```

An allowlisted source must have a sidecar declaring the capture incomplete
and explaining the failure. Ordinary ingestion errors still fail strict mode.
Do not use `--rebuild` on the historical store for a monthly append.

Each October workbook preserves the source tabs, filters, hyperlinks, frozen
headers and print titles. Newly captured rows are compared with September;
they may reflect improved collection rather than new product introductions.
The raw number of clinical stockout leads is not directly comparable with
September because the captured source roster and stock evidence improved.
