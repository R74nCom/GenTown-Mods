// disasters.js


(function(){
  const MOD_ID = "Disasters";
  try { if (window.$wt && $wt.modsLoaded && $wt.modsLoaded.includes(MOD_ID)) return; } catch(e){}
  try { if (window.$wt && $wt.modsLoaded) $wt.modsLoaded.push(MOD_ID); } catch(e){}

  // ---------- Safe utilities ----------
  function safeLog(msg){
    try { if (typeof logMessage === "function") { logMessage(msg); return; } } catch(e){}
    try { if (window.$wt && $wt.notify) { $wt.notify(msg); return; } } catch(e){}
    console.log(msg);
  }
  function uid(pref){ return (pref||"id")+"_"+Math.floor(Math.random()*1e9).toString(36); }
  function choose(arr){ return (arr && arr.length) ? arr[Math.floor(Math.random()*arr.length)] : null; }
  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // Wait helper: ensures actionables/etc exist
  function waitFor(predicate, cb, timeout=20000){
    const start = Date.now();
    (function tick(){
      try { if (predicate()) return cb(); } catch(e){}
      if (Date.now() - start > timeout) { console.warn("Disasters: waitFor timed out"); return; }
      setTimeout(tick, 50);
    })();
  }

  // Towns / chunks helpers with fallbacks (defensive)
  function getAllTowns(){
    try {
      if (typeof regFilter === "function") {
        try { const t = regFilter("town", ()=>true); if (Array.isArray(t)) return t; } catch(e){}
      }
    } catch(e){}
    if (window.regs && Array.isArray(window.regs.town)) return window.regs.town;
    if (window.towns && Array.isArray(towns)) return towns;
    if (window.planet && Array.isArray(planet.towns)) return planet.towns;
    return [];
  }

  const chunkAtFn = (typeof chunkAt === "function") ? chunkAt : ((cx,cy) => {
    if (!planet || !planet.chunks) return null;
    return planet.chunks[cx + "," + cy] || null;
  });
  const randomChunkFn = (typeof randomChunk === "function") ? randomChunk : ((pred) => {
    if (!planet || !planet.chunks) return null;
    const keys = Object.keys(planet.chunks);
    if (!keys.length) return null;
    for (let i=0;i<60;i++){
      const k = keys[Math.floor(Math.random()*keys.length)];
      const c = planet.chunks[k];
      if (!c) continue;
      try {
        if (pred && !pred(c)) continue;
      } catch(e){ continue; }
      if (typeof c.x === "number" && typeof c.y === "number") return c;
      if (typeof c.cx === "number" && typeof c.cy === "number") return Object.assign({x:c.cx, y:c.cy}, c);
      const parts = k.split(",");
      const px = Number(parts[0]), py = Number(parts[1]);
      if (!Number.isNaN(px) && !Number.isNaN(py)) return Object.assign({x:px, y:py}, c);
    }
    for (let i=0;i<keys.length;i++){
      const c = planet.chunks[keys[i]];
      if (!c) continue;
      try { if (pred && !pred(c)) continue; } catch(e){ continue; }
      if (typeof c.x === "number" && typeof c.y === "number") return c;
      if (typeof c.cx === "number" && typeof c.cy === "number") return Object.assign({x:c.cx, y:c.cy}, c);
    }
    return null;
  });

  const circleChunksFn = (typeof circleChunks === "function") ? circleChunks : ((cx,cy,r)=>{
    const out=[];
    for (let dx=-r; dx<=r; dx++){
      for (let dy=-r; dy<=r; dy++){
        if (Math.abs(dx)+Math.abs(dy) <= r) out.push({x:cx+dx, y:cy+dy});
      }
    }
    return out;
  });

  // normalize chunk key from a town object robustly
  function chunkKeyFromTown(t){
    if (!t) return null;
    if (typeof t.cx === "number" && typeof t.cy === "number") return t.cx + "," + t.cy;
    if (typeof t.x === "number" && typeof t.y === "number") {
      if (typeof coordsToChunk === "function") {
        try {
          const v = coordsToChunk(t.x, t.y);
          if (typeof v === "string") return v;
          if (Array.isArray(v) && v.length >= 2) return v[0] + "," + v[1];
          if (v && typeof v.x === "number" && typeof v.y === "number") return v.x + "," + v.y;
        } catch(e){}
      }
      const cs = Number(window.chunkSize || 16);
      return (Math.floor(t.x / cs)) + "," + (Math.floor(t.y / cs));
    }
    return null;
  }

  function townsInChunksList(chunksArray){
    const set = {};
    chunksArray.forEach(c=>{
      if (!c) return;
      if (Array.isArray(c)) set[c[0]+","+c[1]] = true;
      else if (c.x !== undefined && c.y !== undefined) set[c.x + "," + c.y] = true;
      else if (c[0] !== undefined && c[1] !== undefined) set[c[0] + "," + c[1]] = true;
    });
    const towns = getAllTowns();
    return towns.filter(t => {
      const k = chunkKeyFromTown(t);
      return k && set[k];
    });
  }

  function buildChunks(cx,cy,r){
    return circleChunksFn(cx,cy,r).map(c => [c.x,c.y]);
  }

  // metadata marking helpers (never overwrite chunk.b)
  function markChunksRadioactiveSafely(chunks, days){
    try {
      for (let i=0;i<chunks.length;i++){
        const key = chunks[i][0] + "," + chunks[i][1];
        const ch = planet && planet.chunks ? planet.chunks[key] : null;
        if (ch) {
          ch._radioactive = true;
          if (ch._orig_b === undefined) ch._orig_b = ch.b;
          ch._radio_days = Math.max(0, Math.floor(days || (ch._radio_days || 0)));
          if (Array.isArray(ch.pixels)) ch.pixels.forEach(px => px._radioactive = true);
        }
      }
    } catch(e){ console.error("markChunksRadioactiveSafely error", e); }
  }
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

  // create disaster process via engine and ensure immediate message and tracking
  function createProcessAndLog(opts){
    // opts: {x,y,chunks,subtype,duration,scale,name,town, noName:false}
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

      // some engines may overwrite chunks; set the chunks again explicitly if provided
      if (Array.isArray(opts.chunks) && opts.chunks.length) {
        try { created.chunks = opts.chunks.slice(); } catch(e){}
      }

      // normalize created.chunks to array of [x,y]
      if (Array.isArray(created.chunks)) {
        created.chunks = created.chunks.map(c => {
          if (!c) return null;
          if (Array.isArray(c)) return [Number(c[0]), Number(c[1])];
          if (c.x !== undefined && c.y !== undefined) return [Number(c.x), Number(c.y)];
          return null;
        }).filter(Boolean);
      }

      // set friendly metadata
      if (opts.name && !opts.noName) created.name = opts.name;
      if (opts.scale) created.scale = opts.scale;
      // set a unique mod uid on the created process so we can track it reliably
      const modUid = uid("disaster");
      created._disaster_mod_uid = modUid;

      // ensure locationDesc is present
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

      // immediate creation message similar to built-ins
      const subtype = created.subtype || opts.subtype || "";
      const name = created.name || (opts.noName ? "" : subtype);
      let message = "";
      if (subtype === "volcano") message = `${name} erupts on ${created.locationDesc}.`;
      else if (subtype === "tornado") message = `${name} touches down on ${created.locationDesc}.`;
      else if (subtype === "tsunami") message = `${name} pounds the coast at ${created.locationDesc}.`;
      else if (subtype === "meteor") message = `${name} impacts near ${created.locationDesc}.`;
      else if (subtype === "solar_flare") message = `${name} streaks across the skies.`;
      else if (subtype === "sandstorm") message = `${name} scours ${created.locationDesc}.`;
      else if (subtype === "nuke") message = `${name} detonates near ${created.locationDesc}. A large area will be radioactive for some time.`;
      else if (subtype === "alien_laser") message = `${name} blasts ${created.locationDesc}. A permanent hole remains.`;
      else if (subtype === "drought") message = `Drought affects ${created.locationDesc}.`;
      else if (subtype === "epidemic") message = `${name || "An epidemic"} begins at ${created.locationDesc}.`;
      else if (subtype === "avalanche") message = `An avalanche buries ${created.locationDesc}.`;
      else message = `${name} occurs at ${created.locationDesc}.`;

      // log through engine or console
      safeLog(message);

      // if opts.noName was requested, ensure name blank
      if (opts.noName && created) created.name = "";

      // return created
      return created;
    } catch (e){
      console.error("createProcessAndLog error", e);
      return null;
    }
  }

  // ----- Moving storms manager + daily effects -----
  window._disasterMovers = window._disasterMovers || {}; // uid -> { uid, subtype, speed, vx, vy }

  // helper: try to find numeric food-like property names on a town and adjust safely
  function adjustTownFoodSafely(town, delta){
    if (!town) return false;
    const names = ["food","prod","production","yield","crops","harvest"];
    for (let i=0;i<names.length;i++){
      const n = names[i];
      if (typeof town[n] === "number"){
        town[n] = Math.max(0, Math.floor(town[n] + delta));
        return true;
      }
    }
    return false;
  }

  // evolve shape slightly to look like clouds moving (conservative)
  function evolveStormShape(proc){
    try {
      if (!proc || !Array.isArray(proc.chunks) || !proc.chunks.length) return;
      proc._shape_seed = proc._shape_seed || (Math.random() * 1000);
      const baseRadius = Math.max(1, Math.round(Math.sqrt(proc.chunks.length)));
      const radiusJitter = choose([-1,0,1]);
      const newRadius = clamp(baseRadius + radiusJitter, 1, baseRadius + 2);
      const current = proc.chunks[0];
      const cx = current ? current[0] + choose([-1,0,1]) : 0;
      const cy = current ? current[1] + choose([-1,0,1]) : 0;
      let candidate = buildChunks(cx, cy, newRadius);
      const keepFrac = 0.6;
      const old = proc.chunks.slice();
      const keepCount = Math.round(old.length * keepFrac);
      const kept = old.slice(0, keepCount);
      const maxTarget = Math.max(1, Math.round(old.length * 1.3));
      const merged = kept.concat(candidate).slice(0, maxTarget);
      const seen = {};
      const out = [];
      for (let i=0;i<merged.length;i++){
        const k = merged[i][0]+","+merged[i][1];
        if (!seen[k]) { seen[k]=true; out.push([merged[i][0], merged[i][1]]); }
      }
      if (out.length) proc.chunks = out;
    } catch(e){ console.error("evolveStormShape error", e); }
  }

  // Enhanced solar jagged (bigger & more randomly scattered)
  function buildSolarJaggedEnhanced(cx,cy,steps,patchRadius){
    const chunks = [];
    let x = cx, y = cy;
    const clusters = Math.max(1, Math.round(steps / (2 + patchRadius)));
    for (let c=0;c<clusters;c++){
      const clusterSteps = Math.max(3, Math.floor(steps / clusters) + randInt(-2,2));
      for (let i=0;i<clusterSteps;i++){
        const patch = circleChunksFn(x,y, patchRadius + randInt(0,2));
        for (let p=0;p<patch.length;p++) {
          const jitterX = patch[p].x + randInt(-1,1);
          const jitterY = patch[p].y + randInt(-1,1);
          chunks.push([jitterX, jitterY]);
        }
        x += randInt(-patchRadius-2, patchRadius+2);
        y += randInt(-patchRadius-2, patchRadius+2);
        if (Math.random() < 0.18) {
          x += randInt(-Math.max(6,steps/4), Math.max(6,steps/4));
          y += randInt(-Math.max(6,steps/4), Math.max(6,steps/4));
        }
        if (window.planet && typeof planet.width === "number" && typeof planet.height === "number"){
          x = clamp(x, 0, Math.max(0, Math.floor(planet.width/(window.chunkSize||16))-1));
          y = clamp(y, 0, Math.max(0, Math.floor(planet.height/(window.chunkSize||16))-1));
        }
      }
      x = cx + randInt(-Math.max(1,clusters), Math.max(1,clusters));
      y = cy + randInt(-Math.max(1,clusters), Math.max(1,clusters));
    }
    const set = {}; const out = [];
    for (let i=0;i<chunks.length;i++){ const k = chunks[i][0]+","+chunks[i][1]; if (!set[k]) { set[k]=true; out.push(chunks[i]); } }
    return out;
  }

  // UI choice helper for epidemic (one-time global). Tries engine confirm then falls back.
  function showEpidemicChoiceOnce(proc){
    try {
      if (!proc) return;
      window.NaturalDisasters = window.NaturalDisasters || {};
      if (window.NaturalDisasters._epidemicChoiceShown) return;
      // pandemic detection: if >=3 towns in area treat as pandemic
      const towns = townsInChunksList(proc.chunks || []);
      if (!towns || towns.length < 3) return; // not pandemic-scale, skip choice

      let title = "Epidemic Research";
      let body = `A large epidemic has begun in ${proc.locationDesc}. Research for a cure now? Choosing YES will help scientists shorten the outbreak to 1-2 days remaining. Choosing NO will let it run longer (and may spread). This choice appears only once.`;
      let confirmed = null;

      try {
        if (window.$wt && $wt.confirm) {
          confirmed = $wt.confirm(title + "\n\n" + body);
        } else if (typeof window.confirm === "function") {
          confirmed = window.confirm(title + "\n\n" + body);
        } else {
          safeLog(title + ": " + body);
          confirmed = false;
        }
      } catch(e){
        try { confirmed = window.confirm(title + "\n\n" + body); } catch(e){ confirmed = false; }
      }

      window.NaturalDisasters._epidemicChoiceShown = true;
      proc._epidemic_choice_shown = true;

      if (confirmed) {
        const days = randInt(1,2);
        proc._epidemic_days = days;
        const affected = townsInChunksList(proc.chunks || []);
        affected.forEach(tt => {
          tt._epidemic_days = Math.min(tt._epidemic_days || days, days);
        });
        safeLog("Research teams accelerated a cure. The epidemic will wind down quickly.");
      } else {
        const extra = randInt(8,16);
        proc._epidemic_days = (proc._epidemic_days || 0) + extra;
        const affected = townsInChunksList(proc.chunks || []);
        affected.forEach(tt => {
          tt._epidemic_days = Math.max(tt._epidemic_days || 0, (tt._epidemic_days || 0) + Math.floor(extra/2));
        });
        safeLog("Research delayed. The epidemic will last significantly longer.");
      }
    } catch(e){ console.error("showEpidemicChoiceOnce error", e); }
  }

  // daily mover tick
  (function ensureMoverTick(){
    const tickId = "Disasters_mover_daily";
    if (window.__disasters_mover_registered) return;
    Mod.event(tickId, {
      daily: true,
      subject: { reg: "player", id: 1 },
      func: (subject, target, args) => {
        try {
          const procs = (typeof regFilter === "function") ? regFilter("process", p => p && p.type === "disaster") : (planet && planet.processes ? planet.processes.filter(p => p && p.type === "disaster") : []);
          if (!procs || !procs.length) { cleanupChunkTimers(); return; }

          const moverKeys = Object.keys(window._disasterMovers || {});
          moverKeys.forEach(k => {
            const m = window._disasterMovers[k];
            if (!m) return;
            const proc = procs.find(p => p && p._disaster_mod_uid === k);
            if (!proc) { delete window._disasterMovers[k]; return; }
            if (proc.done) { delete window._disasterMovers[k]; return; }

            if (m.subtype === "thunderstorm" || m.subtype === "blizzard" || m.subtype === "sandstorm") {
              evolveStormShape(proc);
            }

            if (m.subtype === "thunderstorm" || m.subtype === "blizzard" || m.subtype === "sandstorm" || m.subtype === "tornado") {
              const current = Array.isArray(proc.chunks) && proc.chunks.length ? proc.chunks[0] : null;
              if (!current) return;
              let cx = current[0], cy = current[1];

              if (typeof m.vx !== "number" || typeof m.vy !== "number") {
                m.vx = choose([-1,0,1]) * 0.6;
                m.vy = choose([-1,0,1]) * 0.6;
              }
              m.vx += (Math.random() - 0.5) * 0.4;
              m.vy += (Math.random() - 0.5) * 0.4;
              m.vx = clamp(m.vx, -1.5, 1.5);
              m.vy = clamp(m.vy, -1.5, 1.5);

              const nx = Math.round(cx + m.vx);
              const ny = Math.round(cy + m.vy);

              const baseRadius = Math.max(1, Math.round((proc.chunks && proc.chunks.length) ? Math.sqrt(proc.chunks.length) : 2));
              const radius = clamp(baseRadius + Math.round(Math.sin(Date.now()/60000 + (m.vx+m.vy))*1), 1, baseRadius+2);

              let newChunks = buildChunks(nx, ny, radius);
              if (m.subtype === "sandstorm") {
                const filtered = newChunks.filter(cc => {
                  const ch = chunkAtFn(cc[0], cc[1]);
                  return ch && ch.b && String(ch.b).toLowerCase().includes("desert");
                });
                if (filtered.length) newChunks = filtered;
                else newChunks = proc.chunks.slice();
              }
              proc.chunks = newChunks.length ? newChunks : proc.chunks;

              const towns = townsInChunksList(proc.chunks);
              if (towns && towns.length) proc.locationDesc = towns[0].name || proc.locationDesc;

              if (m.subtype === "thunderstorm" || m.subtype === "blizzard") {
                applyStormMoistureEffect(proc);
              }
            }
          });

          procs.forEach(proc => {
            try { dailyProcessEffects(proc); } catch(e){ console.error("dailyProcessEffects error", e); }
          });

          cleanupChunkTimers();

        } catch (e){
          console.error("Disasters mover tick error:", e);
        }
      }
    });
    window.__disasters_mover_registered = true;
  })();

  // apply a mild crop-helping effect for storms
  function applyStormMoistureEffect(proc){
    if (!proc || !Array.isArray(proc.chunks)) return;
    const towns = townsInChunksList(proc.chunks);
    towns.forEach(tt => {
      try {
        tt._recent_rain_days = (tt._recent_rain_days || 0) + 1;
        if (adjustTownFoodSafely(tt, 1)) {
          tt._crop_boost_applied = (tt._crop_boost_applied || 0) + 1;
        } else {
          if ((tt._recent_rain_days || 0) >= 3 && Math.random() < 0.12) {
            if (typeof tt.pop === "number") tt.pop = Math.max(1, Math.floor(tt.pop + 0.01 * Math.max(1, tt.pop)));
          }
        }
      } catch(e){}
    });
  }

  // daily effects for an individual process
  function dailyProcessEffects(proc){
    if (!proc || !proc.subtype) return;

    // STORMS: no extra daily aside from movement & moisture
    if (proc.subtype === "thunderstorm" || proc.subtype === "blizzard" || proc.subtype === "sandstorm") { return; }

    // NUCLEAR: manage radiation timers and town sickness
    if (proc.subtype === "nuke") {
      if (!proc._radiation_initialized) {
        const radDays = randInt(20,30);
        proc._radiation_days = radDays;
        if (Array.isArray(proc.chunks) && proc.chunks.length) {
          markChunksRadioactiveSafely(proc.chunks, radDays);
        }
        const affected = townsInChunksList(proc.chunks || []);
        affected.forEach(tt => {
          tt._radiation_sick_days = Math.max(tt._radiation_sick_days || 0, randInt(20,30));
          if (Math.random() < 0.25) {
            try {
              if (typeof happen === "function") happen("Death", {reg:"player",id:1}, tt, {count: Math.floor(Math.random()*2)});
              else tt.pop = Math.max(0, (tt.pop||0) - Math.floor(Math.random()*2));
            } catch(e){}
          }
        });
        proc._radiation_initialized = true;
      }
      if (typeof proc._radiation_days === "number") proc._radiation_days = Math.max(0, proc._radiation_days - 1);
      const affected = townsInChunksList(proc.chunks || []);
      affected.forEach(tt => {
        if (tt._radiation_sick_days && tt._radiation_sick_days > 0) {
          if (Math.random() < 0.12) {
            try { if (typeof happen === "function") happen("Death", {reg:"player",id:1}, tt, {count: 1}); else tt.pop = Math.max(0, (tt.pop||0) - 1); } catch(e){}
          }
          tt._radiation_sick_days = Math.max(0, tt._radiation_sick_days - 1);
        }
      });
      if (proc._radiation_days === 0) proc._radiation_finished = true;
      return;
    }

// SOLAR FLARE: improved (hopefully)
if (proc.subtype === "solar_flare") {
  if (!proc._solar_initialized) {
    const solarDays = clamp(proc.duration || randInt(30, 120), 20, 240);
    proc._solar_days = solarDays;

    // ★ EXPAND flare if engine spawned only 1 chunk
    if (Array.isArray(proc.chunks) && proc.chunks.length <= 1) {
      const base = proc.chunks[0] || [proc.x, proc.y];
      const cx = base[0];
      const cy = base[1];

      // long, thin, jagged solar flare
      const steps = randInt(60, 140);
      const patchRadius = randInt(1, 3);
      proc.chunks = buildSolarJagged(cx, cy, steps, patchRadius);
    }

    // mark all affected chunks
    proc.chunks.forEach(c => {
      const key = c[0] + "," + c[1];
      const ch = planet && planet.chunks ? planet.chunks[key] : null;
      if (ch) {
        ch._solar_days = Math.max(ch._solar_days || 0, solarDays);
        ch._solar_affected = true;
      }
    });

    proc._solar_initialized = true;
  }

  // daily decay
  if (typeof proc._solar_days === "number") {
    proc._solar_days = Math.max(0, proc._solar_days - 1);
  }

  // town effects
  const affected = townsInChunksList(proc.chunks || []);
  affected.forEach(tt => {
    const severity = Math.min(0.5, 0.12 + Math.random() * 0.28);
    if (Math.random() < severity) adjustTownFoodSafely(tt, -1);

    const ck = chunkKeyFromTown(tt);
    if (ck) {
      const ch = planet && planet.chunks ? planet.chunks[ck] : null;
      if (ch) ch._solar_affected = true;
    }
  });

  if (proc._solar_days === 0) proc._solar_finished = true;
  return;
}


    // DROUGHT: large-area crop reduction; shrink slowly over time
    if (proc.subtype === "drought") {
      if (!proc._drought_initialized) {
        const days = clamp(proc.duration || randInt(4,8), 4, 12);
        proc._drought_days = days;
        if (Array.isArray(proc.chunks)) {
          proc.chunks.forEach(c => {
            const key = c[0]+","+c[1];
            const ch = planet && planet.chunks ? planet.chunks[key] : null;
            if (ch) {
              ch._drought_days = Math.max(ch._drought_days || 0, days);
              ch._drought = true;
            }
          });
        }
        proc._drought_initialized = true;
        proc._drought_shrink_rate = 0.06; // remove ~6% of chunks per day (very slow)
      }

      if (typeof proc._drought_days === "number") proc._drought_days = Math.max(0, proc._drought_days - 1);

      const affected = townsInChunksList(proc.chunks || []);
      affected.forEach(tt => {
        const loss = randInt(1,3);
        adjustTownFoodSafely(tt, -loss);
        tt._drought_days = Math.max(0, (tt._drought_days || 0) - 1);
      });

      if (Array.isArray(proc.chunks) && proc.chunks.length > 1) {
        const removeCount = Math.max(1, Math.floor(proc.chunks.length * (proc._drought_shrink_rate || 0.05)));
        for (let r=0; r<removeCount; r++){
          const idx = Math.floor(Math.random() * proc.chunks.length);
          const removed = proc.chunks.splice(idx, 1);
          // clear best-effort flags for removed chunk
          try {
            if (removed && removed[0]) {
              const key = removed[0][0] + "," + removed[0][1];
              const ch = planet && planet.chunks ? planet.chunks[key] : null;
              if (ch && ch._drought_days) ch._drought_days = Math.max(0, ch._drought_days - 1);
            }
          } catch(e){}
        }
      }

      if (proc._drought_days === 0 && !proc._drought_message_shown) {
        try { safeLog(`Drought at ${proc.locationDesc} has ended.`); } catch(e){}
        proc._drought_message_shown = true;
      }

      if (proc._drought_days === 0) proc._drought_finished = true;
      return;
    }

    // EPIDEMIC: spread & messaging; mark pandemic on map + chat if large
    if (proc.subtype === "epidemic") {
      if (!proc._epidemic_initialized) {
        proc._epidemic_days = clamp(proc.duration || randInt(8,16), 6, 30);
        proc._epidemic_infected = proc._epidemic_infected || 1;
        if (proc._initial_town) {
          const all = getAllTowns();
          const t = all.find(x => x.id === proc._initial_town);
          if (t) {
            t._epidemic_infected = Math.max(1, t._epidemic_infected || 0) + 1;
            t._epidemic_days = proc._epidemic_days;
          }
        }
        proc._epidemic_initialized = true;
      }

      if (!proc._pandemic_announced) {
        const towns = townsInChunksList(proc.chunks || []);
        if (towns.length >= 3) {
          proc._isPandemic = true;
          proc._pandemic_announced = true;
          safeLog(`Pandemic detected: ${proc.name || "Epidemic"} affecting ${towns.length} towns near ${proc.locationDesc}.`);
          try {
            if (Array.isArray(proc.chunks)) {
              proc.chunks.forEach(c => {
                const key = c[0] + "," + c[1];
                const ch = planet && planet.chunks ? planet.chunks[key] : null;
                if (ch) ch._pandemic = true;
              });
            }
            if (window.$wt && $wt.map && typeof $wt.map.addMarker === "function" && Array.isArray(proc.chunks)) {
              const label = proc.name || "Pandemic";
              proc._map_marker_ids = proc._map_marker_ids || [];
              proc.chunks.forEach(c => {
                try {
                  const id = $wt.map.addMarker({x:c[0], y:c[1], label: label, type: "pandemic"});
                  if (id) proc._map_marker_ids.push(id);
                } catch(e){}
              });
            }
          } catch(e){ console.error("pandemic map mark err", e); }
        }
      }

      if (typeof proc._epidemic_days === "number") proc._epidemic_days = Math.max(0, proc._epidemic_days - 1);

      const infectedTowns = getAllTowns().filter(tt => tt._epidemic_days && tt._epidemic_days > 0 && (tt._epidemic_infected && tt._epidemic_infected>0));
      infectedTowns.forEach(tt => {
        const inf = Math.max(1, tt._epidemic_infected || 1);
        if (Math.random() < 0.14) {
          const deaths = Math.floor(Math.random() * Math.min(2, Math.max(1, Math.floor(inf/3))));
          if (deaths > 0) {
            try { if (typeof happen === "function") happen("Death", {reg:"player",id:1}, tt, {count: deaths}); else tt.pop = Math.max(0, (tt.pop||0) - deaths); } catch(e){}
          }
        }
        tt._epidemic_days = Math.max(0, tt._epidemic_days - 1);

        try {
          const ck = chunkKeyFromTown(tt);
          if (!ck) return;
          const [cx,cy] = ck.split(",").map(Number);
          const neighChunks = circleChunksFn(cx,cy,2);
          const possibleTowns = townsInChunksList(neighChunks.map(c=>[c.x,c.y]));
          possibleTowns.forEach(dest => {
            if (dest === tt) return;
            if (Math.random() < 0.06 + Math.min(0.25, inf * 0.02)) {
              dest._epidemic_infected = Math.max(1, dest._epidemic_infected || 0) + 1;
              dest._epidemic_days = Math.max(dest._epidemic_days || 0, randInt(6,12));
            }
          });
        } catch(e){}
      });

      if (proc._epidemic_days === 0 && !proc._epidemic_message_shown) {
        safeLog(`${proc.name || "Epidemic"} at ${proc.locationDesc} has cleared.`);
        try {
          if (Array.isArray(proc.chunks)) {
            proc.chunks.forEach(c => {
              const key = c[0] + "," + c[1];
              const ch = planet && planet.chunks ? planet.chunks[key] : null;
              if (ch) { if (ch._pandemic) delete ch._pandemic; }
            });
          }
          if (proc._map_marker_ids && window.$wt && $wt.map && typeof $wt.map.removeMarker === "function") {
            proc._map_marker_ids.forEach(id => {
              try { $wt.map.removeMarker(id); } catch(e){}
            });
          }
        } catch(e){}
        const all = getAllTowns();
        all.forEach(tt => {
          if (tt._epidemic_days && tt._epidemic_days <= 0) {
            delete tt._epidemic_infected;
            delete tt._epidemic_days;
            delete tt._epidemic_origin_animal;
          }
        });
        proc._epidemic_message_shown = true;
      }

      if (proc._epidemic_days === 0) proc._epidemic_finished = true;
      return;
    }

    // AVALANCHE / other types handled elsewhere or require no daily work
  }

  // cleanup chunk-level timers that might remain without an owning proc
  function cleanupChunkTimers(){
    try {
      if (!planet || !planet.chunks) return;
      Object.keys(planet.chunks).forEach(k => {
        const ch = planet.chunks[k];
        if (!ch) return;
        if (typeof ch._radio_days === "number" && ch._radio_days > 0) {
          ch._radio_days = Math.max(0, ch._radio_days - 1);
          if (ch._radio_days === 0) {
            ch._radioactive = false;
            if (ch._orig_b !== undefined) { ch.b = ch._orig_b; delete ch._orig_b; }
            if (Array.isArray(ch.pixels)) ch.pixels.forEach(px => { if (px._radioactive) delete px._radioactive; });
          }
        }
        if (typeof ch._solar_days === "number" && ch._solar_days > 0) {
          ch._solar_days = Math.max(0, ch._solar_days - 1);
          if (ch._solar_days === 0) {
            if (ch._solar_affected) delete ch._solar_affected;
            if (Array.isArray(ch.pixels)) ch.pixels.forEach(px => { if (px._solar_affected) delete px._solar_affected; });
          }
        }
        if (typeof ch._drought_days === "number" && ch._drought_days > 0) {
          ch._drought_days = Math.max(0, ch._drought_days - 1);
          if (ch._drought_days === 0) {
            if (ch._drought) delete ch._drought;
            if (Array.isArray(ch.pixels)) ch.pixels.forEach(px => { if (px._drought) delete px._drought; });
          }
        }
        if (ch._pandemic && ch._pandemic === true && (!ch._radio_days && !ch._solar_days && !ch._drought_days)) {
          // leave pandemic until explicitly cleared by epidemic process; do not auto-clear here
        }
      });
    } catch(e){ console.error("cleanupChunkTimers error", e); }
  }

  // ----- Helpers to find biome-specific chunks/towns -----
  function findCoastalTownChunk(){
    const towns = getAllTowns();
    for (let i=0;i<towns.length;i++){
      const t = towns[i];
      const k = chunkKeyFromTown(t);
      if (!k) continue;
      const [cx,cy] = k.split(",").map(Number);
      const neigh = circleChunksFn(cx,cy,2);
      for (let j=0;j<neigh.length;j++){
        const c = chunkAtFn(neigh[j].x, neigh[j].y);
        if (c && c.b && String(c.b).toLowerCase().includes("water")) return {town: t, cx, cy};
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
  function findSnowMountainChunk(){
    const towns = getAllTowns();
    for (let i=0;i<towns.length;i++){
      const t = towns[i];
      const k = chunkKeyFromTown(t);
      if (!k) continue;
      const [cx,cy] = k.split(",").map(Number);
      const ch = chunkAtFn(cx,cy);
      const biome = ch && ch.b ? String(ch.b).toLowerCase() : (t && t.biome ? String(t.biome).toLowerCase() : "");
      if ((biome && biome.includes("snow")) || (ch && ch.b && String(ch.b).toLowerCase().includes("mount"))) return {town: t, cx, cy};
    }
    const c = randomChunkFn(c => {
      const b = c && c.b ? String(c.b).toLowerCase() : "";
      return b && (b.includes("snow") || b.includes("mount"));
    });
    if (c) return {town:null, cx:c.x, cy:c.y};
    return null;
  }

  // coastal strip builder
  function buildCoastalStrip(cx,cy,length){
    const strip = [];
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
    let current = choose(candidates);
    strip.push([current.x,current.y]);
    const used = {}; used[current.x+","+current.y] = true;
    for (let s=1; s<length; s++){
      const neigh = candidates.filter(c => !used[c.x+","+c.y] && Math.abs(c.x - current.x) + Math.abs(c.y - current.y) <= 2);
      if (!neigh.length) break;
      current = choose(neigh);
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

  // solar jagged builder (enhanced wrapper)
  function buildSolarJagged(cx,cy,steps,patchRadius){
    const s = Math.max(20, steps || randInt(20,80));
    const pr = Math.max(1, patchRadius || randInt(1,4));
    return buildSolarJaggedEnhanced(cx,cy,s,pr);
  }

  // small natural name generator
  function natName(prefix){
    const picks = ["Ibert","Alder","Kess","Voss","Anode","Rhett","Marun","Solen","Zahir","Galen","Vesta","Rook","Iona","Iver","Bryn","Ilya"];
    return (prefix||"") + " " + choose(picks);
  }

  // ----- Ensure subtype metadata present in engine (if available) -----
  waitFor(() => (window.actionables && actionables.process && actionables.process._disasterSubtypes !== undefined), () => {
    try {
      const sub = actionables.process._disasterSubtypes;

      // tornado EF labels
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
            if (biome.includes("snow")) return "Blizzard " + natName("");
          } catch(e){}
          return "Thunderstorm " + natName("");
        },
        deathRate: 0.25,
        destroy: false,
        spread: 1,
        duration: 3
      });

      // drought (no name handled by spawn)
      sub["drought"] = Object.assign(sub["drought"] || {}, {
        location: "any",
        radius: 6,
        message: "[NAME] dries out $.",
        messageDone: "[NAME] $ breaks with rain.",
        color: [200,170,90],
        name: (d) => d && d.name ? d.name : natName("Drought"),
        deathRate: 0.05,
        destroy: false,
        spread: 0,
        duration: 5
      });

      // epidemic
      sub["epidemic"] = Object.assign(sub["epidemic"] || {}, {
        location: "town",
        radius: 1,
        message: "[NAME] begins at $.",
        messageDone: "[NAME] $ eases.",
        color: [180,50,50],
        name: (d) => d && d.name ? d.name : "Epidemic",
        deathRate: 0.3,
        destroy: false,
        spread: 1,
        duration: 10
      });

      // tsunami
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
        name: (d) => d && d.name ? d.name : natName("Sandstorm"),
        deathRate: 0.12,
        destroy: false,
        spread: 1,
        duration: 3
      });

      // volcano
      sub["volcano"] = Object.assign(sub["volcano"] || {}, {
        location: "mountain",
        radius: 3,
        scale: ["1","2","3","4","5","6","7","8","9","10"],
        message: "[NAME] erupts $.",
        messageDone: "[NAME] $ quiets.",
        color: [200,90,20],
        name: (d) => d && d.name ? d.name : natName("Mount"),
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
        name: (d) => d && d.name ? d.name : natName("Meteor"),
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

      // avalanche
      sub["avalanche"] = Object.assign(sub["avalanche"] || {}, {
        location: "mountain",
        radius: 2,
        message: "[NAME] buries $.",
        messageDone: "[NAME] $ settles.",
        color: [180,210,230],
        name: (d) => d && d.name ? d.name : natName("Avalanche"),
        deathRate: 1.2,
        destroy: true,
        spread: 0,
        duration: 1
      });

      sub["alien_laser"] = Object.assign(sub["alien_laser"] || {}, {
        location: "any",
        radius: 2,
        message: "[NAME] blasts $.",
        messageDone: "[NAME] $ leaves a permanent void.",
        color: [150,20,200],
        name: (d) => d && d.name ? d.name : natName("Alien Strike"),
        deathRate: 5.0,
        destroy: true,
        duration: 999999
      });

      safeLog("Disasters: subtypes ensured (including drought, epidemic, avalanche).");
    } catch (e){
      console.error("Disasters subtype injection error:", e);
    }

    // ----- Spawners (no spawn-rate setting; fixed, robust probabilities) -----

    // Volcano (mountain-only) - now increased chance; must be on a mountain otherwise skip
    Mod.event("dis_spawn_volcano", { random:true, weight:0.7, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.60) return; // increased pass probability => more volcanoes
        const found = findMountainTownChunk(); if (!found) return;
        const cx = found.cx, cy = found.cy;
        let mountName = null;
        if (found.town && found.town.name) mountName = found.town.name;
        else {
          const ch = chunkAtFn(cx,cy);
          if (ch && ch.name) mountName = ch.name;
        }
        if (!mountName) mountName = natName("Mount");
        const name = "Mount " + mountName;
        const scale = randInt(2,9);
        const dur = Math.max(1, Math.ceil(scale/4));
        const chunks = buildChunks(cx,cy, 3 + Math.floor(scale/4));
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"volcano",duration:dur,scale,name, town:(found.town?found.town.id:null)});
        if (!created) return;
        created.scale = scale;
        if (Array.isArray(created.chunks) && created.chunks.length===0) created.chunks = chunks.slice();
        const affected = townsInChunksList(chunks);
        let totalKilled = 0;
        affected.forEach(tt => {
          try {
            const killCount = Math.max(1, Math.ceil((tt.pop||0) * 0.6));
            totalKilled += killCount;
            if (typeof happen === "function") happen("Death", {reg:"player",id:1}, tt, {count: killCount});
            else tt.pop = Math.max(0, (tt.pop||0) - killCount);
            shrinkTownAreaSafely(tt, 0.4);
          } catch(e){
            try { const k = Math.max(1, Math.ceil((tt.pop||0) * 0.6)); totalKilled += k; tt.pop = Math.max(0, (tt.pop||0) - k); } catch(e){}
            shrinkTownAreaSafely(tt, 0.4);
          }
        });
        return `${created.name} erupts, killing ${totalKilled} people at ${created.locationDesc}.`;
      }
    });

    // Tornado (EF scale)
    Mod.event("dis_spawn_tornado", { random:true, weight:0.95, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.40) return;
        const towns = getAllTowns(); if (!towns.length) return;
        const center = choose(towns);
        const ck = chunkKeyFromTown(center); if (!ck) return;
        const [cx,cy] = ck.split(",").map(Number);
        const ef = choose(["EF0","EF1","EF2","EF3","EF4","EF5"]);
        const dur = clamp(randInt(1,3),1,3);
        const efMap = { "EF0":1, "EF1":1, "EF2":2, "EF3":3, "EF4":4, "EF5":5 };
        const radius = efMap[ef] || 1;
        const chunks = buildChunks(cx,cy,radius); if (!chunks.length) chunks.push([cx,cy]);
        const name = natName("Gale");
        const display = `${name} (${ef})`;
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"tornado",duration:dur,scale:ef,name:display, town:center.id});
        if (created) created.scale = ef;
        return `${display} touches down near ${created.locationDesc}.`;
      }
    });

    // Tsunami
    Mod.event("dis_spawn_tsunami", { random:true, weight:0.62, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.25) return;
        const found = findCoastalTownChunk(); if (!found) return;
        const length = clamp(randInt(2,4),2,4);
        const strip = buildCoastalStrip(found.cx, found.cy, length);
        if (!strip.length) return;
        const created = createProcessAndLog({x:found.cx,y:found.cy,chunks:strip,subtype:"tsunami",duration:2,name:"Tsunami", town:(found.town?found.town.id:null)});
        return `Tsunami pounds the coast near ${created.locationDesc}.`;
      }
    });

    // Thunderstorm / Blizzard (higher weight so blizzard appears more often)
    Mod.event("dis_spawn_thunderstorm", { random:true, weight:1.2, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.65) return; // increased pass probability
        const towns = getAllTowns(); if (!towns.length) return;
        const center = choose(towns);
        const ck = chunkKeyFromTown(center); if (!ck) return;
        const [cx,cy] = ck.split(",").map(Number);
        const ch = chunkAtFn(cx,cy);
        const isSnow = (ch && ch.b && String(ch.b).toLowerCase().includes("snow")) || (center && center.biome && String(center.biome).toLowerCase().includes("snow"));
        const dur = isSnow ? clamp(randInt(4,10),4,10) : clamp(randInt(4,7),4,7);
        const chunks = buildChunks(cx,cy, 2 + (isSnow ? 1 : 0));
        const name = isSnow ? ("Blizzard " + natName("")) : ("Thunderstorm " + natName(""));
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"thunderstorm",duration:dur,name, town:center.id});
        if (created && created._disaster_mod_uid) {
          window._disasterMovers[created._disaster_mod_uid] = { uid: created._disaster_mod_uid, subtype: (isSnow ? "blizzard" : "thunderstorm"), speed: 1, vx: (Math.random()-0.5)*0.6, vy: (Math.random()-0.5)*0.6 };
        }
        return `${created.name} moves into the region near ${created.locationDesc}.`;
      }
    });

    // Sandstorm
    Mod.event("dis_spawn_sandstorm", { random:true, weight:0.7, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.33) return;
        const f = findDesertChunk(); if (!f) return;
        const dur = clamp(randInt(3,6),3,6);
        const chunks = buildChunks(f.cx,f.cy,2);
        const name = natName("Sandstorm");
        const created = createProcessAndLog({x:f.cx,y:f.cy,chunks,subtype:"sandstorm",duration:dur,name, town:(f.town?f.town.id:null)});
        if (created && created._disaster_mod_uid) {
          window._disasterMovers[created._disaster_mod_uid] = { uid: created._disaster_mod_uid, subtype: "sandstorm", speed: 1, vx: (Math.random()-0.5)*0.6, vy: (Math.random()-0.5)*0.6 };
        }
        return `${created.name} sweeps across ${created.locationDesc} for ${dur} day(s).`;
      }
    });

    // Meteor
    Mod.event("dis_spawn_meteor", { random:true, weight:0.22, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.12) return;
        const towns = getAllTowns();
        const pickTown = towns && towns.length ? choose(towns) : null;
        let cx,cy;
        if (pickTown) {
          const ck = chunkKeyFromTown(pickTown);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        }
        if (cx === undefined) { const c = randomChunkFn(()=>true); if (!c) return; cx=c.x; cy=c.y; }
        const scale = randInt(3,10);
        const instant = Math.random() < 0.35;
        const dur = instant ? 1 : randInt(1,3);
        const chunks = buildChunks(cx,cy, instant?1: (2 + Math.floor(scale/6)));
        const name = natName("Meteor ");
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"meteor",duration:dur,scale,name, town:(pickTown?pickTown.id:null)});
        if (created) created.instant = instant;
        return `${created.name} impacts near ${created.locationDesc}.`;
      }
    });

    // Solar flare (enhanced): much bigger and more randomly spread
    Mod.event("dis_spawn_solar", { random:true, weight:0.16, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.10) return;
        const towns = getAllTowns();
        let centerTown = towns && towns.length ? choose(towns) : null;
        let cx=0, cy=0;
        if (centerTown) {
          const ck = chunkKeyFromTown(centerTown);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        } else {
          const c = randomChunkFn(()=>true);
          if (!c) return;
          cx=c.x; cy=c.y;
        }
        // significantly larger & thinner: many clusters with long jumps
        const steps = randInt(40,140);      // many steps -> many clusters
        const patchRadius = randInt(1,6);   // varied patch radius
        let chunks = buildSolarJagged(cx,cy,steps,patchRadius);
        if (!chunks.length) return;
        // cap to avoid performance issues but keep it wide: allow up to 160 chunks
        const MAX_SOLAR_CHUNKS = 160;
        if (chunks.length > MAX_SOLAR_CHUNKS) chunks = chunks.slice(0, MAX_SOLAR_CHUNKS);
        // dedupe once more, ensure integer coords
        const set = {}; const out = [];
        for (let i=0;i<chunks.length;i++){
          const a = [Math.round(chunks[i][0]), Math.round(chunks[i][1])];
          const k = a[0]+","+a[1];
          if (!set[k]) { set[k]=true; out.push(a); }
        }
        chunks = out;
        const dur = randInt(30,120); // long-lived
        const name = "Solar Flare " + uid("SF");
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"solar_flare",duration:dur,scale:null,name, town:(centerTown?centerTown.id:null)});
        if (!created) return;
        // ensure the engine process has the full chunk list we generated
        try {
          created.chunks = chunks.slice();
          created._solar_chunks = chunks.slice();
          created._solar_days = dur;
          // mark chunk flags for map/UI visibility
          created.chunks.forEach(c => {
            const key = c[0] + "," + c[1];
            const ch = planet && planet.chunks ? planet.chunks[key] : null;
            if (ch) { ch._solar_days = Math.max(ch._solar_days || 0, dur); ch._solar_affected = true; }
          });
        } catch(e){ console.error("assigning solar chunks err", e); }
        return `${created.name} streaks across the skies for ${dur} day(s).`;
      }
    });

    // Nuke
    Mod.event("dis_spawn_nuke", { random:true, weight:0.10, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.04) return;
        const towns = getAllTowns();
        const pick = towns && towns.length ? choose(towns) : null;
        let cx,cy;
        if (pick) {
          const ck = chunkKeyFromTown(pick);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        }
        if (cx === undefined) { const c = randomChunkFn(()=>true); if (!c) return; cx=c.x; cy=c.y; }
        const radius = 8;
        const chunks = buildChunks(cx,cy,radius);
        const name = "Nuclear Device " + uid("N");
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"nuke",duration:randInt(20,30),name, town:(pick?pick.id:null)});
        markChunksRadioactiveSafely(chunks, randInt(20,30));
        const affected = townsInChunksList(chunks);
        affected.forEach(tt => shrinkTownAreaSafely(tt, 0.25));
        return `${name} detonated near ${created.locationDesc}.`;
      }
    });

    // Drought (no generated name, slow shrink)
    Mod.event("dis_spawn_drought", { random:true, weight:0.35, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.22) return;
        const c = randomChunkFn(()=>true); if (!c) return;
        const cx = c.x, cy = c.y;
        const radius = clamp(randInt(4,8), 4, 10);
        const chunks = buildChunks(cx,cy, radius);
        if (!chunks.length) return;
        const dur = clamp(randInt(4,8), 4, 8);
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"drought",duration:dur, town:null, noName:true});
        if (created) { markDroughtChunks(created.chunks, dur); }
        return `A drought affects a wide area near ${created.locationDesc} for ${dur} day(s).`;
      }
    });

    // Epidemic (a bit more common)
    Mod.event("dis_spawn_epidemic", { random:true, weight:0.16, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.15) return; // slightly higher pass probability
        const towns = getAllTowns(); if (!towns.length) return;
        const pick = choose(towns);
        if (!pick) return;
        const ck = chunkKeyFromTown(pick); if (!ck) return;
        const [cx,cy] = ck.split(",").map(Number);
        const dur = clamp(randInt(8,16), 6, 24);
        let originAnimal = "livestock";
        try {
          if (typeof regFilter === "function") {
            const animals = regFilter("animal", ()=>true);
            if (Array.isArray(animals) && animals.length) {
              const a = choose(animals);
              originAnimal = a && a.species ? a.species : a && a.name ? a.name : originAnimal;
            }
          }
        } catch(e){}
        const name = "Epidemic " + uid("E");
        const chunks = buildChunks(cx,cy, 1);
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"epidemic",duration:dur,name, town:pick.id});
        if (created) {
          created._originAnimal = originAnimal;
          created._initial_town = pick.id;
          pick._epidemic_infected = Math.max(1, pick._epidemic_infected || 0) + 1;
          pick._epidemic_days = Math.max(pick._epidemic_days || 0, dur);
          pick._epidemic_origin_animal = originAnimal;
          try { showEpidemicChoiceOnce(created); } catch(e){ console.error("showEpidemicChoiceOnce err", e); }
        }
        safeLog(`${created.name} begins at ${created.locationDesc}. Origin: ${originAnimal}.`);
        return `${created.name} begins at ${created.locationDesc}. Origin: ${originAnimal}.`;
      }
    });

    // Avalanche (no generated name) - increased chance
    Mod.event("dis_spawn_avalanche", { random:true, weight:0.30, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.60) return; // increased pass probability
        const found = findSnowMountainChunk(); if (!found) return;
        const cx = found.cx, cy = found.cy;
        const radius = clamp(randInt(1,3), 1, 3);
        const chunks = buildChunks(cx,cy,radius);
        if (!chunks.length) return;
        const dur = 1;
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:"avalanche",duration:dur, town:(found.town?found.town.id:null), noName:true});
        if (!created) return;
        const affected = townsInChunksList(chunks);
        affected.forEach(tt => {
          try {
            const killCount = Math.max(1, Math.ceil((tt.pop||0) * 0.25));
            if (typeof happen === "function") happen("Death", {reg:"player",id:1}, tt, {count: killCount});
            else tt.pop = Math.max(0, (tt.pop||0) - killCount);
            shrinkTownAreaSafely(tt, 0.7);
          } catch(e){ tt.pop = Math.max(0, (tt.pop||0) - Math.max(1, Math.ceil((tt.pop||0) * 0.25))); shrinkTownAreaSafely(tt,0.7); }
        });
        return `An avalanche buries ${created.locationDesc}.`;
      }
    });

    // Alien laser (rare)
    Mod.event("dis_spawn_alien_laser", { random:true, weight:0.04, subject:{reg:"nature",id:1},
      func: (s,t,a) => {
        if (Math.random() > 0.02) return;
        const towns = getAllTowns();
        const pickTown = towns && towns.length ? choose(towns) : null;
        let cx,cy;
        if (pickTown) {
          const ck = chunkKeyFromTown(pickTown);
          if (ck) [cx,cy] = ck.split(",").map(Number);
        }
        if (cx === undefined) { const c = randomChunkFn(()=>true); if (!c) return; cx=c.x; cy=c.y; }
        const holeRadius = 3;
        const chunks = buildChunks(cx,cy,holeRadius);
        const name = natName("Alien Strike ");
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

    // ----- Console helper & debug helpers -----
    window.NaturalDisasters = window.NaturalDisasters || {};
    window.NaturalDisasters.spawn = function(type){
      try {
        if (!type) return null;
        const towns = getAllTowns();
        const pick = towns && towns.length ? choose(towns) : null;
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
        const radiusMap = { volcano:3, tornado:2, tsunami:5, meteor:2, sandstorm:2, nuke:8, solar_flare:0, alien_laser:3, thunderstorm:2, drought:6, epidemic:1, avalanche:2 };
        const chunks = buildChunks(cx,cy, radiusMap[type] || 2);
        const name = (type==="nuke") ? ("Manual Nuke " + uid("N")) : (type.charAt(0).toUpperCase()+type.slice(1)+" "+uid(""));
        const created = createProcessAndLog({x:cx,y:cy,chunks,subtype:type,duration:(type==="nuke"?randInt(20,30): Math.max(1,Math.ceil(Math.random()*3))), name, town:(pick?pick.id:null)});
        if (!created) return null;
        // post-actions
        if (type === "nuke") {
          markChunksRadioactiveSafely(chunks, randInt(20,30));
          const affected = townsInChunksList(chunks);
          affected.forEach(tt => shrinkTownAreaSafely(tt, 0.25));
        } else if (type === "alien_laser") {
          const affected = townsInChunksList(chunks);
          affected.forEach(tt =>{
            try { const kill = Math.ceil((tt.pop||0) * 0.95) + 5; if (typeof happen === "function") happen("Death", {reg:"player",id:1}, tt, {count:kill}); else tt.pop = Math.max(0, (tt.pop||0) - kill); } catch(e){}
            shrinkTownAreaSafely(tt, 0.2);
            tt._killedByAlien = true;
          });
          for (let i=0;i<chunks.length;i++){ const key = chunks[i][0]+","+chunks[i][1]; const ch = planet && planet.chunks ? planet.chunks[key] : null; if (ch) { ch._alien_hole = true; if (Array.isArray(ch.pixels)) ch.pixels.forEach(px=>px._alien_hole=true); } }
        } else if (type === "drought") {
          if (Array.isArray(chunks)) {
            markDroughtChunks(chunks, Math.max(4, Math.min(8, created.duration || 4)));
          }
        } else if (type === "epidemic") {
          if (created && pick) {
            created._initial_town = pick.id;
            created._originAnimal = created._originAnimal || "livestock";
            pick._epidemic_infected = Math.max(1, pick._epidemic_infected || 0) + 1;
            pick._epidemic_days = Math.max(pick._epidemic_days || 0, created.duration || 8);
            pick._epidemic_origin_animal = created._originAnimal;
            try { showEpidemicChoiceOnce(created); } catch(e){}
          }
        }
        // register mover for storms
        if (type === "thunderstorm" || type === "blizzard" || type === "sandstorm") {
          if (created && created._disaster_mod_uid) {
            if (!created._disaster_mod_uid) created._disaster_mod_uid = uid("disaster");
            window._disasterMovers[created._disaster_mod_uid] = { uid: created._disaster_mod_uid, subtype: type, speed: 1, vx: (Math.random()-0.5)*0.6, vy: (Math.random()-0.5)*0.6 };
          }
        }
        return created;
      } catch(e){ console.error("NaturalDisasters.spawn err", e); return null; }
    };

    // small debug functions exposed
    window.NaturalDisasters.listActive = function(){
      try {
        return (typeof regFilter === "function") ? regFilter("process", p => p.type === "disaster") : (planet && planet.processes ? planet.processes.filter(p=>p.type==="disaster") : []);
      } catch(e){ return []; }
    };
    window.NaturalDisasters.findRadioactive = function(){ return Object.values(planet.chunks||{}).filter(c => c._radioactive || c._solar_affected); };
    window.NaturalDisasters.findAlienHoles = function(){ return Object.values(planet.chunks||{}).filter(c => c._alien_hole); };
    window.NaturalDisasters.findDrought = function(){ return Object.values(planet.chunks||{}).filter(c => c._drought); };
    window.NaturalDisasters.listEpidemicTowns = function(){ return getAllTowns().filter(t => t._epidemic_infected && t._epidemic_infected>0); };

    safeLog("Disasters mod enabled");
  }); // end waitFor(actionables)

  // helper to mark drought chunks externally
  function markDroughtChunks(chunks, days){
    try {
      for (let i=0;i<chunks.length;i++){
        const key = chunks[i][0] + "," + chunks[i][1];
        const ch = planet && planet.chunks ? planet.chunks[key] : null;
        if (ch) {
          ch._drought = true;
          if (ch._drought_days === undefined) ch._drought_days = days;
          else ch._drought_days = Math.max(ch._drought_days, days);
          if (Array.isArray(ch.pixels)) ch.pixels.forEach(px => px._drought = true);
        }
      }
    } catch(e){ console.error("markDroughtChunks error", e); }
  }

})(); 

