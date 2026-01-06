// Disasters.js
// Comprehensive disasters mod
// - tornado (EF scale), thunderstorm/blizzard (moving), sandstorm (desert-only, moving), tsunami (coastal strip),
//   volcano (mountain-only), meteor, solar flare (jagged/long/less deadly), alien_laser (permanent), nuke (50 days).
// - Adds settings option: Disaster spawn rate (Low/Normal/High/Extreme) -> userSettings.disasters_spawn_rate
// - All storms (thunderstorm/blizzard/sandstorm) move daily using a master mover tick.
// - Console helper: NaturalDisasters.spawn(type)
// - Final load message: "Disasters mod enabled"
(function(){
  const MOD_ID = "Disasters_mod_v1";
  try { if (window.$wt && $wt.modsLoaded && $wt.modsLoaded.includes(MOD_ID)) return; } catch(e){}
  try { if (window.$wt && $wt.modsLoaded) $wt.modsLoaded.push(MOD_ID); } catch(e){}

  // ---------- Utilities ----------
  function safeLog(msg){
    try { if (typeof logMessage === "function") { logMessage(msg); return; } } catch(e){}
    try { if (window.$wt && $wt.notify) { $wt.notify(msg); return; } } catch(e){}
    console.log(msg);
  }
  function uid(pref){ return (pref||"id")+"_"+Math.floor(Math.random()*1e9).toString(36); }
  function _choose(arr){ return (arr && arr.length) ? arr[Math.floor(Math.random()*arr.length)] : null; }
  function _randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // Wait helper
  function waitFor(predicate, cb, timeout=4000){
    const start = Date.now();
    (function tick(){
      try { if (predicate()) return cb(); } catch(e){}
      if (Date.now() - start > timeout) { console.warn("Disasters: waitFor timed out"); return; }
      setTimeout(tick, 50);
    })();
  }

  // Towns / chunk helpers (robust fallbacks)
  function getAllTowns(){
    try {
      if (typeof regFilter === "function") {
        try { const t = regFilter("town", ()=>true); if (Array.isArray(t)) return t; } catch(e){}
      }
    } catch(e){}
    if (window.regs && regs.town && Array.isArray(regs.town)) return regs.town;
    if (window.towns && Array.isArray(towns)) return towns;
    if (window.planet && Array.isArray(planet.towns)) return planet.towns;
    return [];
  }

  const chunkAtFn = (typeof chunkAt === "function") ? chunkAt : ((cx,cy) => (planet && planet.chunks ? planet.chunks[cx+","+cy] : null));
  const randomChunkFn = (typeof randomChunk === "function") ? randomChunk : ((pred) => {
    if (!planet || !planet.chunks) return null;
    const keys = Object.keys(planet.chunks);
    if (!keys.length) return null;
    // try random sampling
    for (let i=0;i<60;i++){
      const k = keys[Math.floor(Math.random()*keys.length)];
      const c = planet.chunks[k];
      try { if (!pred || pred(c)) return c; } catch(e){}
    }
    for (let i=0;i<keys.length;i++){
      const c = planet.chunks[keys[i]];
      try { if (!pred || pred(c)) return c; } catch(e){}
    }
    return null;
  });
  const circleChunksFn = (typeof circleChunks === "function") ? circleChunks : ((cx,cy,r) => {
    const out=[];
    for (let dx=-r; dx<=r; dx++){
      for (let dy=-r; dy<=r; dy++){
        if (Math.abs(dx)+Math.abs(dy) <= r) out.push({x:cx+dx, y:cy+dy});
      }
    }
    return out;
  });

  function chunkKeyFromTown(t){
    if (!t) return null;
    if (typeof t.cx === "number" && typeof t.cy === "number") return t.cx + "," + t.cy;
    if (typeof t.x === "number" && typeof t.y === "number") {
      if (typeof coordsToChunk === "function") {
        try { const v = coordsToChunk(t.x, t.y); if (v) return v; } catch(e){}
      }
      const cs = window.chunkSize || 16;
      return (Math.floor(t.x / cs)) + "," + (Math.floor(t.y / cs));
    }
    return null;
  }

  function townsInChunksList(chunksArray){
    const set = {};
    chunksArray.forEach(c=> set[c[0]+","+c[1]] = true);
    const towns = getAllTowns();
    return towns.filter(t => {
      const k = chunkKeyFromTown(t);
      return k && set[k];
    });
  }

  function buildChunks(cx,cy,r){
    return circleChunksFn(cx,cy,r).map(c => [c.x,c.y]);
  }

  // mark chunks radioactively (metadata only)
  function markChunksRadioactiveSafely(chunks){
    try {
      for (let i=0;i<chunks.length;i++){
        const key = chunks[i][0] + "," + chunks[i][1];
        const ch = planet && planet.chunks ? planet.chunks[key] : null;
        if (ch) {
          ch._radioactive = true;
          if (!ch._orig_b) ch._orig_b = ch.b;
          if (Array.isArray(ch.pixels)) ch.pixels.forEach(px => px._radioactive = true);
        }
      }
    } catch(e){ console.error("markChunksRadioactiveSafely error", e); }
  }

  // mark alien hole
  function markAlienHole(chunks){
    try {
      for (let i=0;i<chunks.length;i++){
        const key = chunks[i][0] + "," + chunks[i][1];
        const ch = planet && planet.chunks ? planet.chunks[key] : null;
        if (ch) {
          ch._alien_hole = true;
          if (Array.isArray(ch.pixels)) ch.pixels.forEach(px => px._alien_hole = true);
        }
      }
    } catch(e){ console.error("markAlienHole", e); }
  }

  // shrink town area and lower pop safely
  function shrinkTownAreaSafely(town, factor = 0.5) {
    if (!town) return;
    const props = ["area","size","radius","influence","reach","territory"];
    for (let i=0;i<props.length;i++){
      const p = props[i];
      if (typeof town[p] === "number") town[p] = Math.max(0, town[p] * factor);
    }
    town._areaScale = (town._areaScale || 1) * factor;
    if (typeof town.pop === "number"){
      const reduce = Math.floor(town.pop * (1 - factor) * 0.9) + Math.floor(town.pop * 0.02);
      try {
        if (typeof happen === "function") happen("Death", {reg:"player",id:1}, town, {count: reduce});
        else town.pop = Math.max(0, town.pop - reduce);
      } catch(e){ town.pop = Math.max(0, town.pop - reduce); }
    }
    town._areaShrunk = true;
  }

  // ensure spawn multiplier setting exists
  if (typeof userSettings !== 'undefined') {
    if (userSettings.disasters_spawn_rate === undefined) {
      // multiplier options: 0.5 (Low), 1 (Normal), 2 (High), 4 (Extreme)
      userSettings.disasters_spawn_rate = 1;
      try { if (typeof saveSettings === "function") saveSettings(); } catch(e){}
    }
  } else {
    window.userSettings = { disasters_spawn_rate: 1 };
  }
  function getSpawnMultiplier(){
    try {
      return Number(userSettings.disasters_spawn_rate) || 1;
    } catch(e){ return 1; }
  }

  // create process via engine and ensure immediate name/location logging
  function createProcessAndLog(opts){
    // opts: {x,y,chunks,subtype,duration,scale,name,town}
    try {
      const created = happen("Create", null, null, {
        x: opts.x,
        y: opts.y,
        chunks: opts.chunks || [],
        type: "disaster",
        subtype: opts.subtype,
        duration: opts.duration || 1
      }, "process");
      if (!created) return null;
      if (opts.name) created.name = opts.name;
      if (opts.scale) created.scale = opts.scale;
      if (!created.locationDesc){
        let loc = null;
        if (opts.town){
          try {
            const all = getAllTowns();
            const tt = all.find(x => x.id === opts.town);
            if (tt) loc = tt.name || ("{{regname:town|" + tt.id + "}}");
          } catch(e){}
        }
        if (!loc && Array.isArray(created.chunks) && created.chunks.length){
          const towns = townsInChunksList(created.chunks);
          if (towns && towns.length) loc = towns[0].name || ("{{regname:town|" + towns[0].id + "}}");
        }
        if (!loc){
          if (Array.isArray(created.chunks) && created.chunks.length) loc = `(${created.chunks[0][0]},${created.chunks[0][1]})`;
          else loc = "the land";
        }
        created.locationDesc = loc;
      }
      const subtype = created.subtype || opts.subtype || "";
      const name = created.name || subtype;
      let msg = "";
      if (subtype === "volcano") msg = `${name} erupts on ${created.locationDesc}.`;
      else if (subtype === "tornado") msg = `${name} touches down on ${created.locationDesc}.`;
      else if (subtype === "tsunami") msg = `${name} hits the coast at ${created.locationDesc}.`;
      else if (subtype === "meteor") msg = `${name} impacts near ${created.locationDesc}.`;
      else if (subtype === "solar_flare") msg = `${name} streaks across the skies.`;
      else if (subtype === "sandstorm") msg = `${name} scours ${created.locationDesc}.`;
      else if (subtype === "nuke") msg = `${name} detonates near ${created.locationDesc}. A large area will become radioactive for some time.`;
      else if (subtype === "alien_laser") msg = `${name} blasts ${created.locationDesc}. A permanent hole remains.`;
      else msg = `${name} occurs at ${created.locationDesc}.`;
      safeLog(msg);
      return created;
    } catch (e){
      console.error("createProcessAndLog error", e);
      return null;
    }
  }

  // ----- Movement manager for moving storms -----
  // We'll keep a global list of moving processes (store process id keys)
  window._disasterMovers = window._disasterMovers || {}; // id -> {procId, subtype, speed, bounds, behavior}

  // master mover tick: daily, moves each registered process a bit
  (function ensureMoverTick(){
    const tickId = "Disasters_master_mover_daily";
    // register only once
    if (window.__disasters_mover_registered) return;
    Mod.event(tickId, {
      daily: true,
      subject: { reg: "player", id: 1 },
      func: (subject, target, args) => {
        try {
          const procs = (typeof regFilter === "function") ? regFilter("process", p => p.type === "disaster") : (planet && planet.processes ? planet.processes : []);
          if (!procs || !procs.length) return;
          const moverKeys = Object.keys(window._disasterMovers || {});
          moverKeys.forEach(k => {
            const m = window._disasterMovers[k];
            if (!m || !m.procId) return;
            const proc = procs.find(p => p && (p.__id === m.procId || p.id === m.procId || p._id === m.procId || p._uid === m.procId));
            if (!proc) {
              // try regGet if available
              try { if (typeof regGet === "function") proc = regGet("process", m.procId); } catch(e){}
              if (!proc) return;
            }
            // only move if process still active (no .done)
            if (proc.done) return;
            // movement behavior per subtype
            if (m.subtype === "thunderstorm" || m.subtype === "blizzard" || m.subtype === "sandstorm") {
              // move chunks in direction vector or random walk
              const currentChunks = Array.isArray(proc.chunks) ? proc.chunks.slice() : [];
              if (!currentChunks.length) return;
              // pick a representative chunk center (use first)
              const c0 = currentChunks[0];
              let cx = c0[0], cy = c0[1];
              // attempt random step up/down/left/right with small bias
              const step = m.speed || 1;
              const dx = _choose([-step,0,step]);
              const dy = (dx === 0) ? _choose([-step,0,step]) : _choose([-step,0,step]);
              const newCx = cx + dx;
              const newCy = cy + dy;
              // Build new chunk cluster for the storm: try to stay within same biome for sandstorm; for thunderstorm prefer land
              const newChunks = [];
              const radius = Math.max(1, Math.floor(currentChunks.length / 2));
              const candidates = buildChunks(newCx, newCy, radius);
              // for sandstorm ensure desert chunks only
              if (m.subtype === "sandstorm") {
                for (let i=0;i<candidates.length;i++){
                  const ch = chunkAtFn(candidates[i][0], candidates[i][1]);
                  if (ch && ch.b && String(ch.b).toLowerCase().includes("desert")) newChunks.push(candidates[i]);
                }
                if (!newChunks.length) {
                  // fallback: try keep within previous chunks
                  currentChunks.forEach(cc => { const ch = chunkAtFn(cc[0],cc[1]); if (ch && ch.b && String(ch.b).toLowerCase().includes("desert")) newChunks.push(cc); });
                }
              } else {
                // thunderstorm may cross biomes; include candidate chunks
                for (let i=0;i<candidates.length;i++){
                  const ch = chunkAtFn(candidates[i][0], candidates[i][1]);
                  if (!ch) continue;
                  // prefer land/near-water mix
                  newChunks.push(candidates[i]);
                }
              }
              if (!newChunks.length) {
                // fallback: small random walk within current
                for (let i=0;i<currentChunks.length;i++){
                  const c = currentChunks[i];
                  const nx = c[0] + _choose([-1,0,1]);
                  const ny = c[1] + _choose([-1,0,1]);
                  newChunks.push([nx,ny]);
                  if (newChunks.length >= currentChunks.length) break;
                }
              }
              // set new chunks on proc (engine reads proc.chunks)
              proc.chunks = newChunks;
              // update locationDesc to nearest town if present
              const towns = townsInChunksList(newChunks);
              if (towns && towns.length) proc.locationDesc = towns[0].name || proc.locationDesc;
            }
            // solar/jagged or other moving logic could be added here in future
          });
        } catch(e){
          console.error("Disasters mover tick error:", e);
        }
      }
    });
    window.__disasters_mover_registered = true;
  })();

  // ----- Helpers to find special chunks/towns -----
  function findCoastalTownChunk(){
    const towns = getAllTowns();
    for (let i=0;i<towns.length;i++){
      const t = towns[i];
      const k = chunkKeyFromTown(t);
      if (!k) continue;
      const [cx,cy] = k.split(",").map(Number);
      const neighbors = circleChunksFn(cx,cy,2);
      for (let j=0;j<neighbors.length;j++){
        const ch = chunkAtFn(neighbors[j].x, neighbors[j].y);
        if (ch && ch.b && String(ch.b).toLowerCase().includes("water")) {
          return {town: t, cx, cy};
        }
      }
    }
    const c = randomChunkFn(c => c && c.b && String(c.b).toLowerCase().includes("water"));
    if (c) return {town:null, cx:c.x, cy:c.y};
    return null;
  }

  function findMountainTownChunk(){
    const towns = getAllTowns();
    for (let i=0;i<towns.length;i++){
      const t = towns[i];
      const k = chunkKeyFromTown(t);
      if (!k) continue;
      const [cx,cy] = k.split(",").map(Number);
      const ch = chunkAtFn(cx,cy);
      if (ch && ch.b && String(ch.b).toLowerCase().includes("mount")) return {town: t, cx, cy};
    }
    const c = randomChunkFn(c => c && c.b && String(c.b).toLowerCase().includes("mount"));
    if (c) return {town:null, cx:c.x, cy:c.y};
    return null;
  }

  function findDesertChunk(){
    const towns = getAllTowns();
    for (let i=0;i<towns.length;i++){
      const t = towns[i];
      const k = chunkKeyFromTown(t);
      if (!k) continue;
      const [cx,cy] = k.split(",").map(Number);
      const ch = chunkAtFn(cx,cy);
      if (ch && ch.b && String(ch.b).toLowerCase().includes("desert")) return {town: t, cx, cy};
    }
    const c = randomChunkFn(c => c && c.b && String(c.b).toLowerCase().includes("desert"));
    if (c) return {town:null, cx:c.x, cy:c.y};
    return null;
  }

  // Coastal-strip generator for tsunami (no big inland circle)
  function buildCoastalStrip(cx,cy,length){
    const strip = [];
    // find candidate land chunks adjacent to water near center
    const neighborhood = circleChunksFn(cx,cy,4);
    const candidates = [];
    for (let i=0;i<neighborhood.length;i++){
      const c = neighborhood[i];
      const ch = chunkAtFn(c.x,c.y);
      if (!ch) continue;
      const isLand = !(ch.b && String(ch.b).toLowerCase().includes("water"));
      if (!isLand) continue;
      const neigh = circleChunksFn(c.x,c.y,1);
      let bordersWater = false;
      for (let j=0;j<neigh.length;j++){
        const n = chunkAtFn(neigh[j].x, neigh[j].y);
        if (n && n.b && String(n.b).toLowerCase().includes("water")) { bordersWater = true; break; }
      }
      if (bordersWater) candidates.push({x:c.x,y:c.y});
    }
    if (!candidates.length) return buildChunks(cx,cy,2);
    let current = _choose(candidates);
    strip.push([current.x,current.y]);
    const used = {}; used[current.x+","+current.y] = true;
    for (let s=1; s<length; s++){
      const neigh = candidates.filter(c => !used[c.x+","+c.y] && Math.abs(c.x - current.x) + Math.abs(c.y - current.y) <= 2);
      if (!neigh.length) break;
      current = _choose(neigh);
      strip.push([current.x,current.y]);
      used[current.x+","+current.y] = true;
    }
    if (strip.length < length){
      const remaining = candidates.filter(c => !used[c.x+","+c.y]);
      while (strip.length < length && remaining.length){
        const v = remaining.shift();
        strip.push([v.x,v.y]);
      }
    }
    return strip;
  }

  // Solar jagged pattern: random walk patches
  function buildSolarJagged(cx,cy,steps,patchRadius){
    const chunks = [];
    let x = cx, y = cy;
    for (let i=0;i<steps;i++){
      const patch = circleChunksFn(x,y,patchRadius);
      for (let p=0;p<patch.length;p++) chunks.push([patch[p].x, patch[p].y]);
      x += _randInt(-patchRadius-1, patchRadius+1);
      y += _randInt(-patchRadius-1, patchRadius+1);
      if (window.planet && typeof planet.width === "number" && typeof planet.height === "number"){
        x = clamp(x, 0, Math.max(0, Math.floor(planet.width/(window.chunkSize||16))-1));
        y = clamp(y, 0, Math.max(0, Math.floor(planet.height/(window.chunkSize||16))-1));
      }
    }
    const set = {}; const out = [];
    for (let i=0;i<chunks.length;i++){ const k = chunks[i][0]+","+chunks[i][1]; if (!set[k]) { set[k]=true; out.push(chunks[i]); } }
    return out;
  }

  // ----- Add/Ensure subtype metadata in engine (if present) -----
  waitFor(() => (window.actionables && actionables.process && actionables.process._disasterSubtypes !== undefined), () => {
    try {
      const sub = actionables.process._disasterSubtypes;
      // helper name generator
      function naturalName(prefix){
        const parts = ["Ibert","Alder","Kess","Voss","Anode","Rhett","Marun","Solen","Zahir","Galen","Vesta","Rook","Iona","Iver","Bryn","Ilya"];
        return prefix + " " + _choose(parts);
      }

      // tornado w/ EF labels & friendly names
      sub["tornado"] = Object.assign(sub["tornado"] || {}, {
        location: "land",
        radius: 2,
        message: "[NAME] touches down $.",
        messageDone: "[NAME] $ dissipates.",
        color: [200,140,30],
        name: (d) => {
          try { if (d && d.scale) return `${d.name || "Tornado"} (${d.scale})`; } catch(e){}
          return d && d.name ? d.name : "Tornado";
        },
        deathRate: 0.6,
        destroy: true,
        spread: 1,
        duration: 1,
        scale: ["EF0","EF1","EF2","EF3","EF4","EF5"]
      });

      // thunderstorm / blizzard
      sub["thunderstorm"] = Object.assign(sub["thunderstorm"] || {}, {
        location: "any",
        radius: 3,
        message: "[NAME] batters $.",
        messageDone: "[NAME] $ wanes.",
        color: [90,110,210],
        name: (d) => {
          try {
            const c = chunkAtFn(d.x,d.y);
            const biome = c && c.b ? String(c.b).toLowerCase() : "";
            if (biome.includes("snow")) return "Blizzard " + naturalName("");
          } catch(e){}
          return "Thunderstorm " + naturalName("");
        },
        deathRate: 0.25,
        destroy: false,
        spread: 1,
        duration: 3 // default longer
      });

      // tsunami (coastal strip, no user-visible scale)
      sub["tsunami"] = Object.assign(sub["tsunami"] || {}, {
        location: "shore",
        radius: 5,
        message: "[NAME] pounds the coast $.",
        messageDone: "[NAME] $ recedes.",
        color: [20,100,200],
        name: (d) => "Tsunami",
        deathRate: 0.6,
        destroy: true,
        spread: 2,
        duration: 2
      });

      // sandstorm
      sub["sandstorm"] = Object.assign(sub["sandstorm"] || {}, {
        location: "desert",
        radius: 3,
        message: "[NAME] scours $.",
        messageDone: "[NAME] $ settles.",
        color: [210,170,70],
        name: (d) => d && d.name ? d.name : naturalName("Sandstorm"),
        deathRate: 0.12,
        destroy: false,
        spread: 1,
        duration: 3
      });

      // volcano, meteor, solar, nuke, alien_laser
      sub["volcano"] = Object.assign(sub["volcano"] || {}, {
        location: "mountain",
        radius: 3,
        scale: ["1","2","3","4","5","6","7","8","9","10"],
        message: "[NAME] erupts $.",
        messageDone: "[NAME] $ quiets.",
        color: [200,90,20],
        name: (d) => d && d.name ? d.name : naturalName("Mount"),
        deathRate: 1.0,
        destroy: true,
        spread: 1,
        duration: 2
      });

      sub["meteor"] = Object.assign(sub["meteor"] || {}, {
        location: "any",
        radius: 2,
        message: "[NAME] impacts $.",
        messageDone: "[NAME] $ scorches the land.",
        color: [180,80,40],
        name: (d) => d && d.name ? d.name : naturalName("Meteor"),
        deathRate: 1.5,
        destroy: true,
        duration: 1
      });

      sub["solar_flare"] = Object.assign(sub["solar_flare"] || {}, {
        location: "any",
        radius: 0,
        message: "[NAME] washes the world $.",
        messageDone: "[NAME] $ fades.",
        color: [255,220,120],
        name: (d) => "Solar Flare",
        deathRate: 0.005,
        destroy: false,
        spread: 0,
        duration: 12
      });

      sub["nuke"] = Object.assign(sub["nuke"] || {}, {
        location: "any",
        radius: 8,
        message: "[NAME] detonates $.",
        messageDone: "[NAME] $ ends — area remains contaminated.",
        color: [80,200,50],
        name: (d) => d && d.name ? d.name : "Nuclear Detonation",
        deathRate: 2.0,
        destroy: true,
        duration: 50
      });

      sub["alien_laser"] = Object.assign(sub["alien_laser"] || {}, {
        location: "any",
        radius: 2,
        message: "[NAME] blasts $.",
        messageDone: "[NAME] $ leaves a permanent void.",
        color: [150,20,200],
        name: (d) => d && d.name ? d.name : naturalName("Alien Strike"),
        deathRate: 5.0,
        destroy: true,
        duration: 999999
      });

      console.log("Disasters: subtypes ensured/updated.");
    } catch (e){ console.error("Disasters subtype injection error:", e); }

    // ----- Spawners -----
    // Common spawn gate: use userSettings multiplier to gate spawns in each event
    function spawnGate( baseChance ) {
      const mult = getSpawnMultiplier();
      // baseChance used as probability per-event call (0..1)
      return Math.random() < clamp(baseChance * mult, 0, 0.99);
    }

    // Volcano (mountain-only)
    Mod.event("dis_spawn_volcano", { random:true, weight:0.45, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.18)) return;
        const found = findMountainTownChunk(); if (!found) return;
        const scale = _randInt(2,9);
        const dur = Math.max(1, Math.ceil(scale/4));
        const chunks = buildChunks(found.cx,found.cy, 3 + Math.floor(scale/4));
        const name = "Mount " + uid("V");
        const created = createProcessAndLog({x:found.cx,y:found.cy,chunks,subtype:"volcano",duration:dur,scale,name, town:(found.town?found.town.id:null)});
        if (created) created.scale = scale;
        return `${created.name} erupts on ${created.locationDesc}.`;
      }
    });

    // Tornado (EF scale)
    Mod.event("dis_spawn_tornado", { random:true, weight:0.95, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.25)) return;
        const towns = getAllTowns(); if (!towns.length) return;
        const center = _choose(towns);
        const ck = chunkKeyFromTown(center); if (!ck) return;
        const [cx,cy] = ck.split(",").map(Number);
        const ef = _choose(["EF0","EF1","EF2","EF3","EF4","EF5"]);
        const dur = clamp(_randInt(1,3),1,3);
        const radius = ef === "EF0" ? 1 : (ef === "EF1" ? 1 : (ef === "EF2" ? 2 : 3));
        const chunks = buildChunks(cx,cy,radius); if (!chunks.length) chunks.push([cx,cy]);
        const name = `${naturalName("Gale")} (${ef})`;
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"tornado",duration:dur,scale:ef,name, town:center.id});
        if (created) created.scale = ef;
        return `${name} touches down near ${created.locationDesc}.`;
      }
    });

    // Tsunami (coastal strip) - no scale shown
    Mod.event("dis_spawn_tsunami", { random:true, weight:0.62, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.12)) return;
        const found = findCoastalTownChunk(); if (!found) return;
        const length = clamp(_randInt(2,5),2,5);
        const strip = buildCoastalStrip(found.cx, found.cy, length);
        if (!strip.length) return;
        const created = createProcessAndLog({x:found.cx,y:found.cy,chunks:strip,subtype:"tsunami",duration:2,name:"Tsunami", town:(found.town?found.town.id:null)});
        return `Tsunami pounds the coast near ${created.locationDesc}.`;
      }
    });

    // Thunderstorm / Blizzard: last longer and move each day
    Mod.event("dis_spawn_thunderstorm", { random:true, weight:0.9, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.35)) return;
        const towns = getAllTowns(); if (!towns.length) return;
        const center = _choose(towns);
        const ck = chunkKeyFromTown(center); if (!ck) return;
        const [cx,cy] = ck.split(",").map(Number);
        const isSnow = (chunkAtFn(cx,cy) && String(chunkAtFn(cx,cy).b || "").toLowerCase().includes("snow")) ||
                       (center && (center.biome && String(center.biome).toLowerCase().includes("snow")));
        const dur = isSnow ? clamp(_randInt(3,6),3,6) : clamp(_randInt(3,5),3,5);
        const chunks = buildChunks(cx,cy, 2 + (isSnow ? 1 : 0));
        const name = isSnow ? ("Blizzard " + uid("B")) : ("Thunderstorm " + uid("T"));
        const subtype = isSnow ? "blizzard" : "thunderstorm";
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"thunderstorm",duration:dur,name, town:center.id});
        // register mover entry so master mover moves it (subtype uses 'thunderstorm' key)
        const procId = created && (created.__id || created.id || created._id || created._uid) ? (created.__id || created.id || created._id || created._uid) : uid("proc");
        // store mover data keyed by procId
        window._disasterMovers[procId] = { procId: procId, subtype: subtype, speed: 1 };
        // attempt to also attach procId to process object for lookup (best-effort)
        if (created) { created.__id = procId; }
        return `${name} moves into the region near ${created.locationDesc}.`;
      }
    });

    // Sandstorm: desert-only, longer and moving
    Mod.event("dis_spawn_sandstorm", { random:true, weight:0.7, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.25)) return;
        const f = findDesertChunk(); if (!f) return;
        const dur = clamp(_randInt(2,5),2,5);
        const chunks = buildChunks(f.cx,f.cy,2);
        const name = "Sandstorm " + uid("S");
        const created = createProcessAndLog({x:f.cx,y:f.cy,chunks,subtype:"sandstorm",duration:dur,name, town:(f.town?f.town.id:null)});
        const procId = created && (created.__id || created.id || created._id || created._uid) ? (created.__id || created.id || created._id || created._uid) : uid("proc");
        window._disasterMovers[procId] = { procId: procId, subtype: "sandstorm", speed: 1 };
        if (created) created.__id = procId;
        return `${created.name} sweeps across ${created.locationDesc} for ${dur} day(s).`;
      }
    });

    // Meteor
    Mod.event("dis_spawn_meteor", { random:true, weight:0.22, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.06)) return;
        const towns = getAllTowns();
        const pickTown = towns && towns.length ? _choose(towns) : null;
        let cx,cy;
        if (pickTown) {
          const ck = chunkKeyFromTown(pickTown);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        }
        if (cx === undefined) { const c = randomChunkFn(()=>true); if (!c) return; cx=c.x; cy=c.y; }
        const scale = _randInt(3,10);
        const instant = Math.random() < 0.35;
        const dur = instant ? 1 : _randInt(1,3);
        const chunks = buildChunks(cx,cy, instant?1: (2 + Math.floor(scale/6)));
        const name = "Meteor " + uid("M");
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"meteor",duration:dur,scale,name, town:(pickTown?pickTown.id:null)});
        if (created) created.instant = instant;
        return `${created.name} impacts near ${created.locationDesc}.`;
      }
    });

    // Solar flare: jagged & long & less deadly
    Mod.event("dis_spawn_solar", { random:true, weight:0.16, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.04)) return;
        const towns = getAllTowns();
        let centerTown = towns && towns.length ? _choose(towns) : null;
        let cx=0, cy=0;
        if (centerTown) {
          const ck = chunkKeyFromTown(centerTown);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        } else {
          const c = randomChunkFn(()=>true);
          if (!c) return;
          cx=c.x; cy=c.y;
        }
        const steps = _randInt(6,14);
        const patchRadius = _randInt(0,2);
        const chunks = buildSolarJagged(cx,cy,steps,patchRadius);
        if (!chunks.length) return;
        const dur = _randInt(10,25);
        const name = "Solar Flare " + uid("SF");
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"solar_flare",duration:dur,scale:null,name, town:(centerTown?centerTown.id:null)});
        return `${created.name} streaks across the skies for ${dur} day(s).`;
      }
    });

    // Nuke (no UI button) - duration 50 days
    Mod.event("dis_spawn_nuke", { random:true, weight:0.10, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.02)) return;
        const towns = getAllTowns();
        const pick = towns && towns.length ? _choose(towns) : null;
        let cx,cy;
        if (pick) {
          const ck = chunkKeyFromTown(pick);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        }
        if (cx === undefined) { const c = randomChunkFn(()=>true); if (!c) return; cx=c.x; cy=c.y; }
        const radius = 8;
        const chunks = buildChunks(cx,cy,radius);
        const name = "Nuclear Device " + uid("N");
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"nuke",duration:50,name, town:(pick?pick.id:null)});
        markChunksRadioactiveSafely(chunks);
        const affected = townsInChunksList(chunks);
        affected.forEach(tt => shrinkTownAreaSafely(tt, 0.25));
        return `${name} detonated near ${created.locationDesc}.`;
      }
    });

    // Alien laser (rarest) permanent hole
    Mod.event("dis_spawn_alien_laser", { random:true, weight:0.04, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (!spawnGate(0.01)) return;
        const towns = getAllTowns();
        const pickTown = towns && towns.length ? _choose(towns) : null;
        let cx,cy;
        if (pickTown) {
          const ck = chunkKeyFromTown(pickTown);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        }
        if (cx === undefined) { const c = randomChunkFn(()=>true); if (!c) return; cx=c.x; cy=c.y; }
        const holeRadius = 3;
        const chunks = buildChunks(cx,cy,holeRadius);
        const name = "Alien Strike " + uid("AL");
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"alien_laser",duration:999999,name, town:(pickTown?pickTown.id:null)});
        const affectedTowns = townsInChunksList(chunks);
        affectedTowns.forEach(tt => {
          try {
            const killCount = Math.ceil((tt.pop||0) * 0.95) + 5;
            if (typeof happen === "function") happen("Death", {reg:"player",id:1}, tt, {count: killCount});
            else tt.pop = Math.max(0, (tt.pop||0) - killCount);
          } catch(e){ tt.pop = Math.max(0, (tt.pop||0) - (Math.ceil((tt.pop||0) * 0.95) + 5)); }
          shrinkTownAreaSafely(tt, 0.2);
          tt._killedByAlien = true;
        });
        markAlienHole(chunks);
        return `${created.name} blasts a permanent hole at ${created.locationDesc}.`;
      }
    });

    // ----- Expose console helper -----
    window.NaturalDisasters = window.NaturalDisasters || {};
    window.NaturalDisasters.spawn = function(type){
      try {
        if (!type) return null;
        const towns = getAllTowns();
        const pick = towns && towns.length ? _choose(towns) : null;
        let cx,cy;
        if (pick) {
          const ck = chunkKeyFromTown(pick);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        }
        if (cx === undefined) {
          const c = randomChunkFn(()=>true);
          if (!c) return null;
          cx = c.x; cy = c.y;
        }
        const radiusMap = { volcano:3, tornado:2, tsunami:5, meteor:2, sandstorm:2, nuke:8, solar_flare:0, alien_laser:3, thunderstorm:2 };
        const chunks = buildChunks(cx,cy, radiusMap[type] || 2);
        const name = (type==="nuke") ? ("Manual Nuke " + uid("N")) : (type.charAt(0).toUpperCase()+type.slice(1)+" "+uid(""));
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:type,duration:(type==="nuke"?50: Math.max(1,Math.ceil(Math.random()*3))), name, town:(pick?pick.id:null)});
        if (type === "nuke") {
          markChunksRadioactiveSafely(chunks);
          const affected = townsInChunksList(chunks);
          affected.forEach(tt => shrinkTownAreaSafely(tt, 0.25));
        } else if (type === "alien_laser") {
          const affected = townsInChunksList(chunks);
          affected.forEach(tt => {
            try { const kill = Math.ceil((tt.pop||0) * 0.95) + 5; if (typeof happen === "function") happen("Death", {reg:"player",id:1}, tt, {count:kill}); else tt.pop = Math.max(0, (tt.pop||0) - kill); } catch(e){}
            shrinkTownAreaSafely(tt, 0.2);
            tt._killedByAlien = true;
          });
          for (let i=0;i<chunks.length;i++){ const key = chunks[i][0]+","+chunks[i][1]; const ch = planet && planet.chunks ? planet.chunks[key] : null; if (ch) { ch._alien_hole = true; if (Array.isArray(ch.pixels)) ch.pixels.forEach(px=>px._alien_hole=true); } }
        }
        // register mover for storms
        if (type === "thunderstorm" || type === "blizzard" || type === "sandstorm") {
          const procId = created && (created.__id || created.id || created._id || created._uid) ? (created.__id || created.id || created._id || created._uid) : uid("proc");
          window._disasterMovers[procId] = { procId: procId, subtype: type, speed: 1 };
          if (created) created.__id = procId;
        }
        return created;
      } catch(e){ console.error("NaturalDisasters.spawn err", e); return null; }
    };

    // ----- Settings UI: add an executive button to tweak spawn rate (Low/Normal/High/Extreme) -----
    function addSettingsButton(){
      try {
        if (window.$wt && typeof $wt.addExecutiveButton === "function" && typeof populateExecutive === "function"){
          const btn = $wt.addExecutiveButton(false, false, "Disasters", "actionDisasters", document.querySelector('#actionMain').querySelector('div:not(#actionMainList)').firstElementChild);
          btn.addEventListener('click', () => {
            // open a small executive with spawn rate selector
            const options = {
              text: "Disaster spawn rate",
              setting: "disasters_spawn_rate",
              options: { "0.5": "Low", "1": "Normal", "2": "High", "4": "Extreme" },
              default: "1"
            };
            populateExecutive([options], "Disasters");
          });
          return;
        }
      } catch(e){}
      // fallback: minimal DOM button
      try {
        const side = document.querySelector("#actionMain");
        if (!side) return;
        const wrapper = document.createElement("div");
        wrapper.style.padding = "6px";
        const button = document.createElement("button");
        button.textContent = "Disasters";
        button.style.padding = "6px 10px";
        button.onclick = () => {
          const cur = String(userSettings.disasters_spawn_rate || 1);
          const pick = prompt("Set spawn rate (0.5=Low,1=Normal,2=High,4=Extreme)", cur);
          if (pick === null) return;
          const num = Number(pick);
          if (isNaN(num)) return alert("Invalid number");
          userSettings.disasters_spawn_rate = num;
          try { if (typeof saveSettings === "function") saveSettings(); } catch(e){}
          alert("Disaster spawn rate set to " + num);
        };
        wrapper.appendChild(button);
        side.appendChild(wrapper);
      } catch(e){}
    }

    // add settings UI once UI exists (safe delayed)
    setTimeout(addSettingsButton, 1000);

    // final load message
    safeLog("Disasters mod enabled");

  }); // end waitFor(actionables)
})();
