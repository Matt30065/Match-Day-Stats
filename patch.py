from pathlib import Path
import re
p=Path('/mnt/data/v20_2/grassroots-v20/index.html')
s=p.read_text()
# Add onboarding view before settings
marker='    <div id="settingsView" class="hidden">'
onboard='''    <div id="onboardingView" class="hidden">
      <section class="card onboarding-shell">
        <div class="onboarding-progress">
          <span class="onboarding-kicker">FIRST TIME SETUP</span>
          <span id="onboardingStepLabel">1 of 3</span>
        </div>
        <div id="onboardingStep1" class="onboarding-step">
          <div class="onboarding-hero">
            <div class="team-crest onboarding-crest" id="onboardingTeamCrest">YTM</div>
            <p class="eyebrow">WELCOME TO MATCH TRACKER</p>
            <h2>Your club first.</h2>
            <p class="muted">Set your team identity once. The app will use it throughout your matches and reports.</p>
          </div>
          <div class="team-identity-grid onboarding-fields">
            <label>Team name
              <input id="onboardingTeamName" type="text" maxlength="40" placeholder="e.g. Kewford Eagles U9 North" />
            </label>
            <label>3-letter abbreviation
              <input id="onboardingTeamAbbr" type="text" maxlength="3" minlength="1" placeholder="KEG" />
            </label>
          </div>
          <button id="onboardingNext1" class="primary-btn full-width" type="button">Continue</button>
        </div>

        <div id="onboardingStep2" class="onboarding-step hidden">
          <div class="onboarding-hero">
            <p class="eyebrow">STEP 2</p>
            <h2>How does your team play?</h2>
            <p class="muted">Pick the normal format. The number of players on the pitch follows automatically.</p>
          </div>
          <div id="onboardingFormatGrid" class="format-grid">
            <button type="button" class="format-option" data-format="5"><strong>5v5</strong><span>5 on pitch</span></button>
            <button type="button" class="format-option" data-format="7"><strong>7v7</strong><span>7 on pitch</span></button>
            <button type="button" class="format-option" data-format="9"><strong>9v9</strong><span>9 on pitch</span></button>
            <button type="button" class="format-option" data-format="11"><strong>11v11</strong><span>11 on pitch</span></button>
          </div>
          <div class="onboarding-nav"><button id="onboardingBack2" class="secondary-btn" type="button">Back</button><button id="onboardingNext2" class="primary-btn" type="button">Continue</button></div>
        </div>

        <div id="onboardingStep3" class="onboarding-step hidden">
          <div class="onboarding-hero">
            <p class="eyebrow">STEP 3</p>
            <h2>Build your squad</h2>
            <p class="muted">Add the players you expect to use. You can edit the squad later in Settings.</p>
          </div>
          <div class="squad-quick-add">
            <input id="quickPlayerNumber" type="number" min="0" max="99" placeholder="#" aria-label="Shirt number" />
            <input id="quickPlayerName" type="text" maxlength="40" placeholder="Player name" aria-label="Player name" />
            <select id="quickPlayerPosition" aria-label="Position"><option value="">Pos</option><option value="GK">GK</option><option value="DEF">DEF</option><option value="MID">MID</option><option value="FWD">FWD</option></select>
            <button id="quickAddPlayerBtn" class="secondary-btn" type="button">+ Add</button>
          </div>
          <div class="onboarding-squad-head"><strong id="onboardingSquadCount">0 players</strong><button id="onboardingTestSquadBtn" class="secondary-btn compact-btn" type="button">Add test squad</button></div>
          <div id="onboardingPlayerList" class="onboarding-player-list"></div>
          <p id="onboardingSquadHint" class="muted compact">Add enough players to field your selected format.</p>
          <div class="onboarding-nav"><button id="onboardingBack3" class="secondary-btn" type="button">Back</button><button id="finishOnboardingBtn" class="primary-btn" type="button" disabled>Finish setup</button></div>
        </div>

        <div id="onboardingDone" class="onboarding-step hidden">
          <div class="onboarding-complete-mark">✓</div>
          <p class="eyebrow">ALL SET</p>
          <h2 id="onboardingCompleteTitle">Your club is ready.</h2>
          <p id="onboardingCompleteMeta" class="muted">5v5 · 12 players</p>
          <p class="muted">You can come back to Settings at any time. Your next match can be set up now, or you can head home and do it later.</p>
          <div class="onboarding-done-actions"><button id="onboardingSetupMatchBtn" class="primary-btn" type="button">⚽ Set Up a Match</button><button id="onboardingGoHomeBtn" class="secondary-btn" type="button">Go to Home</button></div>
        </div>
      </section>
    </div>\n\n'''
s=s.replace(marker,onboard+marker)
# Replace match setup view block with streamlined lobby
pat=re.compile(r'    <div id="matchSetupView" class="hidden">.*?    </div>\n\n    <div id="liveMatchView"',re.S)
new='''    <div id="matchSetupView" class="hidden">
      <section class="card match-lobby-shell">
        <div class="match-lobby-head">
          <div><p class="eyebrow">MATCH LOBBY</p><h2>New Match</h2><p class="muted compact">A quick pre-match check. Most weeks, just add the opponent and go.</p></div>
          <button id="cancelMatchSetupBtn" class="secondary-btn" type="button">Home</button>
        </div>
        <form id="matchSetupForm">
          <div class="lobby-opponent-grid">
            <div class="opponent-preview lobby-opponent-preview"><div class="team-crest opponent-crest setup-crest" id="setupOpponentCrest">OPP</div><div><span>OPPONENT</span><strong id="setupOpponentPreviewName">Add opponent details</strong></div></div>
            <div class="lobby-fields">
              <label>Opponent<input id="opponentName" type="text" placeholder="e.g. Liverpool Girls U9 North" required /></label>
              <label>Abbreviation<input id="opponentAbbr" type="text" maxlength="3" minlength="1" placeholder="LIV" required /></label>
              <label>Date<input id="matchDate" type="date" required /></label>
            </div>
          </div>
          <div class="lobby-row">
            <div><span class="eyebrow">VENUE</span><div class="choice-row"><label class="choice-pill"><input type="radio" name="venue" value="home" checked /> Home</label><label class="choice-pill"><input type="radio" name="venue" value="away" /> Away</label></div></div>
            <div class="lobby-format-pill"><span>FORMAT</span><strong id="lobbyFormatText">5v5</strong></div>
          </div>
          <div class="lobby-selection-card">
            <div class="section-heading"><div><p class="eyebrow">MATCH SQUAD</p><h3><span id="availableCount">0 available</span></h3><p class="muted compact">Everyone is available by default. Change only if someone is missing.</p></div><button id="toggleAvailabilityBtn" class="secondary-btn compact-btn" type="button">Change availability</button></div>
            <div id="availabilityWrap" class="collapsible-panel hidden"><div id="availabilityList" class="selection-list"></div></div>
          </div>
          <div class="lobby-selection-card">
            <div class="section-heading"><div><p class="eyebrow">STARTING TEAM</p><h3 id="startingTeamHeading">Starting 5</h3><p class="muted compact">Your last starting team is used where possible. Change it only when needed.</p></div><span id="starterCount" class="count-badge"></span></div>
            <div id="starterList" class="selection-list"></div>
            <div class="bench-preview"><span class="eyebrow">BENCH</span><div id="substituteList" class="summary-list"></div></div>
          </div>
          <p id="matchSetupError" class="error-message" aria-live="polite"></p>
          <button type="submit" class="primary-btn full-width">START MATCH</button>
        </form>
      </section>
    </div>\n\n    <div id="liveMatchView"'''
s,n=pat.subn(new,s)
assert n==1, n
p.write_text(s)
