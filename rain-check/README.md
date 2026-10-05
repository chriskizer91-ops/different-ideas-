# Rain Check

A weather-aware watering, feeding, frost and heat plan for garden beds and pots, in one HTML file.

Open `rain-check.html` in any modern browser. Set your town (or use your location), add your beds and pots, and it tells you what needs water today, how much, and what's coming: frost, freezes and heat waves, with what to do for each bed. Everything is saved in your browser; use **Back up** at the bottom of the page to keep a copy.

Weather comes from [Open-Meteo](https://open-meteo.com) (free, no account, CC BY 4.0): the last three months and the next ten days hour by hour, three-plus years of daily history for the long charts, and 30 years of highs and lows for frost odds and normals. The long records are saved in the browser and refreshed every month or six months. Without a location it runs on sample weather, with sliders to try heat, humidity, wind, rain and cold snaps.

## What it does

**Watering plan**
- Each bed or pot is a bank account of water: plants draw it out each day, the rain that soaks in puts it back. When the account would fall below the gold refill line by the end of today, it's time to water, and the amount refills it.
- Each card's gauge is a **soil cutaway**: the soil drawn by its texture (gritty sand, layered clay, dark compost), the roots drawn to their real depth (a young tree's stop short of the soil below), water filled to what's left **now**, the rest of today's drying hatched, and the gold line where it's time to water. Pots are drawn as their real shape, material and plant spread.
- **Minutes, not inches.** Pick how you water each bed (sprinkler, hose, soaker hose, drip or watering can) and the card says "run the sprinkler 25 minutes" or "2 cans", allowing for what's lost on the way (about a quarter for sprinklers). Measure your own sprinkler with a tuna can or your hose with a bucket. When a sprinkler outpaces the soil, it splits the run into cycles with half an hour to soak in between.
- **A watering timer** on each card counts down, chimes between cycles, and logs the watering when it finishes. Stop it early and only what ran is logged.
- **This week**: every bed and pot across the next seven days, as if you follow the plan, with the water each ends the day with, waterings, rain that covers it, and frost or heat nights. Tap a day for the details.
- **The sky now**: the sun's path from sunrise to sunset with how much of today's drying is done, the moon at night, clouds and rain from the hourly forecast, and frost on freezing nights.
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
- Night lows come from the hourly forecast. Each cold night is drawn **hour by hour**: how long it stays below 32°F and 28°F, the coldest hour, and when to cover and uncover plants.
- Warnings name the beds and pots at risk and what to do for each, flag the first frost of the season and late spring frosts, and say which dry beds to water before a hard freeze.
- With 30 years of records loaded, they say how unusual it is ("colder than 97% of early-October nights here") and how rare the timing is ("only 2 of the last 30 falls had a hard freeze this early").
- Conditions that have become routine (the fifth hard freeze in a midwinter week) are shown as a quiet line instead of a new alarm. A colder night than recent ones still raises the full warning.
- The seven-day outlook marks frost nights and hot days, and the chart has a strip of frost and heat days underneath.

**Plants and the planting calendar**
- A library of 125 plants for Dallas–Fort Worth: 57 vegetables, herbs, fruit and nuts, and 68 trees, shrubs, perennials, wildflowers, grasses, groundcovers, succulents, lawn grasses and annual flowers. 38 are native to North Central Texas (the Blackland Prairie and Cross Timbers, checked against the Native Plant Society of Texas's ecoregion lists) and 17 more are Texas natives from farther west or south; profiles say which.
- Each plant has a profile: when to plant it here, water use, sun, cold and heat limits, chill hours, size and bloom, wildlife, North Texas varieties, tips, and its sources. Details that are best estimates rather than read from a source are listed as such on the profile.
- Name what's growing in each bed or pot. The plan then waters for the thirstiest plant with the shallowest roots, and freeze and heat warnings speak plant by plant ("Tomato dies at these temperatures… Kale is fine to about 20°F", "Turk's cap will freeze back to the ground but usually regrows", "Snap beans drop their blossoms in this heat").
- Fruit trees are judged by season: a 28°F night is nothing to a dormant peach in January, but in the weeks around the last freeze it kills open blossoms, so the warning says to cover them.
- **Planting calendar**: what to plant now and in the next three weeks, grouped by kind of plant, and a year of planting windows for each, with search and filters. Vegetable windows are the Tarrant County AgriLife calendar for North Central Texas, kept as weeks from the DFW frost dates so they move with your own. You can set your own frost dates.
- **Chill hours**, estimated from 30 years of winters, and how the varieties suited to each fruit compare.

**History and climate**
- Soil water charts over 1 month, 3 months, 12 months or 3 years, with rain bars, the refill line, and frost and heat days. Tap or drag across the chart (or use the arrow keys) to read any day.
- Counts of hot days and freezing nights, and the hottest and coldest days, for any span.
- **Your climate**, from 30 years of daily highs and lows: an estimated USDA hardiness zone; frost odds the way NOAA publishes them (the last spring freeze is past by Apr 12 in half of years and by Apr 27 in 9 of 10); the frost-free season; and a year chart of normal highs and lows, with this year drawn over it and the chance of a freezing night or a hot day for every date.

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
| Timing | Waterings are logged with the time of day; drying through the day follows the sun at your location, using its sunrise, sunset and solar noon. |
| How long to water | What soaks in ÷ efficiency (sprinkler 0.75, hose 0.85, soaker and drip 0.9, can 0.95), then by the sprinkler's rate, the hose's flow, the drip emitters, or the can size. |
| Cycle and soak | A sprinkler faster than the soil's intake rate fills the surface dips and runs off after store ÷ (rate − intake) hours, so longer runs are split into runs no longer than that. |
| Week plan | Follows the bank through the forecast, watering each morning a bed would otherwise end below the line, and not when it's below 40°F. |
| Frost odds | From the last 30 frost seasons: for each, the last spring and first fall night at or below 32°F and 28°F. The 50% date is the middle year; the 10% and 90% dates are the one-in-ten years. |
| Hardiness zone | The average of each winter's coldest night, in the USDA's 10°F zones split into a and b halves. Gridded records smooth out frost pockets, so it's an estimate. |
| Normals | For each day of the year, the spread of highs and lows within a week either side over 30 years, used for "how unusual" and the year chart. |
| Planting windows | Weeks before or after the average last spring or first fall freeze. Vegetables use the Tarrant County AgriLife calendar's dates, written as weeks from the DFW Airport normals (last freeze Mar 12, first Nov 22; National Weather Service, 1991–2020), so at DFW's frost dates they give the county dates to the day and elsewhere they shift with the local frost dates. Trees, shrubs and perennials follow Texas SmartScape's advice (fall is best). |
| Plant water | Vegetables use FAO-56's crop coefficient at full growth and its depletion fraction; landscape plants turn Texas SmartScape's water ratings into plant factors (very low 0.15, low 0.3, medium 0.5, high 0.7, with in-between ratings in between). A bed with several plants uses the highest factor, the shallowest roots and the lowest depletion fraction. |
| Cold and heat | Each plant's damage and kill temperatures, whether it regrows from the roots, and for fruit the temperature that kills open blossoms in bloom season (5 weeks before to 2 weeks after the average last freeze for peaches). Heat limits are the highs at which a crop stops setting fruit or bolts. |
| Chill hours | Hours between 32 and 45°F from November through February, estimated from each day's high and low with an hourly temperature curve, for 30 winters. |

## Building

The app is written as readable source and built into the single HTML file. Don't edit `rain-check.html` by hand.

```
npm install
npm run build   # writes rain-check.html
npm test        # 81 tests: the FAO-56 checks, water bank, watering times, warnings, frost odds, planting windows, the plant library, data parsing
```

The built file keeps the app code unminified, so it can still be read.

| Path | Contents |
| --- | --- |
| `src/data/plants.js` | The plant library, with how each number was chosen and sources for each plant |
| `src/model/` | The math, with no browser code: `calendar.js` (planting windows from frost dates), `profiles.js` (plants' water use and cold and heat limits), `et0.js`, `solar.js` (sun, day length, sunrise and sunset), `tables.js` (plants, soils, pots), `planting.js` (turns a bed into daily numbers), `waterBalance.js` (the bank, today's plan, the week plan), `watering.js` (methods, minutes, cans, cycle and soak), `feeding.js`, `thresholds.js` and `alerts.js` (frost and heat ladders, night detail), `climate.js` (frost seasons, extremes), `normals.js` (30-year frost odds, zone, normals), `summary.js` (recent weather, chart data) |
| `src/data/` | `openMeteo.js` (requests and parsing), `store.js` (saving, offline forecast, backups, moving data over from version 1), `sample.js` (sample weather) |
| `src/ui/` | Preact components: `App.jsx`, `Sky.jsx`, `Alerts.jsx` and `NightChart.jsx`, `WeekPlanner.jsx`, `BedCard.jsx` with `SoilGauge.jsx`, `Timer.jsx` and `BedDetails.jsx` (with `WaterMethod.jsx`), `Weather.jsx`, `WaterChart.jsx`, `Climate.jsx`, `Calendar.jsx`, `PlantProfile.jsx`, `PlantPicker.jsx`, `Panels.jsx`; `text.js` holds the wording |
| `src/lib/` | Dates and units |
| `src/index.html`, `src/styles.css` | Page shell and styles |
| `test/` | Node tests (`node --test`) |
| `tools/build.mjs` | esbuild bundle, inlined into the page |
| `original/rain-check-2.html` | The version before this rebuild |

Data saved by the earlier version (`raincheck-v1` in the browser) is moved over on first open: its three soils map to the new ones, and "newly planted" becomes a planting date.
