const PLAYER_STORAGE_KEY = 'grassroots-football-tracker.players';
const SETTINGS_STORAGE_KEY = 'grassroots-football-tracker.settings';
const MATCH_STORAGE_KEY = 'grassroots-football-tracker.matches';

const defaultSettings = { matchFormat: 5, squadSize: 12, playersOnPitch: 5, teamName: 'Your Team', teamAbbr: 'YTM' };
let editingPlayerId = null;
let availableIds = new Set();
let starterIds = new Set();
let activeMatchId = null;
let timerInterval = null;
let timerStartedAt = null;
let matchElapsedSeconds = 0;

const $ = (id) => document.getElementById(id);
const homeView = $('homeView'), settingsView = $('settingsView'), matchSetupView = $('matchSetupView'), liveMatchView = $('liveMatchView');
const playerDialog = $('playerDialog'), playerForm = $('playerForm');
const playerName = $('playerName'), playerNumber = $('playerNumber'), playerPosition = $('playerPosition');

function makeId() { return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function cleanAbbr(value, fallback='TEAM') {
  const letters = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
  return (letters || fallback).slice(0,3);
}
function derivedAbbr(name, fallback='OPP') {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  const compact = words.join('').replace(/[^A-Za-z0-9]/g,'');
  if (compact.length <= 3) return compact.toUpperCase();
  const initials = words.map(w => w[0]).join('').replace(/[^A-Za-z0-9]/g,'');
  return cleanAbbr(initials.length >= 3 ? initials : compact, fallback);
}
function teamDisplaySettings() { const s=loadSettings(); return { name:String(s.teamName||'Your Team'), abbr:cleanAbbr(s.teamAbbr,'YTM') }; }
function refreshIdentityPreviews(){ const t=teamDisplaySettings(); const hc=$('homeTeamCrest'),hn=$('homeTeamName'),sc=$('settingsTeamCrest'),sn=$('settingsTeamPreviewName'),oc=$('setupOpponentCrest'),on=$('setupOpponentPreviewName'); if(hc)hc.textContent=t.abbr;if(hn)hn.textContent=t.name;if(sc)sc.textContent=cleanAbbr($('teamAbbr')?.value,t.abbr);if(sn)sn.textContent=$('teamName')?.value.trim()||t.name;const opp=$('opponentName')?.value.trim()||'';if(oc)oc.textContent=cleanAbbr($('opponentAbbr')?.value,derivedAbbr(opp,'OPP'));if(on)on.textContent=opp||'Add opponent details'; }

function loadPlayers() { return loadJson(PLAYER_STORAGE_KEY, []); }
function savePlayers(v) { saveJson(PLAYER_STORAGE_KEY, v); }
function loadSettings() { return { ...defaultSettings, ...loadJson(SETTINGS_STORAGE_KEY, {}) }; }
function saveSettings(v) { saveJson(SETTINGS_STORAGE_KEY, v); }
function hasCompletedFirstUseSetup() {
  const raw = loadJson(SETTINGS_STORAGE_KEY, null);
  const s = loadSettings();
  const players = loadPlayers();
  return !!(raw && String(s.teamName || '').trim() && /^[A-Z0-9]{1,3}$/.test(String(s.teamAbbr || '').toUpperCase()) && Number(s.matchFormat) && Number(s.squadSize) >= Number(s.playersOnPitch) && Number(s.playersOnPitch) > 0 && players.length >= Number(s.playersOnPitch));
}
function openFirstUseSetup() {
  renderSettings();
  renderPlayers();
  $('firstUseBanner')?.classList.remove('hidden');
  $('firstUseContinue')?.classList.remove('hidden');
  showView(settingsView);
  window.setTimeout(() => $('teamName')?.focus(), 80);
}
function closeFirstUseSetup() {
  $('firstUseBanner')?.classList.add('hidden');
  $('firstUseContinue')?.classList.add('hidden');
}
function refreshFirstUseContinue() {
  const wrap = $('firstUseContinue');
  const btn = $('continueToMatchBtn');
  const hint = $('firstUseContinueHint');
  if (!wrap || !btn) return;
  if ($('firstUseBanner')?.classList.contains('hidden')) return;
  wrap.classList.remove('hidden');
  const s = loadSettings();
  const players = loadPlayers();
  const teamReady = !!(String(s.teamName || '').trim() && String(s.teamAbbr || '').trim() && Number(s.playersOnPitch) > 0);
  const squadReady = players.length >= Number(s.playersOnPitch || 0);
  btn.disabled = !(teamReady && squadReady);
  if (!teamReady) {
    hint.textContent = 'Complete your team name and 3-letter abbreviation above.';
  } else if (!squadReady) {
    hint.textContent = `Add at least ${s.playersOnPitch} players to your squad before continuing.`;
  } else {
    hint.textContent = 'Team setup complete. Continue to set up your match.';
  }
}
function loadMatches() { return loadJson(MATCH_STORAGE_KEY, []); }
function saveMatches(v) { saveJson(MATCH_STORAGE_KEY, v); }
function escapeHtml(v) { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function playerLabel(p) { return `${p.number ? `#${p.number} ` : ''}${p.name}${p.position ? ` · ${p.position}` : ''}`; }
const matchReportView = $('matchReportView');
function showView(view) { [homeView, settingsView, matchSetupView, liveMatchView, matchReportView].forEach(v => v.classList.add('hidden')); view.classList.remove('hidden'); if(view===homeView){ renderMatchHistory(); renderSeasonStatistics(); refreshIdentityPreviews(); } if(view===settingsView){ renderSettings(); renderPlayers(); refreshIdentityPreviews(); } window.scrollTo({top:0,behavior:'smooth'}); }

function renderSettings() { const s=loadSettings(); $('teamName').value=s.teamName||'Your Team'; $('teamAbbr').value=cleanAbbr(s.teamAbbr,'YTM'); $('matchFormat').value=String(s.matchFormat); $('squadSize').value=s.squadSize; $('playersOnPitch').value=s.playersOnPitch; refreshIdentityPreviews(); }
function renderPlayers() {
  const players=loadPlayers(), s=loadSettings();
  $('squadCount').textContent=`${players.length} of ${s.squadSize} squad places filled`;
  if(!players.length){$('playerList').innerHTML='<p class="muted">No players yet. Use "Add test squad" to create your test players.</p>';return;}
  $('playerList').innerHTML=[...players].sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999)).map(p=>`<button class="player-row player-edit-btn" data-player-id="${p.id}" type="button"><span class="player-number">${escapeHtml(p.number||'-')}</span><span class="player-name">${escapeHtml(p.name)}</span><span class="position-badge">${escapeHtml(p.position||'—')}</span><span class="edit-label">Edit</span></button>`).join('');
  document.querySelectorAll('.player-edit-btn').forEach(b=>b.onclick=()=>openEditPlayer(b.dataset.playerId));
}
function openAddPlayer(){editingPlayerId=null;playerForm.reset();$('playerDialogTitle').textContent='Add player';$('deletePlayerBtn').classList.add('hidden');playerDialog.showModal();playerName.focus();}
function openEditPlayer(id){const p=loadPlayers().find(x=>x.id===id);if(!p)return;editingPlayerId=id;$('playerDialogTitle').textContent='Edit player';playerName.value=p.name;playerNumber.value=p.number||'';playerPosition.value=p.position||'';$('deletePlayerBtn').classList.remove('hidden');playerDialog.showModal();}
$('addPlayerBtn').onclick=openAddPlayer; $('cancelPlayerBtn').onclick=()=>playerDialog.close();
playerForm.onsubmit=e=>{e.preventDefault();const players=loadPlayers(),data={name:playerName.value.trim(),number:playerNumber.value.trim(),position:playerPosition.value};if(!data.name)return;if(editingPlayerId)Object.assign(players.find(p=>p.id===editingPlayerId),data);else players.push({id:makeId(),...data});savePlayers(players);renderPlayers();refreshFirstUseContinue();playerDialog.close();};
$('deletePlayerBtn').onclick=()=>{const p=loadPlayers().find(x=>x.id===editingPlayerId);if(!p||!confirm(`Delete ${p.name}?`))return;savePlayers(loadPlayers().filter(x=>x.id!==editingPlayerId));playerDialog.close();renderPlayers();};
$('fillTestPlayersBtn').onclick=()=>{const s=loadSettings(),players=loadPlayers();if(players.length&&!confirm('Add test players to the existing squad?'))return;const names=new Set(players.map(p=>p.name.toLowerCase()));for(let i=1;i<=s.squadSize;i++){const name=`Player ${i}`;if(!names.has(name.toLowerCase()))players.push({id:makeId(),name,number:String(i),position:''});}savePlayers(players);renderPlayers();refreshFirstUseContinue();};
$('settingsForm').onsubmit=e=>{e.preventDefault();const current=loadSettings();const s={...current,teamName:$('teamName').value.trim()||'Your Team',teamAbbr:cleanAbbr($('teamAbbr').value,'YTM'),matchFormat:Number($('matchFormat').value),squadSize:Math.max(5,Number($('squadSize').value)||12),playersOnPitch:Math.max(1,Number($('playersOnPitch').value)||5)};saveSettings(s);
function formatDateDisplay(value){
  if(!value)return 'Unknown date';
  const d=new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
}
function reportEventText(e){
  const players=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
  if(e.type==='our_goal'){const assistText=Object.prototype.hasOwnProperty.call(e,'assistPlayerId')?(e.assistPlayerId&&players[e.assistPlayerId]?` — Assist: ${playerLabel(players[e.assistPlayerId])}`:' — No assist'):''; return `⚽ ${players[e.playerId]?playerLabel(players[e.playerId]):'Unknown player'}${assistText}${e.penalty?' (Penalty)':''}`;}
  if(e.type==='their_goal') return `⚽ ${currentMatchReport?.opponent||'Opponent'}${e.penalty?' (Penalty)':''}`;
  if(e.type==='substitution') return `🔄 ${players[e.offId]?playerLabel(players[e.offId]):'Unknown'} off → ${players[e.onId]?playerLabel(players[e.onId]):'Unknown'} on`;
  if(e.type==='power_play_on') return powerPlayEventText(e);
  if(e.type==='power_play_off') return powerPlayEventText(e);
  return e.type;
}
let currentMatchReport=null;
function openMatchReport(id){
  const match=loadMatches().find(m=>m.id===id); if(!match)return;
  currentMatchReport=match;
  $('reportOpponent').textContent=match.opponent;
  const repTeam=teamDisplaySettings();
  $('reportOurCrest').textContent=cleanAbbr(match.teamAbbr,repTeam.abbr);
  $('reportOpponentCrest').textContent=cleanAbbr(match.opponentAbbr,derivedAbbr(match.opponent,'OPP'));
  $('reportMeta').textContent=`${match.venue==='home'?'Home':'Away'} · ${formatDateDisplay(match.date)}`;
  $('reportFinalScore').textContent=`${match.ourScore} - ${match.theirScore}`;
  const ht=match.halfTimeScore||{our:0,their:0}; $('reportHalfScore').textContent=`${ht.our} - ${ht.their}`;
  const events=match.events||[];
  const goals=events.filter(e=>e.type==='our_goal'||e.type==='their_goal');
  const subs=events.filter(e=>e.type==='substitution'||e.type==='power_play_on'||e.type==='power_play_off');
  $('reportGoals').innerHTML=goals.length?[...goals].map(e=>`<div class="event-row"><span class="event-minute">${e.period===1?'1H':'2H'} ${e.minute}'</span><span>${escapeHtml(reportEventText(e))}</span></div>`).join(''):'<p class="muted">No goals recorded.</p>';
  $('reportSubs').innerHTML=subs.length?[...subs].map(e=>`<div class="event-row"><span class="event-minute">${e.period===1?'1H':'2H'} ${e.minute}'</span><span>${escapeHtml(reportEventText(e))}</span></div>`).join(''):'<p class="muted">No substitutions recorded.</p>';
  const players=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
  $('reportStarters').innerHTML=(match.starterPlayerIds||[]).map(id=>players[id]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No starters recorded.</p>';
  $('reportSubstitutes').innerHTML=(match.substitutePlayerIds||[]).map(id=>players[id]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No substitutes recorded.</p>';
  activeMatchId=null; stopInterval(); showView($('matchReportView')); renderMatchHistory();
}
function resultClass(match){
  if(match.ourScore>match.theirScore)return 'result-win';
  if(match.ourScore<match.theirScore)return 'result-loss';
  return 'result-draw';
}
function resultText(match){
  if(match.ourScore>match.theirScore)return 'Won';
  if(match.ourScore<match.theirScore)return 'Lost';
  return 'Drew';
}
function renderMatchHistory(){
  const list=$('matchHistoryList'); if(!list)return;
  const matches=loadMatches().filter(m=>m.status==='completed'||m.fullTime).sort((a,b)=>(b.completedAt||b.createdAt||'').localeCompare(a.completedAt||a.createdAt||''));
  if(!matches.length){list.innerHTML='<p class="muted">No completed matches yet.</p>';return;}
  list.innerHTML=matches.map(m=>{const ta=cleanAbbr(m.teamAbbr,teamDisplaySettings().abbr),oa=cleanAbbr(m.opponentAbbr,derivedAbbr(m.opponent,'OPP'));return `<button class="history-card" type="button" data-match-id="${m.id}">
    <span class="history-date">${formatDateDisplay(m.date)}</span>
    <span class="history-main"><span class="history-opponent">${escapeHtml(ta)} ${m.ourScore} - ${m.theirScore} ${escapeHtml(oa)}</span><br><span class="history-result ${resultClass(m)}">${resultText(m)} · ${escapeHtml(m.opponent)} · HT ${m.halfTimeScore?`${m.halfTimeScore.our}-${m.halfTimeScore.their}`:'—'}</span></span>
    <span>›</span></button>`}).join('');
  document.querySelectorAll('.history-card').forEach(b=>b.onclick=()=>openMatchReport(b.dataset.matchId));
}
$('reportBackBtn').onclick=()=>{currentMatchReport=null;showView(homeView);renderMatchHistory();};
$('reportHomeBtn').onclick=()=>{currentMatchReport=null;showView(homeView);renderMatchHistory();};
$('deleteMatchBtn').onclick=()=>{
  if(!currentMatchReport)return;
  if(!confirm(`Delete the match against ${currentMatchReport.opponent}?`))return;
  saveMatches(loadMatches().filter(m=>m.id!==currentMatchReport.id));
  currentMatchReport=null; showView(homeView); renderMatchHistory();
};

renderSettings();renderPlayers();renderMatchHistory();renderSeasonStatistics();refreshIdentityPreviews();if(!hasCompletedFirstUseSetup())refreshFirstUseContinue();$('settingsSaved').textContent='Saved';setTimeout(()=>$('settingsSaved').textContent='',1500);};
$('matchFormat').onchange=()=>{$('playersOnPitch').value=$('matchFormat').value;};

function openMatchSetup(){const players=loadPlayers(),s=loadSettings();if(players.length<s.playersOnPitch){alert(`You need at least ${s.playersOnPitch} players in the squad first.`);return;}availableIds=new Set(players.map(p=>p.id));starterIds=new Set(players.slice(0,s.playersOnPitch).map(p=>p.id));$('matchDate').value=new Date().toISOString().slice(0,10);$('opponentName').value='';$('opponentAbbr').value='';$('matchSetupError').textContent='';renderMatchSelection();showView(matchSetupView);refreshIdentityPreviews();}
function renderMatchSelection(){const players=loadPlayers(),s=loadSettings();$('startingTeamHeading').textContent=`Starting ${s.playersOnPitch}`;$('availableCount').textContent=`${availableIds.size} available`;$('starterCount').textContent=`${starterIds.size} / ${s.playersOnPitch}`;$('availabilityList').innerHTML=players.map(p=>`<label class="selection-row"><input class="availability-check" type="checkbox" data-id="${p.id}" ${availableIds.has(p.id)?'checked':''}><span>${escapeHtml(playerLabel(p))}</span></label>`).join('');$('starterList').innerHTML=players.filter(p=>availableIds.has(p.id)).map(p=>`<label class="selection-row ${starterIds.has(p.id)?'selected':''}"><input class="starter-check" type="checkbox" data-id="${p.id}" ${starterIds.has(p.id)?'checked':''}><span>${escapeHtml(playerLabel(p))}</span></label>`).join('');const subs=players.filter(p=>availableIds.has(p.id)&&!starterIds.has(p.id));$('substituteList').innerHTML=subs.length?subs.map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join(''):'<p class="muted">No substitutes selected.</p>';document.querySelectorAll('.availability-check').forEach(c=>c.onchange=()=>{if(c.checked)availableIds.add(c.dataset.id);else{availableIds.delete(c.dataset.id);starterIds.delete(c.dataset.id);}renderMatchSelection();});document.querySelectorAll('.starter-check').forEach(c=>c.onchange=()=>{if(c.checked){if(starterIds.size>=s.playersOnPitch){$('matchSetupError').textContent=`You can only select ${s.playersOnPitch} starters.`;return;}starterIds.add(c.dataset.id);}else starterIds.delete(c.dataset.id);$('matchSetupError').textContent='';renderMatchSelection();});}
$('teamName').addEventListener('input',refreshIdentityPreviews);$('teamAbbr').addEventListener('input',refreshIdentityPreviews);$('opponentName').addEventListener('input',refreshIdentityPreviews);$('opponentAbbr').addEventListener('input',refreshIdentityPreviews);
$('continueToMatchBtn')?.addEventListener('click',()=>{
  const s=loadSettings();
  const players=loadPlayers();
  if(!String(s.teamName||'').trim() || !String(s.teamAbbr||'').trim()){
    alert('Complete the team name and 3-letter abbreviation first.');
    $('teamName')?.focus();
    return;
  }
  if(players.length<s.playersOnPitch){
    alert(`Add at least ${s.playersOnPitch} players to your squad before continuing.`);
    $('playerList')?.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  closeFirstUseSetup();
  openMatchSetup();
});
$('newMatchBtn').onclick=()=>{if(!hasCompletedFirstUseSetup()){openFirstUseSetup();return;}openMatchSetup();};
$('settingsBtn').onclick=()=>{closeFirstUseSetup();showView(settingsView);};
$('settingsBackBtn').onclick=()=>{closeFirstUseSetup();showView(homeView);};

function renderSeasonStatistics(){
  const matches=loadMatches().filter(m=>m.status==='completed'||m.fullTime);
  const players=loadPlayers();
  const stats={};
  players.forEach(p=>stats[p.id]={id:p.id,name:p.name,number:p.number||'',position:p.position||'',apps:0,starts:0,subApps:0,goals:0,assists:0,powerPlayApps:0});
  let wins=0,draws=0,losses=0,goalsFor=0,goalsAgainst=0;
  matches.forEach(match=>{
    goalsFor+=Number(match.ourScore)||0;
    goalsAgainst+=Number(match.theirScore)||0;
    if(match.ourScore>match.theirScore)wins++; else if(match.ourScore<match.theirScore)losses++; else draws++;
    const starters=new Set(match.starterPlayerIds||[]);
    const participants=new Set(starters);
    const events=match.events||[];
    events.filter(e=>(e.type==='substitution'||e.type==='power_play_on')&&e.onId).forEach(e=>participants.add(e.onId));
    participants.forEach(id=>{ if(!stats[id])return; stats[id].apps++; if(starters.has(id))stats[id].starts++; else stats[id].subApps++; });
    events.filter(e=>(e.type==='power_play_on'&&e.playerId)||(e.type==='substitution'&&e.powerPlaySlotTransferred&&e.onId)).forEach(e=>{ const id=e.type==='power_play_on'?e.playerId:e.onId; if(stats[id])stats[id].powerPlayApps++; });
    events.filter(e=>e.type==='our_goal'&&e.playerId).forEach(e=>{
      if(!stats[e.playerId])return; stats[e.playerId].goals++;
    });
    events.filter(e=>e.type==='our_goal'&&e.assistPlayerId).forEach(e=>{
      if(!stats[e.assistPlayerId])return; stats[e.assistPlayerId].assists++;
    });
  });
  $('seasonSummary').innerHTML=`<div class="stat-card"><strong>${matches.length}</strong><span>Played</span></div><div class="stat-card"><strong>${wins}</strong><span>Won</span></div><div class="stat-card"><strong>${draws}</strong><span>Drawn</span></div><div class="stat-card"><strong>${goalsFor}</strong><span>Goals</span></div><div class="stat-card"><strong>${goalsAgainst}</strong><span>Against</span></div>`;
  const rows=Object.values(stats).sort((a,b)=>b.goals-a.goals||b.apps-a.apps||(Number(a.number)||999)-(Number(b.number)||999));
  if(!matches.length){$('playerStatsTable').innerHTML='<p class="muted stats-empty">Complete a match and player statistics will appear here.</p>';return;}
  $('playerStatsTable').innerHTML=`<div class="player-stats-list">${rows.map(p=>`<article class="player-stat-card">
    <button class="player-stat-head player-stat-toggle" type="button" aria-expanded="false">
      <div class="player-stat-shirt">${escapeHtml(p.number||'–')}</div>
      <div class="player-stat-identity"><strong>${escapeHtml(p.name)}</strong>${p.position?`<span>${escapeHtml(p.position)}</span>`:''}</div>
      <div class="player-stat-mini"><span><strong>${p.apps}</strong> Apps</span><span><strong>${p.starts}</strong> Starts</span><span class="mini-goal"><strong>${p.goals}</strong> Goals</span><span class="mini-assist"><strong>${p.assists}</strong> Assists</span></div>
      <span class="player-stat-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="player-stat-details" hidden>
      <div class="player-stat-grid">
        <div><strong>${p.apps}</strong><span>Apps</span></div>
        <div><strong>${p.starts}</strong><span>Starts</span></div>
        <div><strong>${p.subApps}</strong><span>Subs</span></div>
        <div class="stat-accent-goal"><strong>${p.goals}</strong><span>Goals</span></div>
        <div class="stat-accent-assist"><strong>${p.assists}</strong><span>Assists</span></div>
        <div class="stat-accent-pp"><strong>${p.powerPlayApps}</strong><span>PP Apps</span></div>
      </div>
    </div>
  </article>`).join('')}</div>`;
  document.querySelectorAll('.player-stat-toggle').forEach(btn=>btn.addEventListener('click',()=>{
    const card=btn.closest('.player-stat-card');
    const details=card.querySelector('.player-stat-details');
    const expanded=btn.getAttribute('aria-expanded')==='true';
    btn.setAttribute('aria-expanded',String(!expanded));
    details.hidden=expanded;
    card.classList.toggle('is-expanded',!expanded);
  }));
}
 $('cancelMatchSetupBtn').onclick=()=>showView(homeView);
$('matchSetupForm').onsubmit=e=>{e.preventDefault();const s=loadSettings(),opponent=$('opponentName').value.trim(),opponentAbbr=cleanAbbr($('opponentAbbr').value,derivedAbbr(opponent,'OPP'));if(!opponent){$('matchSetupError').textContent='Enter the opponent name.';return;}if(availableIds.size<s.playersOnPitch){$('matchSetupError').textContent=`You need at least ${s.playersOnPitch} available players.`;return;}if(starterIds.size!==s.playersOnPitch){$('matchSetupError').textContent=`Select exactly ${s.playersOnPitch} starters.`;return;}const team=teamDisplaySettings();const match={id:makeId(),teamName:team.name,teamAbbr:team.abbr,opponent,opponentAbbr,date:$('matchDate').value,venue:document.querySelector('input[name="venue"]:checked').value,availablePlayerIds:[...availableIds],starterPlayerIds:[...starterIds],substitutePlayerIds:[...availableIds].filter(id=>!starterIds.has(id)),currentOnPitch:[...starterIds],currentSubs:[...availableIds].filter(id=>!starterIds.has(id)),status:'live',period:1,halfTime:false,fullTime:false,ourScore:0,theirScore:0,events:[],powerPlayPlayers:[],powerPlayAllowance:0,powerPlayRuleVersion:3,periodElapsedSeconds:0,periodStartedAt:null,createdAt:new Date().toISOString()};const matches=loadMatches();matches.push(match);saveMatches(matches);startLiveMatch(match.id);};

function currentMatch(){return loadMatches().find(m=>m.id===activeMatchId)||null;}
function saveCurrentMatch(match){const matches=loadMatches();const i=matches.findIndex(m=>m.id===match.id);if(i>=0){matches[i]=match;saveMatches(matches);}}
function ensureMatchFields(match){
  if(!match.events)match.events=[]; if(!Array.isArray(match.currentOnPitch))match.currentOnPitch=[...(match.starterPlayerIds||[])]; if(!Array.isArray(match.currentSubs))match.currentSubs=[...(match.substitutePlayerIds||[])];
  if(!match.period)match.period=1; if(typeof match.halfTime!=='boolean')match.halfTime=false; if(typeof match.fullTime!=='boolean')match.fullTime=match.status==='completed';
  if(typeof match.periodElapsedSeconds!=='number')match.periodElapsedSeconds=typeof match.elapsedSeconds==='number'?match.elapsedSeconds:0;
  if(match.periodStartedAt===undefined)match.periodStartedAt=null;
  ensurePowerPlayFields(match);
  return match;
}
function powerPlayLimit(match){return Math.max(0,Math.min(2,Number(match.powerPlayAllowance)||0));}
function powerPlayDifference(match){return Math.max(0,Number(match.theirScore||0)-Number(match.ourScore||0));}
function powerPlayLabel(limit){return limit===2?'+2 players':limit===1?'+1 player':'None';}
function normalPlayerCount(match){return loadSettings().playersOnPitch;}
function replayPowerPlayAllowance(match){
  let allowance=0;
  let ourScore=0;
  let theirScore=0;
  const goals=(match.events||[]).filter(e=>e.type==='our_goal'||e.type==='their_goal');
  for(const e of goals){
    const previousDifference=Math.max(0,theirScore-ourScore);
    if(e.type==='our_goal')ourScore++; else theirScore++;
    const currentDifference=Math.max(0,theirScore-ourScore);
    if(currentDifference>previousDifference){
      if(previousDifference<4&&currentDifference>=4)allowance=1;
      if(previousDifference<6&&currentDifference>=6)allowance=2;
    }else if(currentDifference<previousDifference){
      if(previousDifference>5&&currentDifference<=5)allowance=Math.min(allowance,1);
      if(previousDifference>3&&currentDifference<=3)allowance=0;
    }
  }
  return allowance;
}
function ensurePowerPlayFields(match){
  if(!Array.isArray(match.powerPlayPlayers))match.powerPlayPlayers=[];
  if(typeof match.powerPlayRuleVersion!=='number'||match.powerPlayRuleVersion!==3){
    match.powerPlayAllowance=replayPowerPlayAllowance(match);
    match.powerPlayRuleVersion=3;
  }else if(typeof match.powerPlayAllowance!=='number'){
    match.powerPlayAllowance=0;
  }
  match.powerPlayPlayers=match.powerPlayPlayers.filter(id=>(match.currentOnPitch||[]).includes(id));
  return match;
}
function restorePlayerState(match,state){
  match.currentOnPitch=[...(state.currentOnPitch||[])];
  match.currentSubs=[...(state.currentSubs||[])];
  match.powerPlayPlayers=[...(state.powerPlayPlayers||[])];
  match.powerPlayAllowance=typeof state.powerPlayAllowance==='number'?state.powerPlayAllowance:match.powerPlayAllowance||0;
}
function capturePlayerState(match){return {currentOnPitch:[...(match.currentOnPitch||[])],currentSubs:[...(match.currentSubs||[])],powerPlayPlayers:[...(match.powerPlayPlayers||[])],powerPlayAllowance:Number(match.powerPlayAllowance)||0};}
function powerPlayEventText(e){const players=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));const p=players[e.playerId]?playerLabel(players[e.playerId]):'Unknown player';if(e.type==='power_play_on')return `⚡ ${p} on — Power Play +${e.count||1}`;if(e.type==='power_play_off')return `⚡ ${p} off — Power Play reduced`;return e.type;}
function elapsedNow(){const m=currentMatch();if(!m)return 0;if(!m.periodStartedAt)return m.periodElapsedSeconds||0;return (m.periodElapsedSeconds||0)+Math.floor((Date.now()-m.periodStartedAt)/1000);}
function formatClock(seconds){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
function matchMinute(){return Math.floor(elapsedNow()/60)+1;}
function stopInterval(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
function persistRunningClock(){const m=currentMatch();if(!m)return;m.periodElapsedSeconds=elapsedNow();if(m.periodStartedAt)m.periodStartedAt=Date.now();saveCurrentMatch(m);}
function updateClock(){const m=currentMatch();if(!$('matchClock')||!m)return;$('matchClock').textContent=formatClock(elapsedNow());$('clockStatus').textContent=m.periodStartedAt?'Running':'Paused';}
function startTimer(){const m=currentMatch();if(!m||m.fullTime||m.halfTime||m.periodStartedAt)return; m.periodStartedAt=Date.now();saveCurrentMatch(m);$('timerBtn').textContent='Pause';$('timerBtn').classList.add('active');updateClock();stopInterval();timerInterval=setInterval(updateClock,250);}
function pauseTimer(){const m=currentMatch();if(!m||!m.periodStartedAt)return;m.periodElapsedSeconds=elapsedNow();m.periodStartedAt=null;saveCurrentMatch(m);stopInterval();$('timerBtn').textContent='Start';$('timerBtn').classList.remove('active');updateClock();}
$('timerBtn').onclick=()=>{const m=currentMatch();if(!m)return;m.periodStartedAt?pauseTimer():startTimer();};

function renderLiveUI(){
  const match=currentMatch(); if(!match)return; ensureMatchFields(match);
  const players=loadPlayers(),byId=Object.fromEntries(players.map(p=>[p.id,p]));
  ensurePowerPlayFields(match);
  const ppLimit=powerPlayLimit(match),ppActive=match.powerPlayPlayers.length,ppDiff=powerPlayDifference(match);
  const needsWithdrawal=ppActive>ppLimit;
  $('powerPlayPanel').classList.toggle('is-active', ppActive>0); $('liveMatchView').querySelector('.live-card')?.classList.toggle('pp-score-active',ppActive>0);
  $('powerPlayPanel').classList.toggle('is-warning', needsWithdrawal);
  $('powerPlayStatus').textContent=ppActive>0?`ACTIVE — +${ppActive} player${ppActive===1?'':'s'}`:(ppLimit?`Eligible: ${powerPlayLabel(ppLimit)}`:'Not active');
  $('powerPlayCount').textContent=`${normalPlayerCount(match)+ppActive}v${normalPlayerCount(match)}`;
  $('powerPlayAddBtn').disabled=match.halfTime||match.fullTime||ppActive>=ppLimit||!match.currentSubs.length||ppLimit===0;
  $('powerPlayAddBtn').classList.toggle('hidden',ppLimit===0||ppActive>=ppLimit);
  $('powerPlayAddHint').textContent=ppLimit===0?'Reach a 4-goal deficit to unlock Power Play.':ppActive<ppLimit?`Goal difference: ${ppDiff}. You can add ${ppLimit-ppActive} Power Play player${ppLimit-ppActive===1?'':'s'}.`:'Power Play allowance is full.';
  $('powerPlayRemoveBtn').disabled=match.halfTime||match.fullTime||ppActive===0;
  $('powerPlayRemoveBtn').classList.toggle('hidden',!needsWithdrawal);
  $('powerPlayRequired').textContent=needsWithdrawal?`Required: withdraw ${ppActive-ppLimit} Power Play player${ppActive-ppLimit===1?'':'s'} now.`:'';
  $('powerPlayRequired').classList.toggle('hidden',!needsWithdrawal);
  const teamName=match.teamName||teamDisplaySettings().name,teamAbbr=cleanAbbr(match.teamAbbr,teamDisplaySettings().abbr),oppAbbr=cleanAbbr(match.opponentAbbr,derivedAbbr(match.opponent,'OPP')); $('ourScore').textContent=match.ourScore; $('theirScore').textContent=match.theirScore; $('ourTeamName').textContent=teamName; $('ourTeamCrest').textContent=teamAbbr; $('opponentScoreName').textContent=match.opponent; $('opponentTeamCrest').textContent=oppAbbr; $('liveMeta').textContent=`${match.opponent} · ${match.venue==='home'?'Home':'Away'} · ${match.date}`; $('livePlayerCount').textContent=`${normalPlayerCount(match)+ppActive}v${normalPlayerCount(match)}`;
  const periodText=match.period===1?'1st half':'2nd half'; $('matchPeriod').textContent=periodText; $('periodLabel').textContent=match.fullTime?'Full Time':(match.halfTime?'Half Time':periodText); $('periodMessage').textContent=match.fullTime?'Match finished':(match.halfTime?'Half time':(match.periodStartedAt?'':'Paused'));
  $('timerBtn').textContent=match.periodStartedAt?'Pause':'Start'; $('timerBtn').classList.toggle('active',!!match.periodStartedAt); $('timerBtn').disabled=match.fullTime||match.halfTime;
  $('halfTimeBtn').classList.toggle('hidden',match.period!==1||match.halfTime||match.fullTime);
  $('startSecondHalfBtn').classList.toggle('hidden',!(match.period===1&&match.halfTime&&!match.fullTime));
  $('fullTimeBtn').classList.toggle('hidden',!(match.period===2&&!match.fullTime));
  ['ourGoalBtn','theirGoalBtn','subBtn'].forEach(id=>$(id).disabled=match.halfTime||match.fullTime||needsWithdrawal);
  $('liveStarters').innerHTML=match.currentOnPitch.map(id=>byId[id]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No players on pitch.</p>';
  $('liveSubs').innerHTML=match.currentSubs.map(id=>byId[id]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No substitutes.</p>';
  $('eventTimeline').innerHTML=match.events.length?[...match.events].reverse().map(e=>`<div class="event-row"><span class="event-minute">${e.period===1?'1H':'2H'} ${e.minute}'</span><span>${escapeHtml(eventText(e))}</span></div>`).join(''):'<p class="muted">No events yet.</p>';
  $('undoBtn').disabled=match.events.length===0; updateClock(); saveCurrentMatch(match);
}
function eventText(e){const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));if(e.type==='our_goal'){const assistText=Object.prototype.hasOwnProperty.call(e,'assistPlayerId')?(e.assistPlayerId&&byId[e.assistPlayerId]?` — Assist: ${playerLabel(byId[e.assistPlayerId])}`:' — No assist'):'';return`⚽ ${byId[e.playerId]?playerLabel(byId[e.playerId]):'Unknown player'} scored${assistText}${e.penalty?' (Pen)':''}`;}if(e.type==='their_goal')return`⚽ Opponent scored${e.penalty?' (Pen)':''}`;if(e.type==='substitution')return`🔄 ${byId[e.offId]?playerLabel(byId[e.offId]):'Unknown'} off → ${byId[e.onId]?playerLabel(byId[e.onId]):'Unknown'} on`;if(e.type==='power_play_on')return powerPlayEventText(e);if(e.type==='power_play_off')return powerPlayEventText(e);return e.type;}

function startLiveMatch(id){activeMatchId=id;const m=currentMatch();if(!m)return;ensureMatchFields(m);m.periodStartedAt=null;matchElapsedSeconds=0;stopInterval();saveCurrentMatch(m);renderLiveUI();showView(liveMatchView);}
function openGoalDialog(kind){
  const match=currentMatch(); if(!match||match.halfTime||match.fullTime)return; ensurePowerPlayFields(match);
  const our=kind==='our_goal'; $('goalDialogTitle').textContent=our?'Our Goal':'Opponent Goal'; $('goalPlayerSection').classList.toggle('hidden',!our); $('goalPenalty').checked=false;
  const scorer=$('goalScorer'); const assist=$('goalAssist');
  if(our){
    const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
    const onPitch=match.currentOnPitch.map(id=>byId[id]).filter(Boolean);
    scorer.innerHTML=onPitch.map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');
    assist.innerHTML='<option value="">No assist</option>'+onPitch.map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');
  }
  $('goalDialog').dataset.kind=kind; $('goalDialog').showModal();
}
function updatePowerPlayAllowance(match,previousDifference){
  ensurePowerPlayFields(match);
  const currentDifference=powerPlayDifference(match);
  if(currentDifference>previousDifference){
    if(previousDifference<4&&currentDifference>=4)match.powerPlayAllowance=1;
    if(previousDifference<6&&currentDifference>=6)match.powerPlayAllowance=2;
  }else if(currentDifference<previousDifference){
    if(previousDifference>5&&currentDifference<=5)match.powerPlayAllowance=Math.min(match.powerPlayAllowance,1);
    if(previousDifference>3&&currentDifference<=3)match.powerPlayAllowance=0;
  }
}
function processPowerPlayAfterScore(match,previousDifference){
  ensurePowerPlayFields(match);
  updatePowerPlayAllowance(match,previousDifference);
  const limit=powerPlayLimit(match);
  saveCurrentMatch(match);
  renderLiveUI();
  if(match.powerPlayPlayers.length>limit)openPowerPlayOffDialog(true);
}
function recordGoal(type,playerId=null,assistPlayerId=null,penalty=false){
  const match=currentMatch(); if(!match||match.halfTime||match.fullTime)return;
  ensurePowerPlayFields(match);
  match.periodElapsedSeconds=elapsedNow(); match.periodStartedAt=match.periodStartedAt?Date.now():null;
  const beforeDifference=powerPlayDifference(match);
  const event={id:makeId(),type,period:match.period,minute:matchMinute(),playerId,assistPlayerId:assistPlayerId||null,penalty,beforePlayerState:capturePlayerState(match),beforeScore:{our:match.ourScore,their:match.theirScore},beforePowerPlayAllowance:Number(match.powerPlayAllowance)||0,beforeDifference};
  match.events.push(event);
  if(type==='our_goal')match.ourScore++;else match.theirScore++;
  processPowerPlayAfterScore(match,beforeDifference);
}
$('ourGoalBtn').onclick=()=>openGoalDialog('our_goal'); $('theirGoalBtn').onclick=()=>openGoalDialog('their_goal');
$('saveGoalBtn').onclick=()=>{const kind=$('goalDialog').dataset.kind;const penalty=$('goalPenalty').checked;const playerId=kind==='our_goal'?$('goalScorer').value:null;const assistPlayerId=kind==='our_goal'?($('goalAssist').value||null):null;if(kind==='our_goal'&&!playerId)return;if(kind==='our_goal'&&assistPlayerId===playerId)return;recordGoal(kind,playerId,assistPlayerId,penalty);$('goalDialog').close();}; $('cancelGoalBtn').onclick=()=>$('goalDialog').close();
function openSubDialog(){const match=currentMatch();if(!match||match.halfTime||match.fullTime)return;if(!match.currentSubs.length){alert('There are no substitutes available.');return;}const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));$('subOff').innerHTML=match.currentOnPitch.map(id=>byId[id]).filter(Boolean).map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');$('subOn').innerHTML=match.currentSubs.map(id=>byId[id]).filter(Boolean).map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');$('subDialog').showModal();}
$('subBtn').onclick=openSubDialog; $('cancelSubBtn').onclick=()=>$('subDialog').close();
$('subForm').onsubmit=e=>{e.preventDefault();const match=currentMatch();if(!match)return;ensurePowerPlayFields(match);if(match.powerPlayPlayers.length>powerPlayLimit(match))return;const off=$('subOff').value,on=$('subOn').value;if(!off||!on||off===on)return;match.periodElapsedSeconds=elapsedNow();if(match.periodStartedAt)match.periodStartedAt=Date.now();const beforePlayerState=capturePlayerState(match);const wasPowerPlay=match.powerPlayPlayers.includes(off);match.currentOnPitch=match.currentOnPitch.filter(id=>id!==off);match.currentOnPitch.push(on);match.currentSubs=match.currentSubs.filter(id=>id!==on);match.currentSubs.push(off);if(wasPowerPlay){match.powerPlayPlayers=match.powerPlayPlayers.filter(id=>id!==off);match.powerPlayPlayers.push(on);}match.events.push({id:makeId(),type:'substitution',period:match.period,minute:matchMinute(),offId:off,onId:on,powerPlaySlotTransferred:wasPowerPlay,beforePlayerState});saveCurrentMatch(match);$('subDialog').close();renderLiveUI();};
function openPowerPlayOnDialog(){const match=currentMatch();if(!match||match.halfTime||match.fullTime)return;ensurePowerPlayFields(match);const limit=powerPlayLimit(match);if(limit<=match.powerPlayPlayers.length||!match.currentSubs.length)return;const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));$('powerPlayOnPlayer').innerHTML=match.currentSubs.map(id=>byId[id]).filter(Boolean).map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');$('powerPlayOnDialog').showModal();}
function recordPowerPlayOn(playerId){const match=currentMatch();if(!match||match.halfTime||match.fullTime)return;ensurePowerPlayFields(match);const limit=powerPlayLimit(match);if(!playerId||limit<=match.powerPlayPlayers.length||!match.currentSubs.includes(playerId))return;match.periodElapsedSeconds=elapsedNow();if(match.periodStartedAt)match.periodStartedAt=Date.now();match.currentSubs=match.currentSubs.filter(id=>id!==playerId);match.currentOnPitch.push(playerId);match.powerPlayPlayers.push(playerId);match.events.push({id:makeId(),type:'power_play_on',period:match.period,minute:matchMinute(),playerId,onId:playerId,count:match.powerPlayPlayers.length});saveCurrentMatch(match);renderLiveUI();}
function openPowerPlayOffDialog(required=false){const match=currentMatch();if(!match||match.halfTime||match.fullTime)return;ensurePowerPlayFields(match);if(!match.powerPlayPlayers.length)return;const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));$('powerPlayOffPlayer').innerHTML=match.currentOnPitch.map(id=>byId[id]).filter(Boolean).map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');$('powerPlayOffRequired').textContent=required?'A player must be withdrawn because the goal difference has fallen.':'Select any player currently on the pitch to withdraw.';$('powerPlayOffDialog').dataset.required=required?'1':'0';$('powerPlayOffDialog').showModal();}
function recordPowerPlayOff(playerId){const match=currentMatch();if(!match||match.halfTime||match.fullTime)return;ensurePowerPlayFields(match);if(!playerId||!match.currentOnPitch.includes(playerId))return;const limit=powerPlayLimit(match);if(match.powerPlayPlayers.length<=limit)return;match.periodElapsedSeconds=elapsedNow();if(match.periodStartedAt)match.periodStartedAt=Date.now();const beforePlayerState=capturePlayerState(match);const removedPowerPlayPlayerId=match.powerPlayPlayers.includes(playerId)?playerId:match.powerPlayPlayers[match.powerPlayPlayers.length-1];match.currentOnPitch=match.currentOnPitch.filter(id=>id!==playerId);match.currentSubs.push(playerId);match.powerPlayPlayers=match.powerPlayPlayers.filter(id=>id!==removedPowerPlayPlayerId);match.events.push({id:makeId(),type:'power_play_off',period:match.period,minute:matchMinute(),playerId,removedPowerPlayPlayerId,beforePlayerState});saveCurrentMatch(match);$('powerPlayOffDialog').close();renderLiveUI();}
$('powerPlayAddBtn').onclick=openPowerPlayOnDialog;
$('powerPlayRemoveBtn').onclick=()=>openPowerPlayOffDialog(false);
$('savePowerPlayOnBtn').onclick=()=>{recordPowerPlayOn($('powerPlayOnPlayer').value);$('powerPlayOnDialog').close();};
$('cancelPowerPlayOnBtn').onclick=()=>$('powerPlayOnDialog').close();
$('savePowerPlayOffBtn').onclick=()=>recordPowerPlayOff($('powerPlayOffPlayer').value);
$('cancelPowerPlayOffBtn').onclick=()=>{const dialog=$('powerPlayOffDialog');if(dialog.dataset.required==='1')return;dialog.close();};
$('undoBtn').onclick=()=>{const match=currentMatch();if(!match||!match.events.length)return;const e=match.events.pop();if(e.type==='our_goal'||e.type==='their_goal'){if(e.beforeScore){match.ourScore=e.beforeScore.our;match.theirScore=e.beforeScore.their;}else{if(e.type==='our_goal')match.ourScore=Math.max(0,match.ourScore-1);if(e.type==='their_goal')match.theirScore=Math.max(0,match.theirScore-1);}if(e.beforePlayerState)restorePlayerState(match,e.beforePlayerState);}if(e.type==='substitution'&&e.beforePlayerState)restorePlayerState(match,e.beforePlayerState);if(e.type==='power_play_on'){match.currentOnPitch=match.currentOnPitch.filter(id=>id!==e.playerId);if(!match.currentSubs.includes(e.playerId))match.currentSubs.push(e.playerId);match.powerPlayPlayers=match.powerPlayPlayers.filter(id=>id!==e.playerId);}if(e.type==='power_play_off'){match.currentSubs=match.currentSubs.filter(id=>id!==e.playerId);if(!match.currentOnPitch.includes(e.playerId))match.currentOnPitch.push(e.playerId);if(!match.powerPlayPlayers.includes(e.playerId))match.powerPlayPlayers.push(e.playerId);}saveCurrentMatch(match);renderLiveUI();};

$('halfTimeBtn').onclick=()=>{const match=currentMatch();if(!match||match.period!==1||match.fullTime)return;pauseTimer();match.halfTime=true;match.halfTimeScore={our:match.ourScore,their:match.theirScore};saveCurrentMatch(match);renderLiveUI();};
$('startSecondHalfBtn').onclick=()=>{const match=currentMatch();if(!match||!match.halfTime||match.fullTime)return;match.period=2;match.halfTime=false;match.periodElapsedSeconds=0;match.periodStartedAt=null;saveCurrentMatch(match);renderLiveUI();startTimer();};
$('fullTimeBtn').onclick=()=>{const match=currentMatch();if(!match||match.period!==2||match.fullTime)return;pauseTimer();match.fullTime=true;match.status='completed';match.finalScore={our:match.ourScore,their:match.theirScore};match.completedAt=new Date().toISOString();saveCurrentMatch(match);openMatchReport(match.id);};
$('exitLiveMatchBtn').onclick=()=>{pauseTimer();activeMatchId=null;showView(homeView);};


function formatDateDisplay(value){
  if(!value)return 'Unknown date';
  const d=new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
}
function reportEventText(e){
  const players=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
  if(e.type==='our_goal'){const assistText=Object.prototype.hasOwnProperty.call(e,'assistPlayerId')?(e.assistPlayerId&&players[e.assistPlayerId]?` — Assist: ${playerLabel(players[e.assistPlayerId])}`:' — No assist'):''; return `⚽ ${players[e.playerId]?playerLabel(players[e.playerId]):'Unknown player'}${assistText}${e.penalty?' (Penalty)':''}`;}
  if(e.type==='their_goal') return `⚽ ${currentMatchReport?.opponent||'Opponent'}${e.penalty?' (Penalty)':''}`;
  if(e.type==='substitution') return `🔄 ${players[e.offId]?playerLabel(players[e.offId]):'Unknown'} off → ${players[e.onId]?playerLabel(players[e.onId]):'Unknown'} on`;
  if(e.type==='power_play_on') return powerPlayEventText(e);
  if(e.type==='power_play_off') return powerPlayEventText(e);
  return e.type;
}
let currentMatchReport=null;
function openMatchReport(id){
  const match=loadMatches().find(m=>m.id===id); if(!match)return;
  currentMatchReport=match;
  $('reportOpponent').textContent=match.opponent;
  $('reportMeta').textContent=`${match.venue==='home'?'Home':'Away'} · ${formatDateDisplay(match.date)}`;
  $('reportFinalScore').textContent=`${match.ourScore} - ${match.theirScore}`;
  const ht=match.halfTimeScore||{our:0,their:0}; $('reportHalfScore').textContent=`${ht.our} - ${ht.their}`;
  const events=match.events||[];
  const goals=events.filter(e=>e.type==='our_goal'||e.type==='their_goal');
  const subs=events.filter(e=>e.type==='substitution'||e.type==='power_play_on'||e.type==='power_play_off');
  $('reportGoals').innerHTML=goals.length?[...goals].map(e=>`<div class="event-row"><span class="event-minute">${e.period===1?'1H':'2H'} ${e.minute}'</span><span>${escapeHtml(reportEventText(e))}</span></div>`).join(''):'<p class="muted">No goals recorded.</p>';
  $('reportSubs').innerHTML=subs.length?[...subs].map(e=>`<div class="event-row"><span class="event-minute">${e.period===1?'1H':'2H'} ${e.minute}'</span><span>${escapeHtml(reportEventText(e))}</span></div>`).join(''):'<p class="muted">No substitutions recorded.</p>';
  const players=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
  $('reportStarters').innerHTML=(match.starterPlayerIds||[]).map(id=>players[id]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No starters recorded.</p>';
  $('reportSubstitutes').innerHTML=(match.substitutePlayerIds||[]).map(id=>players[id]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No substitutes recorded.</p>';
  activeMatchId=null; stopInterval(); showView($('matchReportView')); renderMatchHistory();
}
function resultClass(match){
  if(match.ourScore>match.theirScore)return 'result-win';
  if(match.ourScore<match.theirScore)return 'result-loss';
  return 'result-draw';
}
function resultText(match){
  if(match.ourScore>match.theirScore)return 'Won';
  if(match.ourScore<match.theirScore)return 'Lost';
  return 'Drew';
}
function renderMatchHistory(){
  const list=$('matchHistoryList'); if(!list)return;
  const matches=loadMatches().filter(m=>m.status==='completed'||m.fullTime).sort((a,b)=>(b.completedAt||b.createdAt||'').localeCompare(a.completedAt||a.createdAt||''));
  if(!matches.length){list.innerHTML='<p class="muted">No completed matches yet.</p>';return;}
  list.innerHTML=matches.map(m=>{const ta=cleanAbbr(m.teamAbbr,teamDisplaySettings().abbr),oa=cleanAbbr(m.opponentAbbr,derivedAbbr(m.opponent,'OPP'));return `<button class="history-card" type="button" data-match-id="${m.id}">
    <span class="history-date">${formatDateDisplay(m.date)}</span>
    <span class="history-main"><span class="history-opponent">${escapeHtml(ta)} ${m.ourScore} - ${m.theirScore} ${escapeHtml(oa)}</span><br><span class="history-result ${resultClass(m)}">${resultText(m)} · ${escapeHtml(m.opponent)} · HT ${m.halfTimeScore?`${m.halfTimeScore.our}-${m.halfTimeScore.their}`:'—'}</span></span>
    <span>›</span></button>`}).join('');
  document.querySelectorAll('.history-card').forEach(b=>b.onclick=()=>openMatchReport(b.dataset.matchId));
}
$('reportBackBtn').onclick=()=>{currentMatchReport=null;showView(homeView);renderMatchHistory();};
$('reportHomeBtn').onclick=()=>{currentMatchReport=null;showView(homeView);renderMatchHistory();};
$('deleteMatchBtn').onclick=()=>{
  if(!currentMatchReport)return;
  if(!confirm(`Delete the match against ${currentMatchReport.opponent}?`))return;
  saveMatches(loadMatches().filter(m=>m.id!==currentMatchReport.id));
  currentMatchReport=null; showView(homeView); renderMatchHistory();
};

renderSettings();renderPlayers();
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js?v=19.4').catch(()=>{}));

function refreshHomeData() {
  if (document.hidden) return;
  const home = $('homeView');
  if (!home || !home.classList.contains('hidden')) {
    renderMatchHistory();
    renderSeasonStatistics();
  }
}
window.addEventListener('load', () => {
  refreshHomeData();
  setTimeout(refreshHomeData, 100);
  setTimeout(refreshHomeData, 500);
});
window.addEventListener('pageshow', refreshHomeData);
document.addEventListener('visibilitychange', refreshHomeData);

function refreshHomeDataV15() {
  try {
    renderMatchHistory();
    renderSeasonStatistics();
  } catch (error) {
    console.error('Could not refresh home data', error);
  }
}
window.addEventListener('load', () => {
  refreshHomeDataV15();
  setTimeout(refreshHomeDataV15, 250);
  setTimeout(refreshHomeDataV15, 1000);
});
window.addEventListener('pageshow', refreshHomeDataV15);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshHomeDataV15();
});

refreshIdentityPreviews();

/* =========================================================
   v20 - match day UX overrides
   ========================================================= */
let batchOffIds = new Set();
let batchOnIds = new Set();

function renderBatchSubs(){
  const match=currentMatch(); if(!match)return;
  const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
  const offList=$('subOffList'), onList=$('subOnList');
  if(!offList||!onList)return;
  offList.innerHTML=match.currentOnPitch.map(id=>byId[id]).filter(Boolean).map(p=>`<label class="batch-choice"><input type="checkbox" class="batch-off-check" data-id="${p.id}" ${batchOffIds.has(p.id)?'checked':''}><span>${escapeHtml(playerLabel(p))}</span></label>`).join('');
  onList.innerHTML=match.currentSubs.map(id=>byId[id]).filter(Boolean).map(p=>`<label class="batch-choice"><input type="checkbox" class="batch-on-check" data-id="${p.id}" ${batchOnIds.has(p.id)?'checked':''}><span>${escapeHtml(playerLabel(p))}</span></label>`).join('');
  $('subOffCount').textContent=batchOffIds.size; $('subOnCount').textContent=batchOnIds.size;
  const valid=batchOffIds.size>0&&batchOffIds.size===batchOnIds.size;
  $('saveBatchSubsBtn').disabled=!valid;
  $('saveBatchSubsBtn').textContent=valid?`Save ${batchOffIds.size} substitution${batchOffIds.size===1?'':'s'}`:'Save substitutions';
  $('subBatchHint').textContent=batchOffIds.size===batchOnIds.size?(batchOffIds.size?`${batchOffIds.size} off · ${batchOnIds.size} on · recorded at ${matchMinute()}'`:'Select players to change.'):`Select the same number OFF and ON.`;
  document.querySelectorAll('.batch-off-check').forEach(c=>c.onchange=()=>{c.checked?batchOffIds.add(c.dataset.id):batchOffIds.delete(c.dataset.id);renderBatchSubs();});
  document.querySelectorAll('.batch-on-check').forEach(c=>c.onchange=()=>{c.checked?batchOnIds.add(c.dataset.id):batchOnIds.delete(c.dataset.id);renderBatchSubs();});
}

openSubDialog=function(){
  const match=currentMatch();if(!match||match.halfTime||match.fullTime)return;
  if(!match.currentSubs.length){alert('There are no substitutes available.');return;}
  batchOffIds=new Set();batchOnIds=new Set();renderBatchSubs();$('subDialog').showModal();
};
$('subBtn').onclick=openSubDialog;
$('cancelSubBtn').onclick=()=>$('subDialog').close();
$('subForm').onsubmit=e=>{
  e.preventDefault(); const match=currentMatch(); if(!match)return;
  if(!batchOffIds.size||batchOffIds.size!==batchOnIds.size)return;
  ensurePowerPlayFields(match); if(match.powerPlayPlayers.length>powerPlayLimit(match))return;
  match.periodElapsedSeconds=elapsedNow(); if(match.periodStartedAt)match.periodStartedAt=Date.now();
  const offs=[...batchOffIds], ons=[...batchOnIds], minute=matchMinute();
  offs.forEach((off,i)=>{
    const on=ons[i], beforePlayerState=capturePlayerState(match), wasPowerPlay=match.powerPlayPlayers.includes(off);
    match.currentOnPitch=match.currentOnPitch.filter(id=>id!==off); match.currentOnPitch.push(on);
    match.currentSubs=match.currentSubs.filter(id=>id!==on); match.currentSubs.push(off);
    if(wasPowerPlay){match.powerPlayPlayers=match.powerPlayPlayers.filter(id=>id!==off);match.powerPlayPlayers.push(on);}
    match.events.push({id:makeId(),type:'substitution',period:match.period,minute,offId:off,onId:on,powerPlaySlotTransferred:wasPowerPlay,beforePlayerState,batchId:'batch-'+minute});
  });
  saveCurrentMatch(match);$('subDialog').close();renderLiveUI();
};

// Opponent goals are deliberately one tap; Undo remains the safety net.
$('theirGoalBtn').onclick=()=>recordGoal('their_goal');

function goalTimeLabel(e){return `${e.period===2?'2H':'1H'} ${e.minute}'${e.penalty?' (Pen)':''}`;}
function scorerSummary(match,type){
  const players=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
  const goals=(match.events||[]).filter(e=>e.type===type);
  if(!goals.length)return '<span class="muted">No goals</span>';
  const groups=new Map();
  goals.forEach(e=>{
    const key=type==='their_goal'?'opponent':(e.playerId||'unknown');
    if(!groups.has(key))groups.set(key,{name:type==='their_goal'?match.opponent:(players[e.playerId]?.name||'Unknown'),goals:[]});
    groups.get(key).goals.push(e);
  });
  return [...groups.values()].map(group=>{
    const times=group.goals.map(goalTimeLabel).join(' · ');
    return `<div class="scorer-group"><strong>${escapeHtml(group.name)}</strong><span>${escapeHtml(times)}</span></div>`;
  }).join('');
}

openMatchReport=function(id){
  const match=loadMatches().find(m=>m.id===id); if(!match)return; currentMatchReport=match;
  const team=teamDisplaySettings(), ht=match.halfTimeScore||{our:0,their:0}, events=match.events||[];
  $('reportOurName').textContent=match.teamName||team.name; $('reportOpponent').textContent=match.opponent;
  $('reportOurCrest').textContent=cleanAbbr(match.teamAbbr,team.abbr); $('reportOpponentCrest').textContent=cleanAbbr(match.opponentAbbr,derivedAbbr(match.opponent,'OPP'));
  $('reportMeta').textContent=`${formatDateDisplay(match.date)} · ${match.venue==='home'?'Home':'Away'}`;
  $('reportOurScore').textContent=match.ourScore; $('reportTheirScore').textContent=match.theirScore; $('reportHalfScore').textContent=`${ht.our} - ${ht.their}`;
  $('reportOurScorers').innerHTML=scorerSummary(match,'our_goal'); $('reportTheirScorers').innerHTML=scorerSummary(match,'their_goal');
  const players=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
  const assists=events.filter(e=>e.type==='our_goal'&&e.assistPlayerId).map(e=>`${players[e.assistPlayerId]?.name||'Unknown'} ${goalTimeLabel(e)}`);
  $('reportAssistSummary').classList.toggle('hidden',!assists.length); $('reportAssistSummary').innerHTML=assists.length?`<strong>Assists</strong> · ${escapeHtml(assists.join(', '))}`:'';
  const goals=events.filter(e=>e.type==='our_goal'||e.type==='their_goal'), subs=events.filter(e=>e.type==='substitution'||e.type==='power_play_on'||e.type==='power_play_off');
  $('reportGoals').innerHTML=goals.length?goals.map(e=>`<div class="event-row"><span class="event-minute">${e.period===1?'1H':'2H'} ${e.minute}'</span><span>${escapeHtml(reportEventText(e))}</span></div>`).join(''):'<p class="muted">No goals recorded.</p>';
  $('reportSubs').innerHTML=subs.length?subs.map(e=>`<div class="event-row"><span class="event-minute">${e.period===1?'1H':'2H'} ${e.minute}'</span><span>${escapeHtml(reportEventText(e))}</span></div>`).join(''):'<p class="muted">No substitutions recorded.</p>';
  $('reportStarters').innerHTML=(match.starterPlayerIds||[]).map(pid=>players[pid]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No starters recorded.</p>';
  $('reportSubstitutes').innerHTML=(match.substitutePlayerIds||[]).map(pid=>players[pid]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No substitutes recorded.</p>';
  $('reportDetailsPanel').classList.add('hidden'); $('toggleMatchDetailsBtn').textContent='Match Details';
  activeMatchId=null;stopInterval();showView($('matchReportView'));renderMatchHistory();
};

$('toggleMatchDetailsBtn').onclick=()=>{const p=$('reportDetailsPanel'),hidden=p.classList.toggle('hidden');$('toggleMatchDetailsBtn').textContent=hidden?'Match Details':'Hide Details';};
async function svgShareImageForResult(){
  const hero=$('matchReportView')?.querySelector('.result-hero');
  const assists=$('reportAssistSummary');
  if(!hero)return null;
  const heroRect=hero.getBoundingClientRect();
  const assistHeight=assists&&!assists.classList.contains('hidden')?assists.getBoundingClientRect().height:0;
  const shareHeight=Math.max(1,Math.round(heroRect.height+assistHeight+2));
  const heroWidth=Math.max(320,Math.round(heroRect.width));
  const heroClone=hero.cloneNode(true);
  const assistClone=assists&&!assists.classList.contains('hidden')?assists.cloneNode(true):null;
  const styles=[];
  for(const sheet of Array.from(document.styleSheets)){
    try{for(const rule of Array.from(sheet.cssRules||[]))styles.push(rule.cssText);}catch(e){}
  }
  const rootStyle=getComputedStyle(document.documentElement);
  const variables=[];
  for(let i=0;i<rootStyle.length;i++){
    const name=rootStyle[i];
    if(name.startsWith('--'))variables.push(`${name}:${rootStyle.getPropertyValue(name)};`);
  }
  const wrapper=document.createElement('div');
  wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
  wrapper.style.cssText=`width:${heroWidth}px;background:linear-gradient(180deg,#0b2836,#05151e);color:#f7fbfd;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;overflow:hidden;border:1px solid rgba(181,215,228,.16);border-radius:24px;${variables.join('')}`;
  wrapper.appendChild(heroClone);
  if(assistClone)wrapper.appendChild(assistClone);
  const serializer=new XMLSerializer();
  const markup=serializer.serializeToString(wrapper);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${heroWidth}" viewBox="0 0 ${heroWidth} 100"><foreignObject x="0" y="0" width="100%" height="100%"><style>${styles.join('')}</style>${markup}</foreignObject></svg>`;
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  try{
    const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});
    const naturalHeight=shareHeight;
    const scale=Math.min(3,Math.max(2,window.devicePixelRatio||2));
    const canvas=document.createElement('canvas');
    canvas.width=heroWidth*scale;
    canvas.height=naturalHeight*scale;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',1));
    return png;
  }finally{URL.revokeObjectURL(url);}
}

$('shareResultBtn').onclick=async()=>{
  if(!currentMatchReport)return;
  const btn=$('shareResultBtn');
  const m=currentMatchReport, team=m.teamName||teamDisplaySettings().name, ht=m.halfTimeScore||{our:0,their:0};
  const text=`FULL TIME\n${team} ${m.ourScore} - ${m.theirScore} ${m.opponent}\nHT ${ht.our}-${ht.their}\n${formatDateDisplay(m.date)}`;
  const originalLabel=btn.textContent;
  btn.disabled=true;
  btn.textContent='Preparing...';
  try{
    const png=await svgShareImageForResult();
    if(png){
      const file=new File([png],`match-result-${m.date||'match'}.png`,{type:'image/png'});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({title:`${team} ${m.ourScore}-${m.theirScore} ${m.opponent}`,files:[file]});
        return;
      }
      if(navigator.share){
        await navigator.share({title:`${team} ${m.ourScore}-${m.theirScore} ${m.opponent}`,text});
        return;
      }
    }
    if(navigator.share)await navigator.share({title:`${team} ${m.ourScore}-${m.theirScore} ${m.opponent}`,text});
    else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert('Result copied to clipboard.');}
  }catch(e){
    if(e&&e.name!=='AbortError'){
      try{if(navigator.share)await navigator.share({title:`${team} ${m.ourScore}-${m.theirScore} ${m.opponent}`,text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert('Result copied to clipboard.');}}catch(f){}
    }
  }finally{
    btn.disabled=false;
    btn.textContent=originalLabel;
  }
};
$('reportBackBtn').onclick=()=>{currentMatchReport=null;showView(homeView);renderMatchHistory();};
$('reportHomeBtn').onclick=()=>{currentMatchReport=null;showView(homeView);renderMatchHistory();};
$('deleteMatchBtn').onclick=()=>{if(!currentMatchReport)return;if(!confirm(`Delete the match against ${currentMatchReport.opponent}?`))return;saveMatches(loadMatches().filter(m=>m.id!==currentMatchReport.id));currentMatchReport=null;showView(homeView);renderMatchHistory();};

/* =========================================================
   v20.2 - fluid first-use onboarding + match lobby
   ========================================================= */
const onboardingView = $('onboardingView');
let onboardingStep = 1;

function onboardingSettingsDraft(){
  return {...loadSettings(), teamName:$('onboardingTeamName')?.value.trim()||'', teamAbbr:cleanAbbr($('onboardingTeamAbbr')?.value,'YTM')};
}
function setOnboardingStep(step){
  onboardingStep=step;
  ['onboardingStep1','onboardingStep2','onboardingStep3','onboardingDone'].forEach(id=>$(id)?.classList.add('hidden'));
  const target=step===4?'onboardingDone':`onboardingStep${step}`;
  $(target)?.classList.remove('hidden');
  $('onboardingStepLabel').textContent=step===4?'READY':`${step} of 3`;
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderOnboardingSquad(){
  const players=loadPlayers(), s=loadSettings(), target=Math.max(1,Number(s.playersOnPitch)||5);
  $('onboardingSquadCount').textContent=`${players.length} player${players.length===1?'':'s'}`;
  $('onboardingPlayerList').innerHTML=players.length
    ? [...players].sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999)).map(p=>`<div class="onboarding-player-row"><span class="player-number">${escapeHtml(p.number||'-')}</span><span class="player-name">${escapeHtml(p.name)}</span><span class="position-badge">${escapeHtml(p.position||'—')}</span><button type="button" class="mini-delete-player" data-id="${p.id}" aria-label="Remove ${escapeHtml(p.name)}">×</button></div>`).join('')
    : '<p class="muted">Your squad will appear here.</p>';
  document.querySelectorAll('.mini-delete-player').forEach(btn=>btn.onclick=()=>{savePlayers(loadPlayers().filter(p=>p.id!==btn.dataset.id));renderOnboardingSquad();});
  const ready=players.length>=target;
  $('finishOnboardingBtn').disabled=!ready;
  $('onboardingSquadHint').textContent=ready?`${players.length} players added. You can add more or finish setup.`:`Add at least ${target} players to field your ${s.matchFormat}v${s.matchFormat} team.`;
}
function renderOnboarding(){
  const s=loadSettings();
  $('onboardingTeamName').value=s.teamName==='Your Team'?'':s.teamName;
  $('onboardingTeamAbbr').value=s.teamAbbr==='YTM'?'':cleanAbbr(s.teamAbbr,'YTM');
  document.querySelectorAll('.format-option').forEach(btn=>btn.classList.toggle('selected',Number(btn.dataset.format)===Number(s.matchFormat)));
  $('onboardingTeamCrest').textContent=cleanAbbr($('onboardingTeamAbbr')?.value,'YTM');
  renderOnboardingSquad();
}
function hasCompletedFirstUseSetup(){
  const raw=loadJson(SETTINGS_STORAGE_KEY,null), s=loadSettings(), players=loadPlayers();
  const valid=String(s.teamName||'').trim() && /^[A-Z0-9]{1,3}$/i.test(String(s.teamAbbr||'')) && Number(s.matchFormat)>0 && Number(s.playersOnPitch)>0 && players.length>=Number(s.playersOnPitch);
  return !!(valid && (s.onboardingComplete || raw));
}
function openFirstUseSetup(){
  renderOnboarding();
  setOnboardingStep(1);
  showView(onboardingView);
  window.setTimeout(()=>$('onboardingTeamName')?.focus(),120);
}
function closeFirstUseSetup(){
  ['onboardingView'].forEach(id=>$(id)?.classList.add('hidden'));
}
function finishOnboarding(){
  const s=loadSettings(), players=loadPlayers();
  if(!String($('onboardingTeamName').value||'').trim()){alert('Enter your team name.');setOnboardingStep(1);$('onboardingTeamName').focus();return;}
  if(players.length<Number(s.playersOnPitch)){setOnboardingStep(3);return;}
  saveSettings({...s,teamName:$('onboardingTeamName').value.trim(),teamAbbr:cleanAbbr($('onboardingTeamAbbr').value,'YTM'),onboardingComplete:true});
  renderOnboarding();
  $('onboardingCompleteTitle').textContent=`${loadSettings().teamName} is ready.`;
  $('onboardingCompleteMeta').textContent=`${loadSettings().matchFormat}v${loadSettings().matchFormat} · ${players.length} players`;
  setOnboardingStep(4);
}

function showView(view){
  [homeView,settingsView,matchSetupView,liveMatchView,matchReportView,onboardingView].forEach(v=>v?.classList.add('hidden'));
  view?.classList.remove('hidden');
  if(view===homeView){renderMatchHistory();renderSeasonStatistics();refreshIdentityPreviews();}
  if(view===settingsView){renderSettings();renderPlayers();refreshIdentityPreviews();}
  window.scrollTo({top:0,behavior:'smooth'});
}

$('onboardingTeamName')?.addEventListener('input',()=>{$('onboardingTeamCrest').textContent=cleanAbbr($('onboardingTeamAbbr')?.value,'YTM');});
$('onboardingTeamAbbr')?.addEventListener('input',()=>{$('onboardingTeamCrest').textContent=cleanAbbr($('onboardingTeamAbbr').value,'YTM');});
$('onboardingNext1')?.addEventListener('click',()=>{
  if(!String($('onboardingTeamName').value||'').trim()){alert('Enter your team name.');$('onboardingTeamName').focus();return;}
  const current=loadSettings();
  saveSettings({...current,teamName:$('onboardingTeamName').value.trim(),teamAbbr:cleanAbbr($('onboardingTeamAbbr').value,'YTM')});
  renderOnboarding();setOnboardingStep(2);
});
$('onboardingBack2')?.addEventListener('click',()=>setOnboardingStep(1));
document.querySelectorAll('.format-option').forEach(btn=>btn.addEventListener('click',()=>{
  const f=Number(btn.dataset.format); const s=loadSettings();
  saveSettings({...s,matchFormat:f,playersOnPitch:f,squadSize:Math.max(Number(s.squadSize)||12,f),onboardingComplete:false});
  document.querySelectorAll('.format-option').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');
}));
$('onboardingNext2')?.addEventListener('click',()=>{renderOnboardingSquad();setOnboardingStep(3);});
$('onboardingBack3')?.addEventListener('click',()=>setOnboardingStep(2));
$('quickAddPlayerBtn')?.addEventListener('click',()=>{
  const name=$('quickPlayerName').value.trim(); if(!name){$('quickPlayerName').focus();return;}
  const players=loadPlayers(),s=loadSettings(); if(players.length>=Math.max(5,Number(s.squadSize)||12)){alert('Your squad is full. Increase squad size in Settings to add more players.');return;}
  players.push({id:makeId(),name,number:$('quickPlayerNumber').value.trim(),position:$('quickPlayerPosition').value});savePlayers(players);
  $('quickPlayerName').value='';$('quickPlayerNumber').value='';$('quickPlayerPosition').value='';renderOnboardingSquad();$('quickPlayerName').focus();
});
$('onboardingTestSquadBtn')?.addEventListener('click',()=>{$('fillTestPlayersBtn')?.click();renderOnboardingSquad();});
$('finishOnboardingBtn')?.addEventListener('click',finishOnboarding);
$('onboardingSetupMatchBtn')?.addEventListener('click',()=>{closeFirstUseSetup();openMatchSetup();});
$('onboardingGoHomeBtn')?.addEventListener('click',()=>{closeFirstUseSetup();showView(homeView);});

function lastStartingIds(){
  const players=new Set(loadPlayers().map(p=>p.id));
  const previous=loadMatches().filter(m=>m.status==='completed'||m.fullTime).sort((a,b)=>(b.completedAt||b.createdAt||'').localeCompare(a.completedAt||a.createdAt||''))[0];
  const ids=(previous?.starterPlayerIds||[]).filter(id=>players.has(id));
  const n=loadSettings().playersOnPitch;
  return ids.length===n?ids:loadPlayers().slice(0,n).map(p=>p.id);
}
function openMatchSetup(){
  const players=loadPlayers(),s=loadSettings();
  if(players.length<s.playersOnPitch){alert(`You need at least ${s.playersOnPitch} players in the squad first.`);return;}
  availableIds=new Set(players.map(p=>p.id));starterIds=new Set(lastStartingIds());
  $('matchDate').value=new Date().toISOString().slice(0,10);$('opponentName').value='';$('opponentAbbr').value='';$('matchSetupError').textContent='';
  $('lobbyFormatText').textContent=`${s.matchFormat}v${s.matchFormat}`;
  $('availabilityWrap').classList.add('hidden');$('toggleAvailabilityBtn').textContent='Change availability';
  renderMatchSelection();showView(matchSetupView);refreshIdentityPreviews();
}
$('newMatchBtn').onclick=()=>{if(!hasCompletedFirstUseSetup()){openFirstUseSetup();return;}openMatchSetup();};
$('settingsBtn').onclick=()=>{closeFirstUseSetup();showView(settingsView);};
$('settingsBackBtn').onclick=()=>{closeFirstUseSetup();showView(homeView);};
$('toggleAvailabilityBtn')?.addEventListener('click',()=>{const w=$('availabilityWrap'), hidden=w.classList.toggle('hidden');$('toggleAvailabilityBtn').textContent=hidden?'Change availability':'Done';});

// Keep the team-format relationship explicit when settings are changed.
$('matchFormat').onchange=()=>{$('playersOnPitch').value=$('matchFormat').value;};

// Brand-new users begin with the guided flow, not the admin/settings screen.
if(!hasCompletedFirstUseSetup() && !loadSettings().onboardingComplete){openFirstUseSetup();}
