# Tiny Dominion

A god game in one HTML file. Shape a world, settle four peoples on it, and watch their realms grow from the Stone Age to the Space Age.

Open `Tiny_Dominion.html` in any modern browser. Nothing to install, no network needed (the pixel font loads from Google Fonts when online).

## What's in it

**The world**
- Pixel-art terrain drawn on the GPU (WebGL2): smooth coastlines with surf, animated water, hill shading that follows the sun through the day, crags, dunes, crop fields that change with the seasons, connected roads that become cobbles, railways and highways.
- Seasons with snow and frozen lakes, autumn leaves, drifting storms with rain and snow, cloud shadows, and nights where cities glow with lit windows, lamps and lighthouse beams.
- Birds, fish, whales, fireflies, sheep, wolves, bears, dragons and the occasional zombie.

**Civilization**
- Nine ages: Stone, Bronze, Iron, Classical, Medieval, Renaissance, Industrial, Modern and Space, with 27 discoveries.
- Towns are laid out on street grids and grow into cities and skylines. Buildings change with each age: huts become timber houses, then castles, brick tenements, and finally glass towers.
- City walls with gates, windmills, lighthouses, factories with smoke, arenas, stadiums and launch pads.
- Nine world wonders, from the Standing Stones to the Star Gate, each raised over years.
- Trade caravans, goods trains, freight trucks and merchant fleets. Armies carry clubs, spears, swords, muskets and rifles; catapults, cannons and tanks besiege walls; bombers fly in the Modern Age; rockets launch in the Space Age, until a colony ship leaves for the stars.
- Rulers with personalities who make alliances, declare wars, secede and fall. When the page runs inside Claude, Claude can play every ruler in a council, or answer as one ruler when you speak to them.

**Terrain sandbox**
- Sculpt with raise, lower, smooth, flatten (to the height where the stroke began), ridges, valleys, terraces, roughen and erosion, each with a size and strength slider.
- Water flows: basins fill into lakes and rivers follow the real drainage of the land down to the sea. Move the sea level with a slider, or start from a flat plain or an empty ocean.
- Topographic map: elevation bands, contour lines every 5 steps (index contours every 25), sea-depth bands, peak heights in metres, a map grid and a height readout under the pointer. Contour lines can also sit over the normal view.
- 3D view: the world as a tabletop model you can orbit, with adjustable relief, a glossy sea, layered earth sides, and towns, trees and people standing up on the land. Cities light up at night.

**Your powers**
- Paint: plant forests, make places warmer, colder, wetter or drier, or paint any terrain directly.
- Place peoples and creatures, and call down rain, storms, fire, lightning, meteors, volcanoes, tornadoes, plague, war and peace.

**Watching**
- Watch mode flies the camera to battles, launches, new wonders and great cities on its own.
- Follow any person, caravan, tank or dragon.
- A chronicle of every event (tap an entry to fly there), a realm page with research and wonders, and a history chart of the rise and fall of realms.
- Saves to this browser (three slots and an autosave), and procedural sound and music.

## Controls

| Action | Touch | Mouse and keyboard |
| --- | --- | --- |
| Pan | Drag with the Move tool, or two fingers | Drag with the Move tool |
| Zoom | Pinch | Scroll wheel |
| Use a tool | Tap or drag on the map | Click or drag |
| Speed | Speed buttons at the top | Space pauses, 1 to 4 set 1x, 3x, 8x, 20x |
| Watch mode | Watch button | W |
| Topographic map | Topo map button (Shape) | T |
| 3D view | 3D view button; drag to turn, pinch to zoom, two fingers to move | V; drag, right-drag to move, scroll to zoom |

Settings include graphics (HD or Classic), sharpness, day and night, seasons, weather, clouds, sound, music, world size, land shape, climate, peoples and a head start of up to 300 years.

## Building

The game is written as separate source files and assembled into one HTML file.

```
node tools/build.mjs
```

This syntax-checks the combined script, then writes:
- `Tiny_Dominion.html`: the standalone game.
- `dist/tiny-dominion.html`: the same game without its own document wrapper, for publishing as a Claude artifact.

Source layout (files are concatenated in name order into one script):

| File | Contents |
| --- | --- |
| `src/head.html`, `src/style.css`, `src/body.html` | Page shell, styles and interface markup |
| `src/js/00-core.js` | Terrain, species, ages, wonders and other tables; shared helpers |
| `src/js/10-world.js` | World generation, regions, tile changes |
| `src/js/20-units.js` | People, beasts, siege engines, caravans, ships |
| `src/js/30-civ.js` | Towns, street planning, buildings, walls, wonders, economy |
| `src/js/40-rulers.js` | Rulers, diplomacy, war, ages and discoveries, space programme, history; the Claude council |
| `src/js/50-nature.js` | Fire, disasters, the simulation tick |
| `src/js/55-terra.js` | Terraforming and sculpting, climate, sea level, lakes and rivers, storms, heights in metres |
| `src/js/60-powers.js` | God powers and inspection |
| `src/js/68-gfx.js` | Canvases, camera, day and night |
| `src/js/70-render2d.js` | Classic 2D renderer (fallback) and map labels |
| `src/js/71-atlas.js` | The procedural pixel-art sprite atlas |
| `src/js/72-gl.js` | WebGL2 engine and shaders |
| `src/js/73-scene.js`, `src/js/74-ambient.js` | What the GPU draws each frame; ambient life and weather |
| `src/js/75-relief.js` | The 3D relief view |
| `src/js/80-ui.js`, `81-history.js`, `82-camera.js` | Interface, history chart, camera |
| `src/js/85-audio.js` | Procedural sound and music |
| `src/js/86-save.js` | Saving and loading worlds |
| `src/js/90-boot.js` | Startup and main loop |

`original/` keeps the game as it was before this rebuild.
