# Different ideas

Side projects, each in its own folder. Most are single-file web apps: open the HTML file in a browser and it runs, with nothing to install.

| Project | What it is | Open |
| --- | --- | --- |
| [Rain Check](rain-check/) | A weather-aware watering, feeding, frost and heat plan for garden beds and pots | [`rain-check/rain-check.html`](rain-check/rain-check.html) |
| [Tiny Dominion](tiny-dominion/) | A god game: shape a world and watch four peoples grow from the Stone Age to the Space Age | [`tiny-dominion/Tiny_Dominion.html`](tiny-dominion/Tiny_Dominion.html) |

## How each project is laid out

Every project folder follows the same pattern, so any of them can be picked up the same way:

```
project-name/
  README.md            what it does, how to build it, where things are
  project-name.html    the finished app, built from src/ (Tiny Dominion keeps its older name)
  src/                 readable source; edit here, never the built HTML
  tools/build.mjs      turns src/ into the single HTML file
  test/                tests, where the project has them
  original/            the version that came in before a rebuild, kept for reference
```

Build a project from inside its folder with `node tools/build.mjs` (or `npm install` then `npm run build` where there is a `package.json`). Each project's README has the details.

New projects go in a new kebab-case folder at the top level, with their own README, and a row in the table above.
