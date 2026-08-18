const PLAYER_STORAGE_KEY = 'grassroots-football-tracker.players';
const SETTINGS_STORAGE_KEY = 'grassroots-football-tracker.settings';
const MATCH_STORAGE_KEY = 'grassroots-football-tracker.matches';

const defaultSettings = { matchFormat: 5, squadSize: 12, playersOnPitch: 5 };
let editingPlayerId = null;
let availableIds = new Set();
let starterIds = new Set();
let activeMatchId = null;
let timerInterval = null;
let timerStartedAt = null;
let matchElapsedSeconds = 0;

const $ = (id) => document.getElementById(id);
const homeView = $('homeView'), matchSetupView = $('matchSetupView'), liveMatchView = $('liveMatchView');
const playerDialog = $('playerDialog'), playerForm = $('playerForm');
const playerName = $('playerName'), playerNumber = $('playerNumber'), playerPosition = $('playerPosition');

function makeId() { return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadPlayers() { return loadJson(PLAYER_STORAGE_KEY, []); }
function savePlayers(v) { saveJson(PLAYER_STORAGE_KEY, v); }
function loadSettings() { return { ...defaultSettings, ...loadJson(SETTINGS_STORAGE_KEY, {}) }; }
function saveSettings(v) { saveJson(SETTINGS_STORAGE_KEY, v); }
function loadMatches() { return loadJson(MATCH_STORAGE_KEY, []); }
function saveMatches(v) { saveJson(MATCH_STORAGE_KEY, v); }
function escapeHtml(v) { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function playerLabel(p) { return `${p.number ? `#${p.number} ` : ''}${p.name}${p.position ? ` · ${p.position}` : ''}`; }
const matchReportView = $('matchReportView');
function showView(view) { [homeView, matchSetupView, liveMatchView, matchReportView].forEach(v => v.classList.add('hidden')); view.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }

function renderSettings() { const s=loadSettings(); $('matchFormat').value=String(s.matchFormat); $('squadSize').value=s.squadSize; $('playersOnPitch').value=s.playersOnPitch; }
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
playerForm.onsubmit=e=>{e.preventDefault();const players=loadPlayers(),data={name:playerName.value.trim(),number:playerNumber.value.trim(),position:playerPosition.value};if(!data.name)return;if(editingPlayerId)Object.assign(players.find(p=>p.id===editingPlayerId),data);else players.push({id:makeId(),...data});savePlayers(players);renderPlayers();playerDialog.close();};
$('deletePlayerBtn').onclick=()=>{const p=loadPlayers().find(x=>x.id===editingPlayerId);if(!p||!confirm(`Delete ${p.name}?`))return;savePlayers(loadPlayers().filter(x=>x.id!==editingPlayerId));playerDialog.close();renderPlayers();};
$('fillTestPlayersBtn').onclick=()=>{const s=loadSettings(),players=loadPlayers();if(players.length&&!confirm('Add test players to the existing squad?'))return;const names=new Set(players.map(p=>p.name.toLowerCase()));for(let i=1;i<=s.squadSize;i++){const name=`Player ${i}`;if(!names.has(name.toLowerCase()))players.push({id:makeId(),name,number:String(i),position:''});}savePlayers(players);renderPlayers();};
$('settingsForm').onsubmit=e=>{e.preventDefault();const s={matchFormat:Number($('matchFormat').value),squadSize:Math.max(5,Number($('squadSize').value)||12),playersOnPitch:Math.max(1,Number($('playersOnPitch').value)||5)};saveSettings(s);
function formatDateDisplay(value){
  if(!value)return 'Unknown date';
  const d=new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
}
function reportEventText(e){
  const players=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));
  if(e.type==='our_goal') return `⚽ ${players[e.playerId]?playerLabel(players[e.playerId]):'Unknown player'}${e.penalty?' (Penalty)':''}`;
  if(e.type==='their_goal') return `⚽ ${currentMatchReport?.opponent||'Opponent'}${e.penalty?' (Penalty)':''}`;
  if(e.type==='substitution') return `🔄 ${players[e.offId]?playerLabel(players[e.offId]):'Unknown'} off → ${players[e.onId]?playerLabel(players[e.onId]):'Unknown'} on`;
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
  const subs=events.filter(e=>e.type==='substitution');
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
  list.innerHTML=matches.map(m=>`<button class="history-card" type="button" data-match-id="${m.id}">
    <span class="history-date">${formatDateDisplay(m.date)}</span>
    <span class="history-main"><span class="history-opponent">${escapeHtml(m.opponent)}</span><br><span class="history-result ${resultClass(m)}">${resultText(m)} ${m.ourScore} - ${m.theirScore} · HT ${m.halfTimeScore?`${m.halfTimeScore.our}-${m.halfTimeScore.their}`:'—'}</span></span>
    <span>›</span></button>`).join('');
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

renderSettings();renderPlayers();renderMatchHistory();$('settingsSaved').textContent='Saved';setTimeout(()=>$('settingsSaved').textContent='',1500);};
$('matchFormat').onchange=()=>{$('playersOnPitch').value=$('matchFormat').value;};

function openMatchSetup(){const players=loadPlayers(),s=loadSettings();if(players.length<s.playersOnPitch){alert(`You need at least ${s.playersOnPitch} players in the squad first.`);return;}availableIds=new Set(players.map(p=>p.id));starterIds=new Set(players.slice(0,s.playersOnPitch).map(p=>p.id));$('matchDate').value=new Date().toISOString().slice(0,10);$('opponentName').value='';$('matchSetupError').textContent='';renderMatchSelection();showView(matchSetupView);}
function renderMatchSelection(){const players=loadPlayers(),s=loadSettings();$('startingTeamHeading').textContent=`Starting ${s.playersOnPitch}`;$('availableCount').textContent=`${availableIds.size} available`;$('starterCount').textContent=`${starterIds.size} / ${s.playersOnPitch}`;$('availabilityList').innerHTML=players.map(p=>`<label class="selection-row"><input class="availability-check" type="checkbox" data-id="${p.id}" ${availableIds.has(p.id)?'checked':''}><span>${escapeHtml(playerLabel(p))}</span></label>`).join('');$('starterList').innerHTML=players.filter(p=>availableIds.has(p.id)).map(p=>`<label class="selection-row ${starterIds.has(p.id)?'selected':''}"><input class="starter-check" type="checkbox" data-id="${p.id}" ${starterIds.has(p.id)?'checked':''}><span>${escapeHtml(playerLabel(p))}</span></label>`).join('');const subs=players.filter(p=>availableIds.has(p.id)&&!starterIds.has(p.id));$('substituteList').innerHTML=subs.length?subs.map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join(''):'<p class="muted">No substitutes selected.</p>';document.querySelectorAll('.availability-check').forEach(c=>c.onchange=()=>{if(c.checked)availableIds.add(c.dataset.id);else{availableIds.delete(c.dataset.id);starterIds.delete(c.dataset.id);}renderMatchSelection();});document.querySelectorAll('.starter-check').forEach(c=>c.onchange=()=>{if(c.checked){if(starterIds.size>=s.playersOnPitch){$('matchSetupError').textContent=`You can only select ${s.playersOnPitch} starters.`;return;}starterIds.add(c.dataset.id);}else starterIds.delete(c.dataset.id);$('matchSetupError').textContent='';renderMatchSelection();});}
$('newMatchBtn').onclick=openMatchSetup; $('cancelMatchSetupBtn').onclick=()=>showView(homeView);
$('matchSetupForm').onsubmit=e=>{e.preventDefault();const s=loadSettings(),opponent=$('opponentName').value.trim();if(!opponent){$('matchSetupError').textContent='Enter the opponent name.';return;}if(availableIds.size<s.playersOnPitch){$('matchSetupError').textContent=`You need at least ${s.playersOnPitch} available players.`;return;}if(starterIds.size!==s.playersOnPitch){$('matchSetupError').textContent=`Select exactly ${s.playersOnPitch} starters.`;return;}const match={id:makeId(),opponent,date:$('matchDate').value,venue:document.querySelector('input[name="venue"]:checked').value,availablePlayerIds:[...availableIds],starterPlayerIds:[...starterIds],substitutePlayerIds:[...availableIds].filter(id=>!starterIds.has(id)),currentOnPitch:[...starterIds],currentSubs:[...availableIds].filter(id=>!starterIds.has(id)),status:'live',period:1,halfTime:false,fullTime:false,ourScore:0,theirScore:0,events:[],periodElapsedSeconds:0,periodStartedAt:null,createdAt:new Date().toISOString()};const matches=loadMatches();matches.push(match);saveMatches(matches);startLiveMatch(match.id);};

function currentMatch(){return loadMatches().find(m=>m.id===activeMatchId)||null;}
function saveCurrentMatch(match){const matches=loadMatches();const i=matches.findIndex(m=>m.id===match.id);if(i>=0){matches[i]=match;saveMatches(matches);}}
function ensureMatchFields(match){
  if(!match.events)match.events=[]; if(!Array.isArray(match.currentOnPitch))match.currentOnPitch=[...(match.starterPlayerIds||[])]; if(!Array.isArray(match.currentSubs))match.currentSubs=[...(match.substitutePlayerIds||[])];
  if(!match.period)match.period=1; if(typeof match.halfTime!=='boolean')match.halfTime=false; if(typeof match.fullTime!=='boolean')match.fullTime=match.status==='completed';
  if(typeof match.periodElapsedSeconds!=='number')match.periodElapsedSeconds=typeof match.elapsedSeconds==='number'?match.elapsedSeconds:0;
  if(match.periodStartedAt===undefined)match.periodStartedAt=null;
  return match;
}
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
  $('ourScore').textContent=match.ourScore; $('theirScore').textContent=match.theirScore; $('liveOpponent').textContent=match.opponent; $('opponentScoreName').textContent=match.opponent; $('liveMeta').textContent=`${match.venue==='home'?'Home':'Away'} · ${match.date}`;
  const periodText=match.period===1?'1st half':'2nd half'; $('matchPeriod').textContent=periodText; $('periodLabel').textContent=match.fullTime?'Full Time':(match.halfTime?'Half Time':periodText); $('periodMessage').textContent=match.fullTime?'Match finished':(match.halfTime?'Half time':(match.periodStartedAt?'':'Paused'));
  $('timerBtn').textContent=match.periodStartedAt?'Pause':'Start'; $('timerBtn').classList.toggle('active',!!match.periodStartedAt); $('timerBtn').disabled=match.fullTime||match.halfTime;
  $('halfTimeBtn').classList.toggle('hidden',match.period!==1||match.halfTime||match.fullTime);
  $('startSecondHalfBtn').classList.toggle('hidden',!(match.period===1&&match.halfTime&&!match.fullTime));
  $('fullTimeBtn').classList.toggle('hidden',!(match.period===2&&!match.fullTime));
  ['ourGoalBtn','theirGoalBtn','subBtn'].forEach(id=>$(id).disabled=match.halfTime||match.fullTime);
  $('liveStarters').innerHTML=match.currentOnPitch.map(id=>byId[id]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No players on pitch.</p>';
  $('liveSubs').innerHTML=match.currentSubs.map(id=>byId[id]).filter(Boolean).map(p=>`<div class="summary-row">${escapeHtml(playerLabel(p))}</div>`).join('')||'<p class="muted">No substitutes.</p>';
  $('eventTimeline').innerHTML=match.events.length?[...match.events].reverse().map(e=>`<div class="event-row"><span class="event-minute">${e.period===1?'1H':'2H'} ${e.minute}'</span><span>${escapeHtml(eventText(e))}</span></div>`).join(''):'<p class="muted">No events yet.</p>';
  $('undoBtn').disabled=match.events.length===0; updateClock(); saveCurrentMatch(match);
}
function eventText(e){const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));if(e.type==='our_goal')return`⚽ ${byId[e.playerId]?playerLabel(byId[e.playerId]):'Unknown player'} scored${e.penalty?' (P)':''}`;if(e.type==='their_goal')return`⚽ Opponent scored${e.penalty?' (P)':''}`;if(e.type==='substitution')return`🔄 ${byId[e.offId]?playerLabel(byId[e.offId]):'Unknown'} off → ${byId[e.onId]?playerLabel(byId[e.onId]):'Unknown'} on`;return e.type;}

function startLiveMatch(id){activeMatchId=id;const m=currentMatch();if(!m)return;ensureMatchFields(m);m.periodStartedAt=null;matchElapsedSeconds=0;stopInterval();saveCurrentMatch(m);renderLiveUI();showView(liveMatchView);}
function openGoalDialog(kind){
  const match=currentMatch(); if(!match||match.halfTime||match.fullTime)return;
  const our=kind==='our_goal'; $('goalDialogTitle').textContent=our?'Our Goal':'Opponent Goal'; $('goalPlayerSection').classList.toggle('hidden',!our); $('goalPenalty').checked=false;
  const scorer=$('goalScorer');
  if(our){const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));scorer.innerHTML=match.currentOnPitch.map(id=>byId[id]).filter(Boolean).map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');}
  $('goalDialog').dataset.kind=kind; $('goalDialog').showModal();
}
function recordGoal(type,playerId=null,penalty=false){const match=currentMatch();if(!match||match.halfTime||match.fullTime)return;match.periodElapsedSeconds=elapsedNow();match.periodStartedAt=match.periodStartedAt?Date.now():null;const event={id:makeId(),type,period:match.period,minute:matchMinute(),playerId,penalty};match.events.push(event);if(type==='our_goal')match.ourScore++;else match.theirScore++;saveCurrentMatch(match);renderLiveUI();}
$('ourGoalBtn').onclick=()=>openGoalDialog('our_goal'); $('theirGoalBtn').onclick=()=>openGoalDialog('their_goal');
$('saveGoalBtn').onclick=()=>{const kind=$('goalDialog').dataset.kind;const penalty=$('goalPenalty').checked;const playerId=kind==='our_goal'?$('goalScorer').value:null;if(kind==='our_goal'&&!playerId)return;recordGoal(kind,playerId,penalty);$('goalDialog').close();}; $('cancelGoalBtn').onclick=()=>$('goalDialog').close();
function openSubDialog(){const match=currentMatch();if(!match||match.halfTime||match.fullTime)return;if(!match.currentSubs.length){alert('There are no substitutes available.');return;}const byId=Object.fromEntries(loadPlayers().map(p=>[p.id,p]));$('subOff').innerHTML=match.currentOnPitch.map(id=>byId[id]).filter(Boolean).map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');$('subOn').innerHTML=match.currentSubs.map(id=>byId[id]).filter(Boolean).map(p=>`<option value="${p.id}">${escapeHtml(playerLabel(p))}</option>`).join('');$('subDialog').showModal();}
$('subBtn').onclick=openSubDialog; $('cancelSubBtn').onclick=()=>$('subDialog').close();
$('subForm').onsubmit=e=>{e.preventDefault();const match=currentMatch();if(!match)return;const off=$('subOff').value,on=$('subOn').value;if(!off||!on||off===on)return;match.periodElapsedSeconds=elapsedNow();if(match.periodStartedAt)match.periodStartedAt=Date.now();match.currentOnPitch=match.currentOnPitch.filter(id=>id!==off);match.currentOnPitch.push(on);match.currentSubs=match.currentSubs.filter(id=>id!==on);match.currentSubs.push(off);match.events.push({id:makeId(),type:'substitution',period:match.period,minute:matchMinute(),offId:off,onId:on});saveCurrentMatch(match);$('subDialog').close();renderLiveUI();};
$('undoBtn').onclick=()=>{const match=currentMatch();if(!match||!match.events.length)return;const e=match.events.pop();if(e.type==='our_goal')match.ourScore=Math.max(0,match.ourScore-1);if(e.type==='their_goal')match.theirScore=Math.max(0,match.theirScore-1);if(e.type==='substitution'){match.currentOnPitch=match.currentOnPitch.filter(id=>id!==e.onId);match.currentOnPitch.push(e.offId);match.currentSubs=match.currentSubs.filter(id=>id!==e.offId);match.currentSubs.push(e.onId);}saveCurrentMatch(match);renderLiveUI();};

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
  if(e.type==='our_goal') return `⚽ ${players[e.playerId]?playerLabel(players[e.playerId]):'Unknown player'}${e.penalty?' (Penalty)':''}`;
  if(e.type==='their_goal') return `⚽ ${currentMatchReport?.opponent||'Opponent'}${e.penalty?' (Penalty)':''}`;
  if(e.type==='substitution') return `🔄 ${players[e.offId]?playerLabel(players[e.offId]):'Unknown'} off → ${players[e.onId]?playerLabel(players[e.onId]):'Unknown'} on`;
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
  const subs=events.filter(e=>e.type==='substitution');
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
  list.innerHTML=matches.map(m=>`<button class="history-card" type="button" data-match-id="${m.id}">
    <span class="history-date">${formatDateDisplay(m.date)}</span>
    <span class="history-main"><span class="history-opponent">${escapeHtml(m.opponent)}</span><br><span class="history-result ${resultClass(m)}">${resultText(m)} ${m.ourScore} - ${m.theirScore} · HT ${m.halfTimeScore?`${m.halfTimeScore.our}-${m.halfTimeScore.their}`:'—'}</span></span>
    <span>›</span></button>`).join('');
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
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js?v=9').catch(()=>{}));
