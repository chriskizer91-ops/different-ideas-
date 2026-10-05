# Rain Check

A weather-aware watering, feeding, frost and heat plan for garden beds and pots, in one HTML file.

Open `rain-check.html` in any modern browser. Set your town (or use your location), add your beds and pots, and it tells you what needs water today, how much, and what's coming: frost, freezes and heat waves, with what to do for each bed. Everything is saved in your browser; use **Back up** at the bottom of the page to keep a copy.

Weather comes from [Open-Meteo](https://open-meteo.com) (free, no account, CC BY 4.0): the last three months and the next ten days, plus three-plus years of history for the long charts and frost dates. Without a location it runs on sample weather, with sliders to try heat, humidity, wind, rain and cold snaps.

## What it does

**Watering plan**
- Each bed or pot is a bank account of water: plants draw it out each day, the rain that soaks in puts it back. When the account would fall below the gold refill line by the end of today, it's time to water, and the amount refills it.
- The gauge on each card shows the water left **now**, with the rest of today's drying hatched above the fill, so the gauge and the advice always agree.
- Beds: plant type, seven soil textures, sun (including reflected heat from walls and paving), slope, mulch, area, and planting date.
- Pots: size, mix, material (plastic, wood, terracotta, fabric), how far the plant spreads past the rim, shelter from rain, and how many pots are alike.
- Quick "last watered" buttons for new beds, back-dated waterings and feedings, and a finger check that tunes each bed's drying rate to what you find.
- Below 40°F (5°C) it waits for a warmer day, when water can soak in. Heavy clay gets told to water in passes.

**Frost and heat warnings**, each on a four-step ladder:

| Level | Cold (night low) | Heat (day high) |
| --- | --- | --- |
| 1 Advisory | Frost, 36°F / 2°C (38°F on clear, calm nights) | Hot, 90°F / 32°C |
| 2 Warning | Freeze, 32°F / 0°C | Very hot, 95°F / 35°C, or a heat wave of 3+ hot days |
| 3 Severe | Hard freeze, 28°F / −2°C | Extreme heat, 100°F / 38°C |
| 4 Extreme | Extreme cold: 10°F / −12°C, or once history loads, colder than 98% of local nights (and at least 20°F / −7°C) | Extreme heat wave |

- Frost, freeze and hard freeze follow the US National Weather Service's frost advisory, freeze warning and hard freeze warning.
- Night lows come from the hourly forecast. Warnings name the beds and pots at risk and what to do for each, flag the first frost of the season and late spring frosts, and say which dry beds to water before a hard freeze.
- Conditions that have become routine (the fifth hard freeze in a midwinter week) are shown as a quiet line instead of a new alarm. A colder night than recent ones still raises the full warning.
- The seven-day outlook marks frost nights and hot days, and the chart has a strip of frost and heat days underneath.

**History**
- Soil water charts over 1 month, 3 months, 12 months or 3 years, with rain bars, the refill line, and frost and heat days. Tap or drag across the chart (or use the arrow keys) to read any day.
- Frost dates from the local record: the range of last spring freezes and first fall freezes at 32°F and 28°F, and the length of the frost-free season.
- Counts of hot days and freezing nights, and the hottest and coldest days, for any span.

**Everyday use**
- Keeps the last forecast, so it still works offline and says how old the forecast is.
- Refreshes itself when you come back to it on a new day or after a few hours.
- Back up and restore to a file. Reset needs a second tap within four seconds.
- Light and dark themes follow your device. Works on phones down to 320 px wide.

## How the numbers are worked out

The method is the UN Food and Agriculture Organization's irrigation guide, FAO-56 (Allen et al., 1998), with plant factors from WUCOLS and soil values from FAO-56 and the USDA.

| Step | What the app does |
| --- | --- |
| Evaporation | Reference ET₀ from Open-Meteo, or the app's own FAO-56 Penman-Monteith from temperature, humidity, wind and sunlight (Hargreaves if those are missing). The test suite checks it against FAO-56's worked example 18: 3.9 mm/day. |
| Plant use | ET₀ × plant factor × sun factor × mulch × your finger-check tuning. Vegetables 1.0, cool-season lawn and annuals 0.8, warm-season lawn 0.6, shrubs and trees 0.5, drought-tolerant 0.3. Lawns, shrubs and trees slow down as the week's average temperature falls (dormancy). |
| Root zone | Root depth × the soil's available water: from 7% of the depth for sand to 18% for silt loam. New plantings start with a third to two-fifths of their roots and fill in over about 7 weeks (vegetables, lawn), a year (shrubs) or two years (trees). |
| Refill line | The share plants can use before stress (FAO-56 table 22), lowered on high-demand days and raised on mild ones (p + 0.04 × (5 − ETc)). |
| Stress | Below the line plants close up and use less (FAO-56's Ks), so a dry spell drains the soil more and more slowly. |
| Rain | Showers under a fifth of the day's ET₀ evaporate. Leaves catch the first 0.5 to 2 mm. Rain falling faster than the soil can take it in runs off, from the day's rain total and its hours of rain: clay takes about 4 mm an hour, loam 13, sand 30. Slopes shed more, mulch less. Forecast rain counts at its amount × its chance. |
| Pots | The same account, sized by the pot's volume and mix. Water leaves through the whole plant but rain only enters the rim, so the plant factor grows with spread (up to 4.5×); porous walls and wind add loss; rain is cut for shelter and for leaves that shed it. |
| Timing | Waterings are logged with the time of day; drying through the day follows the sun at your location. |

## Building

The app is written as readable source and built into the single HTML file. Don't edit `rain-check.html` by hand.

```
npm install
npm run build   # writes rain-check.html
npm test        # 47 tests: the FAO-56 checks, water bank, warnings, frost dates, data parsing
```

The built file keeps the app code unminified, so it can still be read.

| Path | Contents |
| --- | --- |
| `src/model/` | The math, with no browser code: `et0.js`, `solar.js` (sun and day length), `tables.js` (plants, soils, pots), `planting.js` (turns a bed into daily numbers), `waterBalance.js` (the bank and today's plan), `feeding.js`, `alerts.js` (frost and heat ladders), `climate.js` (frost dates, extremes), `summary.js` (recent weather, chart data) |
| `src/data/` | `openMeteo.js` (requests and parsing), `store.js` (saving, offline forecast, backups, moving data over from version 1), `sample.js` (sample weather) |
| `src/ui/` | Preact components: `App.jsx`, `BedCard.jsx`, `BedDetails.jsx`, `Gauge.jsx`, `Alerts.jsx`, `Weather.jsx`, `WaterChart.jsx`, `Panels.jsx`, and `text.js` for the wording |
| `src/lib/` | Dates and units |
| `src/index.html`, `src/styles.css` | Page shell and styles |
| `test/` | Node tests (`node --test`) |
| `tools/build.mjs` | esbuild bundle, inlined into the page |
| `original/rain-check-2.html` | The version before this rebuild |

Data saved by the earlier version (`raincheck-v1` in the browser) is moved over on first open: its three soils map to the new ones, and "newly planted" becomes a planting date.
