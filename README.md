# Grassroots Match Tracker v16.2.1

Adds assists and your team's Power Play tracking while preserving existing match history, local storage and match-day flow.

- Our goals can record a scorer and assist.
- Player statistics include Assists and Power Play Apps.
- Power Play unlocks at a 4-goal deficit (+1) and a 5-goal deficit (+2).
- When the deficit drops below the relevant threshold, the required Power Play player withdrawal is enforced.
- Power Play entries and withdrawals are recorded in the match event history.
- Normal substitutions preserve any active Power Play slot when a Power Play player is substituted off.
- Existing matches remain compatible; older matches simply show zero assists/Power Play Apps unless new events exist.

Replace the current app.js, index.html, style.css and service-worker.js with the v16 files.


### v16.1 fix
- Power Play player-count display now shows our players vs the opponent's fixed match-format count (for example 5v5, 6v5, 7v5).


## v16.2 fix
- Required Power Play withdrawal can select any player currently on the pitch, not only the player(s) originally added for Power Play.
- The Power Play allowance is reduced correctly while preserving the actual on-pitch players.
