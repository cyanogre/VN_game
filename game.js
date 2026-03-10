// =====================================================================
// 1. STATE
// =====================================================================
const GAME = {
    day: 1, time: 10, energy: 100,
    location: 'apartamento',
    flags: {},
    ended: false
};

// =====================================================================
// 2. LOCATIONS  — se amplían al cargar una historia
// =====================================================================
const LOCATIONS = {
    apartamento:   { name: "Tu Apartamento",       desc: "Silencioso. Control total.",                       noise: 0, formal: 0,  hidden: false },
    cafeteria:     { name: "Cafetería Central",     desc: "Ambiente relajado. Conversaciones tranquilas.",   noise: 3, formal: 2,  hidden: false },
    discoteca:     { name: "Club Nocturno",         desc: "Ruido, alcohol y penumbra.",                      noise: 10, formal: 1, hidden: false },
    parque:        { name: "Parque Central",        desc: "Al aire libre. Casual y relajado.",               noise: 4, formal: 1,  hidden: false },
    gimnasio:      { name: "Gimnasio",              desc: "Cuerpos y competición. Fácil romper el hielo.",   noise: 5, formal: 2,  hidden: false },
    restaurante:   { name: "Restaurante",           desc: "Cenas íntimas. Ideal para profundizar.",          noise: 4, formal: 6,  hidden: false },
};

// =====================================================================
// 3. NPCs  — se inyectan al cargar una historia
// =====================================================================
const NPCS = {};
window.intros = window.intros || {};
window.kiss = window.kiss || {};
window.fondle = window.fondle || {};
let phoneOpen = false;
let activeNpcId = null;

// =====================================================================
// 4. STORY ENGINE  — se rellena al cargar una historia
// =====================================================================
const STORY_CONTENT = {};

// =====================================================================
// 5. STORY EVENT TRIGGERS  — se añaden al cargar una historia
// =====================================================================
const STORY_TRIGGERS = [];
function checkStoryTriggers() {
    if (GAME.ended) return false;
    for (let t of STORY_TRIGGERS) {
        if (!GAME.flags[t.id+'_done'] && t.check()) {
            GAME.flags[t.id+'_done'] = true;
            t.execute();
            return true;
        }
    }
    return false;
}

function showStory(id) {
    const d = STORY_CONTENT[id];
    if (!d) return;
    document.getElementById('story-tag').innerText = d.tag || 'Evento';
    document.getElementById('story-title').innerText = d.title;
    document.getElementById('story-body').innerHTML = d.text;
    const opts = document.getElementById('story-options');
    opts.innerHTML = '';
    d.options.forEach(o => {
        const btn = document.createElement('button');
        btn.className = 'story-btn';
        btn.innerHTML = o.labelClass ? `<span class="tag ${o.labelClass}">${o.label} </span>${o.text}` : o.text;
        btn.onclick = o.action;
        opts.appendChild(btn);
    });
    if (phoneOpen) togglePhone();
    document.getElementById('story-modal').classList.remove('hidden');
}

function closeStory() {
    document.getElementById('story-modal').classList.add('hidden');
    advanceTime(1);
    updateLocationView();
}

function triggerGameOver() {
    GAME.ended = true;
    document.getElementById('story-tag').innerText = 'Simulación Completada';
    document.getElementById('story-title').classList.add('ending-header');
    document.getElementById('story-title').innerText = '— Fin —';
    document.getElementById('story-body').innerHTML = `
        <p>Has completado un arco narrativo completo.</p>
        <p>Tus decisiones moldearon a esta persona: la empujaste hacia el amor honesto o la corrompiste hacia algo que ninguno de los dos puede llamar por su nombre.</p>
        <p style="margin-top:16px;color:var(--muted);font-size:11px;">Hay otros tres arcos esperando. Cada personaje tiene su propio camino.</p>`;
    const opts = document.getElementById('story-options');
    opts.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'story-btn';
    btn.style.cssText = 'background:rgba(59,125,216,0.15);border-color:var(--accent);color:#7ab8f0;text-align:center;font-weight:700;margin-top:8px;';
    btn.innerText = '↺  Reiniciar partida';
    btn.onclick = () => { location.reload(); };
    opts.appendChild(btn);
}

// =====================================================================
// 6. CORE ENGINE
// =====================================================================
function init() {
    document.getElementById('story-modal').classList.add('hidden');
    renderMap(); renderStats(); updateLocationView(); checkTriggers();
}

function closeIntro() {
    document.getElementById('intro-modal').classList.add('hidden');
    // Re-render completo por si la historia modificó NPCS/LOCATIONS
    renderMap();
    renderStats();
    updateLocationView();
    checkTriggers();
    log("Sales a la calle. Viajar cuesta 1 hora.", 'system');
    // Confirmar personajes de la historia cargada
    if (typeof _storyLoaded !== 'undefined' && _storyLoaded) {
        const base = ['undefined'];
        const extras = Object.keys(NPCS).filter(id => !base.includes(id));
        if (extras.length)
            log('\uD83D\uDCD6 Historia activa — Personajes adicionales: <b>' + extras.map(id=>NPCS[id].name).join(', ') + '</b>.', 'event');
        const baseLocs = ['apartamento','cafeteria','discoteca','parque','gimnasio','restaurante'];
        const extraLocs = Object.keys(LOCATIONS).filter(id => !baseLocs.includes(id) && !LOCATIONS[id].hidden);
        if (extraLocs.length)
            log('\uD83D\uDDFA Nuevas localizaciones: <b>' + extraLocs.map(id=>LOCATIONS[id].name).join(', ') + '</b>.', 'event');
    }
}

function formatTime(h) {
    let hour = h % 24;
    return `${String(hour).padStart(2,'0')}:00`;
}

function log(msg, type = 'normal') {
    if (GAME.ended) return;
    const el = document.getElementById('event-log');
    const d = document.createElement('div');
    d.className = `log-entry fade-in log-${type}`;
    d.innerHTML = `<span class="log-time">[${formatTime(GAME.time)}]</span> ${msg}`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
}

function modPlayer(energy) {
    if (GAME.ended) return;
    GAME.energy = Math.max(0, Math.min(100, GAME.energy + energy));
    document.getElementById('ui-energy').innerText = GAME.energy + '%';
    document.getElementById('bar-energy').style.width = GAME.energy + '%';
}

function modNpc(id, changes) {
    for (let k in changes) NPCS[id].stats[k] = Math.max(0, Math.min(100, NPCS[id].stats[k] + changes[k]));
    renderStats();
}

function advanceTime(h) {
    if (GAME.ended) return;
    GAME.time += h;
    GAME.energy = Math.max(0, GAME.energy - h * 2);
    if (GAME.time >= 26) { GAME.time = 8; GAME.day++; }
    document.getElementById('ui-time').innerText = formatTime(GAME.time);
    document.getElementById('ui-day').innerText = `Día ${GAME.day}`;
    checkTriggers();
    let ev = checkStoryTriggers();
    if (!ev) updateLocationView();
}

function travelTo(locId) {
    if (GAME.location === locId) return;

    if (GAME.energy < 8) {
        // Demasiado agotado: el juego te lleva a casa automáticamente
        log(`<b>⚠ Agotamiento total.</b> No puedes ir a otro sitio. Arrastras los pies hasta tu apartamento y caes dormido.`, 'warn');
        GAME.location = 'apartamento';
        document.getElementById('current-loc-badge').innerText = LOCATIONS['apartamento'].name;
        // El viaje forzado avanza el tiempo y cuesta energía extra por el esfuerzo
        GAME.time += 2;
        GAME.energy = Math.max(0, GAME.energy - 5); // puede quedar en negativo visual → 0
        if (GAME.time >= 26) { GAME.time = 8; GAME.day++; }
        document.getElementById('ui-time').innerText = formatTime(GAME.time);
        document.getElementById('ui-day').innerText = `Día ${GAME.day}`;
        // Recuperación automática al llegar a casa (sueño forzado)
        GAME.energy = 60;
        document.getElementById('ui-energy').innerText = GAME.energy + '%';
        document.getElementById('bar-energy').style.width = GAME.energy + '%';
        log(`Dormiste unas horas sin querer. Amaneces con el 60% de energía. <i>(Día ${GAME.day})</i>`, 'system');
        renderMap();
        checkTriggers();
        updateLocationView();
        return;
    }

    GAME.location = locId;
    document.getElementById('current-loc-badge').innerText = LOCATIONS[locId].name;
    log(`Viajaste a <b>${LOCATIONS[locId].name}</b>.`, 'action');
    advanceTime(1);
    renderMap();
}

// =====================================================================
// 7. NPC SCHEDULE
// =====================================================================
function getNpcLoc(npc) {
    let t = Math.min(Math.max(GAME.time, 8), 24);
    let hours = Object.keys(npc.schedule).map(Number).sort((a,b)=>b-a);
    for (let h of hours) { if (t >= h) return npc.schedule[h]; }
    return npc.schedule[8];
}

function getPresentNpcs() {
    return Object.values(NPCS).filter(n => getNpcLoc(n) === GAME.location);
}

// =====================================================================
// 8. CONTEXT TRIGGERS (home unlock, msgs)
// =====================================================================
function checkTriggers() {
    for (let id in NPCS) {
        let npc = NPCS[id];
        if (!npc.met) continue;
        // Home unlock
        let threshold = (npc.stats.afecto > 65 || npc.stats.complicidad > 65);
        if (threshold && !GAME.flags[`${id}_home_unlocked`] && LOCATIONS[`casa_${id}`]) {
            GAME.flags[`${id}_home_unlocked`] = true;
            LOCATIONS[`casa_${id}`].hidden = false;
            receiveMsg(id, `Oye... hoy estoy sola en casa. ¿Te apetece pasarte? 😏`);
            log(`<b>[DESBLOQUEADO]</b> Puedes visitar la casa de ${npc.name}.`, 'event');
            renderMap();
        }
        // Random messages
        if (!npc.phoneState.unread && !npc.phoneState.readButNoReply && Math.random() < 0.15) {
            let msgs = [];
            if (npc.stats.afecto > 35) msgs.push(`¡Oye! ¿Qué haces hoy?`, `Estaba pensando en ti.`);
            if (npc.stats.complicidad > 30) msgs.push(`Me aburro... 😏`, `¿Estás libre esta noche?`);
            if (msgs.length) receiveMsg(id, msgs[Math.floor(Math.random()*msgs.length)]);
        }
        // Riesgo acumulativo en casa (ruta libertina)
        if (GAME.flags[`${id}_ruta`]==='lib' && GAME.location===`casa_${id}` && GAME.flags[`${id}_riesgo`]) {
            if (Math.random() < 0.12) {
                modNpc(id, { sospecha: +6 });
                const avisos = [
                    `<i>Alguien vio tu coche aparcado frente a casa de ${npc.name}. La sospecha crece.</i>`,
                    `<i>${npc.name} borró los mensajes pero se le olvidó la papelera. El riesgo aumenta.</i>`,
                    `<i>Una vecina os vio entrar juntos. ${npc.name} lo nota en su mirada.</i>`
                ];
                log(avisos[Math.floor(Math.random()*avisos.length)], 'warn');
            }
        }
        if (npc.phoneState.readButNoReply && npc.phoneState.pendingMsg) {
            npc.phoneState.ignoreTime = (npc.phoneState.ignoreTime||0) + 1;
            if (npc.phoneState.ignoreTime > 5) {
                modNpc(id, { afecto: -12, sospecha: +8 });
                log(`<i>${npc.name} se ofendió por el visto ignorado.</i>`, 'system');
                npc.phoneState.readButNoReply = false;
                npc.phoneState.pendingMsg = null;
                renderChatList();
            }
        }
    }
}

// =====================================================================
// 9. ACTIONS
// =====================================================================
function selectNpc(id) {
    activeNpcId = id;
    document.querySelectorAll('.npc-card').forEach(el => el.classList.remove('selected'));
    const card = document.getElementById(`npc-${id}`);
    if (card) card.classList.add('selected');
    renderActionPanel();
}

function renderActionPanel() {
    const panel = document.getElementById('action-panel');
    panel.innerHTML = '';
    panel.classList.remove('hidden');
    let h = '';

    if (activeNpcId) {
        const npc = NPCS[activeNpcId];
        const loc = LOCATIONS[GAME.location];
        if (!npc.met) {
            h += `<button class="act-btn span2 success" onclick="doAction('introduce')">Acercarse y presentarse</button>`;
        } else {
            const loudBlock = loc.noise > 7;
            h += `<button class="act-btn${loudBlock?' ':''}" ${loudBlock?'disabled title="Demasiado ruido"':''} onclick="doAction('talk')">💬 Hablar en profundidad</button>`;
            h += `<button class="act-btn" onclick="doAction('flirt')">🔥 Coquetear</button>`;
            h += `<button class="act-btn" onclick="doAction('touch')">✋ Escalar contacto físico</button>`;
            h += `<button class="act-btn danger" onclick="doAction('libertine')">🎲 Dar el paso</button>`;
            if (npc.stats.afecto > 50) h += `<button class="act-btn success" onclick="doAction('kiss')">💝 Besar</button>`;
            if (npc.stats.complicidad > 40) h += `<button class="act-btn danger" onclick="doAction('fondle')">😈 Meter mano</button>`;
        }
        h += `<button class="act-btn span2" style="color:var(--muted);" onclick="activeNpcId=null;renderActionPanel()">← Dejar de interactuar</button>`;
    } else {
        if (GAME.location === 'apartamento') {
            h += `<button class="act-btn span2 success" onclick="doRest()">😴 Dormir / Descansar (+Energía)</button>`;
            h += `<button class="act-btn span2" onclick="doOsint()">🔍 Cotillear redes sociales (OSINT)</button>`;
        }
        h += `<button class="act-btn span2" onclick="doWait()">⏱ Esperar 1 hora aquí</button>`;
    }
    panel.innerHTML = h;
}

function doRest() { log("Dormiste unas horas.", 'action'); modPlayer(45, -35); advanceTime(4); }
function doWait() { log(`Esperas en ${LOCATIONS[GAME.location].name}...`, 'system'); modPlayer(-2, -4); advanceTime(1); }
function doOsint() {
    log("Cotilleas Instagram y stories...", 'action');
    modPlayer(-8, 6);
    let ids = Object.keys(NPCS).filter(id => NPCS[id].met);
    if (ids.length) {
        let id = ids[Math.floor(Math.random()*ids.length)];
        let loc = LOCATIONS[getNpcLoc(NPCS[id])].name;
        log(`<i>OSINT → ${NPCS[id].name} está ahora en: ${loc}</i>`, 'system');
    } else {
        log(`<i>OSINT: Encuentras perfiles de chicas interesantes en la ciudad.</i>`, 'system');
    }
    advanceTime(2);
}

function doAction(type) {
    const npc = NPCS[activeNpcId];
    const loc = LOCATIONS[GAME.location];



    switch(type) {
        case 'introduce':
            log(intros[npc.id] || `Te presentas a <b>${npc.name}</b>.`);
            npc.met = true; updateLocationView(); break;

        case 'talk':
            log(`Conversación profunda con ${npc.name}. La escuchas de verdad.`);
            modNpc(npc.id, { afecto: +10, autoestima: +6, complicidad: -4 }); break;

        case 'flirt':
            if (npc.stats.autoestima > 65) {
                log(`${npc.name} acepta el coqueteo con seguridad y te lo devuelve con interés.`);
                modNpc(npc.id, { atraccion: +12, complicidad: +4 });
            } else {
                log(`${npc.name} se ruboriza, abrumada pero halagada.`);
                modNpc(npc.id, { atraccion: +7, afecto: +5 });
            } break;

        case 'touch':
            if (loc.formal > 5) {
                if (npc.stats.atraccion < 30 || npc.stats.complicidad < 18) {
                    log(`<b>[RECHAZO]</b> "${npc.name} te aparta. 'Aquí no. La gente nos ve.'`,'warn');
                    modNpc(npc.id, { sospecha: +14, afecto: -8 });
                } else {
                    log(`<b>[MORBO]</b> ${npc.name} no se aparta. El riesgo la excita.`,'event');
                    modNpc(npc.id, { atraccion: +22, complicidad: +12 });
                }
            } else {
                if (npc.stats.atraccion < 15) {
                    log(`${npc.name} te para suavemente. "Aún no estamos ahí."`);
                    modNpc(npc.id, { afecto: -5 });
                } else {
                    log(`${npc.name} se acerca más. Te deja.`);
                    modNpc(npc.id, { atraccion: +12, complicidad: +6 });
                }
            } break;

        case 'libertine':
            modPlayer(0, 8);
            if (npc.stats.complicidad < 22 && npc.stats.afecto > 40) {
                log(`<b>[FALLO]</b> ${npc.name} frunce el ceño. "Pensaba que querías algo real."`, 'warn');
                modNpc(npc.id, { sospecha: +18, afecto: -18 });
            } else if (npc.stats.complicidad < 15) {
                log(`<b>[FALLO]</b> ${npc.name} parece incómoda. No era el momento.`, 'warn');
                modNpc(npc.id, { sospecha: +10, afecto: -10 });
            } else {
                log(`<b>[ÉXITO]</b> Sus ojos brillan. "¿Por qué negarnos lo que queremos?"`, 'event');
                modNpc(npc.id, { complicidad: +16, atraccion: +14, afecto: -4 });
            } break;

        case 'kiss':
            log(kiss[npc.id] || `Le dices algo sincero y específico a ${npc.name}.`, 'event');
            modNpc(npc.id, { afecto: +15, autoestima: +10, atraccion: +5 }); break;

        case 'fondle':
            log(fondle[npc.id] || `Le metes mano por sorpresa.`, 'event');
            modNpc(npc.id, { complicidad: +12, atraccion: +10, sospecha: +5 }); break;
    }
    advanceTime(1);
}

// =====================================================================
// 10. SMARTPHONE
// =====================================================================
function receiveMsg(npcId, text) {
    const npc = NPCS[npcId];
    npc.phoneState.unread = true;
    npc.phoneState.readButNoReply = false;
    npc.phoneState.pendingMsg = text;
    npc.phoneState.ignoreTime = 0;
    npc.phoneState.chatHistory.push({ from:'npc', text });
    document.getElementById('unread-count').classList.remove('hidden');
    log(`📱 Nuevo mensaje de <b>${npc.name}</b>.`, 'system');
    renderChatList();
}

function togglePhone() {
    phoneOpen = !phoneOpen;
    const popup = document.getElementById('phone-popup');
    popup.classList.toggle('hidden', !phoneOpen);
    if (phoneOpen) renderChatList();
    else closeChat();
}

function renderChatList() {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';
    let anyUnread = false;
    for (let id in NPCS) {
        const npc = NPCS[id];
        if (!npc.met) continue;
        if (npc.phoneState.unread) anyUnread = true;
        const last = npc.phoneState.chatHistory.slice(-1)[0];
        const preview = last ? last.text.substring(0,30)+(last.text.length>30?'...':'') : 'Pulsa para escribir';
        list.innerHTML += `<div onclick="openChat('${id}')" class="chat-item ${npc.phoneState.unread?'unread':''}">
            <div class="chat-item-name" style="color:${npc.color}">${npc.name}</div>
            <div class="chat-item-preview">${npc.phoneState.readButNoReply ? '<i>Visto ✓✓</i>' : preview}</div>
        </div>`;
    }
    document.getElementById('unread-count').classList.toggle('hidden', !anyUnread);
}

function openChat(npcId) {
    const npc = NPCS[npcId];
    npc.phoneState.unread = false;
    if (npc.phoneState.pendingMsg) npc.phoneState.readButNoReply = true;
    renderChatList();
    document.getElementById('chat-name').innerText = npc.name;
    const chatView = document.getElementById('chat-view');
    chatView.classList.remove('hidden');
    const msgs = document.getElementById('chat-messages');
    msgs.innerHTML = '';
    npc.phoneState.chatHistory.forEach(m => {
        msgs.innerHTML += `<div class="chat-msg ${m.from==='player'?'from-player':'from-npc'}">${m.text}</div>`;
    });
    msgs.scrollTop = msgs.scrollHeight;
    const acts = document.getElementById('chat-actions');
    acts.innerHTML = '';
    if (npc.phoneState.pendingMsg) {
        acts.innerHTML = `
            <button class="chat-act-btn" onclick="replyChat('${npcId}','instant')">Contestar</button>
            <button class="chat-act-btn" onclick="closeChat()" style="color:var(--muted)">Dejar en visto</button>`;
    } else {
        acts.innerHTML = `
            <button class="chat-act-btn special" onclick="initChat('${npcId}','location')">📍 ¿Dónde estás?</button>
            <button class="chat-act-btn" onclick="initChat('${npcId}','flirt')">😊 Tirarle los trastos</button>
            <button class="chat-act-btn" onclick="initChat('${npcId}','plans')">📅 Proponer un plan</button>`;
    }
}

function initChat(npcId, type) {
    const npc = NPCS[npcId];
    const typeMap = {
        location: { player: "¿Por dónde andas?", npc: () => `Estoy en ${LOCATIONS[getNpcLoc(npc)].name}.` },
        flirt:    { player: "Estaba pensando en ti 😉", npc: () => "Yo también en ti, la verdad..." },
        plans:    { player: "¿Hacemos algo esta tarde?", npc: () => npc.stats.afecto > 40 ? "Me apetece mucho, sí 😊" : "Déjame ver cómo tengo el día..." }
    };
    const t = typeMap[type];
    npc.phoneState.chatHistory.push({ from:'player', text: t.player });
    setTimeout(() => {
        npc.phoneState.chatHistory.push({ from:'npc', text: t.npc() });
        openChat(npcId);
    }, 400);
    if (type==='flirt') modNpc(npcId, { atraccion: +3 });
    openChat(npcId);
}

function replyChat(npcId, type) {
    const npc = NPCS[npcId];
    npc.phoneState.chatHistory.push({ from:'player', text: 'Contestastes 😊' });
    npc.phoneState.pendingMsg = null;
    npc.phoneState.readButNoReply = false;
    npc.phoneState.ignoreTime = 0;
    modNpc(npcId, { atraccion: +3, sospecha: -2 });
    log(`Contestaste a ${npc.name}.`, 'action');
    openChat(npcId);
}

function closeChat() {
    document.getElementById('chat-view').classList.add('hidden');
    renderChatList();
}

// =====================================================================
// 11. RENDER
// =====================================================================
function renderMap() {
    const c = document.getElementById('map-container');
    c.innerHTML = '';
    for (let id in LOCATIONS) {
        const loc = LOCATIONS[id];
        if (loc.hidden) continue;
        const isCurrent = GAME.location === id;
        // show npc dots
        let dots = Object.values(NPCS).filter(n => n.met && getNpcLoc(n) === id).map(n => `<span style="color:${n.color}">●</span>`).join(' ');
        const btn = document.createElement('button');
        btn.className = `loc-btn ${isCurrent ? 'active' : ''}`;
        btn.innerHTML = `<span class="loc-name">${loc.name} ${dots}</span><span class="loc-meta">Ruido ${loc.noise} · Formalidad ${loc.formal}</span>${!isCurrent?'<span class="loc-travel">⏱ 1h de viaje</span>':'<span class="loc-travel" style="color:var(--accent)">← Estás aquí</span>'}`;
        if (!isCurrent) btn.onclick = () => travelTo(id);
        c.appendChild(btn);
    }
}

function updateLocationView() {
    const loc = LOCATIONS[GAME.location];
    document.getElementById('loc-title').innerText = loc.name;
    document.getElementById('loc-desc').innerText = loc.desc;
    const npcListEl = document.getElementById('npc-list');
    npcListEl.innerHTML = '';
    activeNpcId = null;
    const present = getPresentNpcs();
    if (!present.length) {
        npcListEl.innerHTML = `<div style="color:var(--muted);font-size:11px;padding:8px;font-style:italic;">Nadie aquí.</div>`;
    } else {
        present.forEach(npc => {
            const name = npc.met ? npc.name : npc.unknownName;
            const d = document.createElement('div');
            d.className = 'npc-card';
            d.id = `npc-${npc.id}`;
            d.onclick = () => selectNpc(npc.id);
            d.innerHTML = `<span class="npc-status" style="background:${npc.met?npc.color:'var(--muted)'}"></span><span style="color:${npc.color};font-weight:700;">${name}</span>`;
            npcListEl.appendChild(d);
        });
    }
    renderActionPanel();
}

function renderStats() {
    const c = document.getElementById('debug-stats');
    c.innerHTML = '';
    for (let id in NPCS) {
        const npc = NPCS[id];
        const s = npc.stats;
        const bars = [
            { label:'Afecto', val:s.afecto, color:'#2ecc8a' },
            { label:'Atracción', val:s.atraccion, color:'#e8a832' },
            { label:'Autoestima', val:s.autoestima, color:'#3b7dd8' },
            { label:'Complicidad', val:s.complicidad, color:'#9b59d0' },
            { label:'Sospecha', val:s.sospecha, color:'#e0526b' },
        ];
        let barsHTML = bars.map(b => `
            <div class="stat-row">
                <span class="stat-label">${b.label}</span>
                <span class="stat-val" style="color:${b.color}">${b.val}</span>
            </div>
            <div class="stat-mini-bar"><div class="stat-mini-fill" style="width:${b.val}%;background:${b.color}"></div></div>
        `).join('');
        c.innerHTML += `<div class="npc-stat-card">
            <div class="npc-stat-name" style="color:${npc.color}">${npc.met ? npc.name : '???'} <span style="color:var(--muted);font-size:10px;font-weight:400;">${npc.met ? ('— Acto '+npc.storyStage) : '(sin conocer)'}</span></div>
            ${barsHTML}
        </div>`;
    }
}


// =====================================================================
// LOADER — carga dinámica de historias externas
// =====================================================================
let _storyLoaded = false;

// Drag & drop sobre el área
(function() {
    const drop = document.getElementById('loader-drop');
    if (!drop) return;
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) processStoryFile(file);
    });
})();

function handleStoryFile(e) {
    const file = e.target.files[0];
    if (file) processStoryFile(file);
    e.target.value = '';
}

function processStoryFile(file) {
    const status = document.getElementById('loader-status');
    const btn    = document.getElementById('btn-play');
    status.className = 'loader-status';
    status.textContent = 'Cargando…';

    const reader = new FileReader();
    reader.onload = ev => {
        const code = ev.target.result;

        // Validación mínima: debe parecer un .story.js de Sandbox
        if (!code.includes('STORY_DATA') && !code.includes('STORY_CONTENT') &&
            !code.includes('NPCS.') && !code.includes('Object.assign(STORY_CONTENT')) {
            status.className = 'loader-status err';
            status.textContent = '❌ Archivo no reconocido. Exporta desde el editor de Sandbox.';
            return;
        }

        // Capturar errores del script inyectado via onerror global temporal
        const _prevOnError = window.onerror;
        let _scriptError = null;
        window.onerror = (msg, src, line, col, err) => { _scriptError = err || msg; return true; };

        const tag = document.createElement('script');
        tag.textContent = code;
        document.head.appendChild(tag);

        window.onerror = _prevOnError; // restaurar

        if (_scriptError) {
            status.className = 'loader-status err';
            status.textContent = '❌ Error en la historia: ' + _scriptError;
            console.error('Story script error:', _scriptError);
            return;
        }

        _storyLoaded = true;
        status.className = 'loader-status ok';

        // Título: leer del objeto NPCS recién cargado
        let title = file.name.replace(/\.story\.js$/, '').replace(/_/g, ' ');
        const loadedNpcs = Object.keys(NPCS);
        if (loadedNpcs.length) title = loadedNpcs.map(id => NPCS[id].name).join(', ');

        status.textContent = '✓ Historia cargada — Personaje/s: ' + title;
        btn.classList.add('ready');

        document.getElementById('loader-drop').innerHTML =
            '<span class="icon">✅</span><b>' + title + '</b>'
            + (loadedNpcs.length ? '<br><span style="font-size:10px;color:var(--muted)">'+loadedNpcs.length+' personaje/s · '+Object.keys(LOCATIONS).filter(id=>!LOCATIONS[id].hidden).length+' localizaciones</span>' : '')
            + '<br><span style="font-size:10px;color:var(--muted);margin-top:4px;display:block">Haz clic para cambiar</span>';
    };
    reader.onerror = () => {
        document.getElementById('loader-status').className = 'loader-status err';
        document.getElementById('loader-status').textContent = '❌ No se pudo leer el archivo.';
    };
    reader.readAsText(file, 'utf-8');
}

// También acepta el formato .sandbox.json (importa NPCS, LOCATIONS, STORY_CONTENT, STORY_TRIGGERS)
function loadSandboxJson(data) {
    // LOCATIONS
    if (data.LOCATIONS) Object.assign(LOCATIONS, data.LOCATIONS);
    // NPCS
    if (data.NPCS) {
        for (let id in data.NPCS) {
            const n = data.NPCS[id];
            // Asegurarse de que phoneState existe
            if (!n.phoneState) n.phoneState = { pendingMsg:null, unread:false, readButNoReply:false, chatHistory:[], ignoreTime:0 };
            NPCS[id] = n;
        }
    }
    // STORY_CONTENT
    if (data.STORY_CONTENT) Object.assign(STORY_CONTENT, data.STORY_CONTENT);
    // STORY_TRIGGERS
    if (Array.isArray(data.STORY_TRIGGERS)) {
        data.STORY_TRIGGERS.forEach(t => {
            // Convertir condition string a función check()
            STORY_TRIGGERS.push({
                id: t.id,
                check: new Function('return ' + (t.condition || 'false')).bind(null),
                execute: () => { GAME.flags[t.id + '_done'] = true; showStory(t.targetStoryNode || t.id); }
            });
        });
    }
}

function startGame(skipStory) {
    document.getElementById('loader-modal').classList.add('hidden');
    // Mostrar el intro normal (tiene el botón "Salir a la calle" → closeIntro)
    document.getElementById('intro-modal').classList.remove('hidden');
    // Pre-renderizar en segundo plano para que todo esté listo
    init();
}

// Arranque: mostrar loader, NO llamar a init() todavía
document.getElementById('loader-modal').classList.remove('hidden');
// Asegurar que el intro y story modal empiezan ocultos
document.getElementById('intro-modal').classList.add('hidden');
document.getElementById('story-modal').classList.add('hidden');
