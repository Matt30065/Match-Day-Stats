# Grassroots Match Tracker v16.3

Adds assists and your team's Power Play tracking while preserving existing match history, local storage and match-day flow.

- Our goals can record a scorer and assist.
- Player statistics include Assists and Power Play Apps.
- Power Play follows the supplied Mini Soccer rule: at a 4-goal deficit, one extra player may be added; at a 6-goal deficit, a second extra player may be added.
- When the deficit falls to 5 after the second Power Play player has been used, one player must be withdrawn; when it falls to 3 after a Power Play player has been used, one player must be withdrawn.
- Power Play entries and withdrawals are recorded in the match event history.
- Normal substitutions preserve any active Power Play slot when a Power Play player is substituted off.
- Existing matches remain compatible; older matches simply show zero assists/Power Play Apps unless new events exist.

Replace the current app.js, index.html, style.css and service-worker.js with the v16 files.


### v16.1 fix
- Power Play player-count display now shows our players vs the opponent's fixed match-format count (for example 5v5, 6v5, 7v5).


## v16.2 fix
- Required Power Play withdrawal can select any player currently on the pitch, not only the player(s) originally added for Power Play.
- The Power Play allowance is reduced correctly while preserving the actual on-pitch players.

## v16.3 fix
- Corrected Power Play thresholds to the supplied rule: add at 4 goals behind, add a second at 6 goals behind, reduce to one at 5 goals behind, and remove the final additional player at 3 goals behind.
- Power Play allowance now follows threshold crossings rather than the current score alone, including when the score moves back towards level.
- Existing v16 matches are migrated by replaying their recorded goal history to determine the correct allowance.
