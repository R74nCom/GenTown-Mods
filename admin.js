Mod.afterLoad(function () {
    if (window.r74nDevInitialized) return;
    window.r74nDevInitialized = true;

    window.devMode = false;
    window.devBrush = null;
    let isPaintingBrush = false;

    window._origHandleEdit = window.handleEdit;
    window.handleEdit = function (entity) {
        window.__currentEntity = entity;
        window._origHandleEdit(entity);
    };

    window._origPopulateExecutive = window.populateExecutive;
    window.populateExecutive = function (items, title, main) {
        window._origPopulateExecutive(items, title, main);

        setTimeout(() => {
            const listId = main ? "actionMainList" : "actionSubList";
            const list = document.getElementById(listId);
            if (!list) return;

            const domItems = list.querySelectorAll(".actionItem.item");

            if (title && (title === "Customize" || title === "Settings" || title.startsWith("Edit "))) {
                items.forEach((item, i) => {
                    if (item.slider && domItems[i]) {
                        let el = domItems[i];
                        if (!el.querySelector(".adv-input")) {
                            let input = document.createElement("input");
                            input.className = "adv-input";
                            input.type = "text";
                            input.value = item.value !== undefined ? item.value : item.default;
                            input.style.cssText = "width:60px;background:rgba(0,0,0,0.65);color:#00ffff;border:1px solid #00ffff;padding:2px 5px;margin-left:10px;font-family:inherit;text-align:right;";

                            input.addEventListener("change", (e) => {
                                let val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                    el.setAttribute("data-value", val);
                                    if (item.func) item.func(item.slider, val);
                                    if (typeof window.updateCanvas === "function") window.updateCanvas();
                                }
                            });
                            input.addEventListener("keydown", (e) => e.stopPropagation());
                            input.addEventListener("mousedown", (e) => e.stopPropagation());
                            input.addEventListener("click", (e) => e.stopPropagation());
                            el.appendChild(input);
                        }
                    }
                });
            }

            if (title && title.startsWith("Edit ") && window.__currentEntity && !window.__currentEntity.end) {
                let entity = window.__currentEntity;
                list.insertAdjacentHTML("beforeend", `<span class="actionItem item" style="padding-top:1em;text-align:center;color:yellow;pointer-events:none;">--- Raw Data ---</span>`);

                for (let key in entity) {
                    let val = entity[key];
                    if (val === null || typeof val === "function" || ["_reg", "id", "del", "chunks", "center"].includes(key)) continue;

                    let isArray = Array.isArray(val);
                    if (typeof val === "object" && !isArray) continue;

                    let el = document.createElement("span");
                    el.className = "actionItem item actionSetting";
                    el.innerHTML = `${key}: <input type="text" value="${isArray ? val.join(", ") : val}" style="width:110px;background:rgba(0,0,0,0.65);color:#00ffff;border:1px solid #00ffff;padding:2px 5px;margin-left:auto;font-family:inherit;">`;

                    let input = el.querySelector("input");
                    input.addEventListener("change", (e) => {
                        let v = e.target.value;
                        if (typeof val === "number") v = parseFloat(v) || 0;
                        else if (typeof val === "boolean") v = v === "true";
                        else if (isArray) v = v.split(",").map((s) => parseFloat(s.trim()));

                        entity[key] = v;
                        if (typeof window.renderMap === "function") window.renderMap();
                        if (typeof window.renderHighlight === "function") window.renderHighlight();
                        if (typeof window.updateCanvas === "function") window.updateCanvas();
                        if (typeof window.updateStats === "function") window.updateStats();
                    });
                    input.addEventListener("keydown", (e) => e.stopPropagation());
                    input.addEventListener("mousedown", (e) => e.stopPropagation());
                    input.addEventListener("click", (e) => e.stopPropagation());
                    list.appendChild(el);
                }
            }
        }, 10);
    };

    const canvas = document.getElementById("mapCanvas") || window.mapCanvas || document.querySelector("canvas");
    if (canvas) {
        let isPanning = false;
        let lastX = 0;
        let lastY = 0;
        let panMoved = false;

        canvas.style.transformOrigin = "0 0";
        window.__dragX = window.__dragX || 0;
        window.__dragY = window.__dragY || 0;
        window.__zoom = window.__zoom || 1;

        canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            e.stopPropagation();

            let oldZoom = window.__zoom;
            let zoomDelta = e.deltaY < 0 ? 0.25 : -0.25;
            let newZoom = Math.max(0.2, Math.min(25, Math.round((oldZoom + zoomDelta) * 100) / 100));

            if (newZoom === oldZoom) return;

            let rect = canvas.parentElement.getBoundingClientRect();
            let relX = e.clientX - rect.left;
            let relY = e.clientY - rect.top;

            let ratio = newZoom / oldZoom;
            window.__dragX = relX - (relX - window.__dragX) * ratio;
            window.__dragY = relY - (relY - window.__dragY) * ratio;
            window.__zoom = newZoom;

            if (newZoom === 1) {
                window.__dragX = 0;
                window.__dragY = 0;
            }

            canvas.style.scale = window.__zoom;
            canvas.style.translate = `${window.__dragX}px ${window.__dragY}px`;
        }, { passive: false, capture: true });

        canvas.addEventListener("mousedown", (e) => {
            if (e.button === 2 || e.button === 1) {
                isPanning = true;
                panMoved = false;
                lastX = e.clientX;
                lastY = e.clientY;
            }
        });

        window.addEventListener("mousemove", (e) => {
            if (isPanning) {
                let dx = e.clientX - lastX;
                let dy = e.clientY - lastY;
                if (Math.hypot(dx, dy) > 2) panMoved = true;
                window.__dragX += dx;
                window.__dragY += dy;
                lastX = e.clientX;
                lastY = e.clientY;
                canvas.style.translate = `${window.__dragX}px ${window.__dragY}px`;
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 2 || e.button === 1) {
                if (panMoved) window.lastDrag = true;
                isPanning = false;
            }
        });

        canvas.addEventListener("dblclick", (e) => {
            if (e.ctrlKey || e.shiftKey) {
                window.__zoom = 1;
                window.__dragX = 0;
                window.__dragY = 0;
                canvas.style.scale = "1";
                canvas.style.translate = "0px 0px";
            }
        });

        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    const style = document.createElement("style");
    style.id = "r74nDevStyles";
    style.textContent = `
        #devToggleBtn {
            cursor: pointer;
            user-select: none;
            padding: 0.1em 0.45em;
            border: 1px solid rgba(255, 255, 255, 0.35);
            background: #000000;
            color: #cccccc;
            font-family: inherit;
            font-size: 0.85em;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            margin-left: auto;
            margin-right: 0.5em;
        }
        #devToggleBtn:hover {
            border-color: #ffffff;
            color: #ffffff;
        }
        #devToggleBtn.active {
            border-color: #00ffff;
            color: #00ffff;
            background: rgba(0, 255, 255, 0.12);
            box-shadow: 0 0 6px rgba(0, 255, 255, 0.35);
        }
        body.r74n-dev-active #mapDiv {
            outline: 1px dashed #00ffff;
        }
        body.r74n-dev-active .entityName:hover,
        body.r74n-dev-active #dayNumber:hover,
        body.r74n-dev-active #planetName:hover,
        body.r74n-dev-active #nextDay:hover,
        body.r74n-dev-active #viewButton:hover,
        body.r74n-dev-active .regSection:hover,
        body.r74n-dev-active #statsDiv tr:hover,
        body.r74n-dev-active .localStats span:hover,
        body.r74n-dev-active #actionSubList .actionItem:hover {
            outline: 1px dashed #00ffff;
            cursor: pointer;
        }
        #devPanelSplitter {
            width: 8px;
            cursor: col-resize;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(0, 255, 255, 0.04);
            border-left: 1px dashed rgba(0, 255, 255, 0.45);
            border-right: 1px dashed rgba(0, 255, 255, 0.45);
            user-select: none;
            flex-shrink: 0;
            z-index: 40;
            transition: background 0.12s;
        }
        body.r74n-dev-active #devPanelSplitter {
            display: flex;
        }
        #devPanelSplitter:hover, #devPanelSplitter.dragging {
            background: rgba(0, 255, 255, 0.28);
            border-left-color: #00ffff;
            border-right-color: #00ffff;
        }
        #devPanelSplitter::after {
            content: "⋮";
            color: #00ffff;
            font-size: 14px;
            line-height: 1;
        }
        #r74nDevMenu {
            position: fixed;
            z-index: 99999;
            background: #080808;
            border: 1px solid #00ffff;
            box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.9);
            min-width: 260px;
            max-width: 345px;
            max-height: 82vh;
            display: none;
            flex-direction: column;
            font-family: inherit;
            color: #ffffff;
        }
        #r74nDevMenuHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.35em 0.6em;
            background: #141414;
            border-bottom: 1px solid #00ffff;
            color: #00ffff;
            font-weight: bold;
            user-select: none;
            gap: 0.5em;
        }
        #r74nDevMenuClose {
            cursor: pointer;
            color: #ff5757;
            padding: 0 0.3em;
            border: 1px solid transparent;
        }
        #r74nDevMenuClose:hover {
            border-color: #ff5757;
            background: rgba(255, 87, 87, 0.2);
        }
        #r74nDevMenuList {
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            padding: 0.2em 0;
        }
        .devMenuItem {
            padding: 0.32em 0.65em;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.6em;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 0.88em;
        }
        .devMenuItem:hover {
            background: rgba(0, 255, 255, 0.16);
            color: #ffff8c;
        }
        .devMenuItem.danger {
            color: #ff6e6e;
        }
        .devMenuItem.danger:hover {
            background: rgba(255, 87, 87, 0.22);
            color: #ffaaaa;
        }
        .devMenuSection {
            padding: 0.4em 0.65em 0.15em 0.65em;
            color: #ffff00;
            font-size: 0.76em;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background: rgba(255, 255, 0, 0.05);
            border-bottom: 1px solid rgba(255, 255, 0, 0.2);
            user-select: none;
        }
        .devMenuVal {
            color: #00ffff;
            font-size: 0.9em;
            text-align: right;
        }
        #devBrushBar {
            position: absolute;
            top: 6px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 60;
            background: rgba(0, 0, 0, 0.92);
            border: 1px solid #ffff00;
            color: #ffff00;
            padding: 0.25em 0.65em;
            display: none;
            align-items: center;
            gap: 0.55em;
            font-size: 0.85em;
            user-select: none;
            white-space: nowrap;
        }
        .devBrushBtn {
            cursor: pointer;
            color: #00ffff;
            border: 1px solid #00ffff;
            padding: 0.05em 0.35em;
        }
        .devBrushBtn:hover, .devBrushBtn.activeRadius {
            background: #00ffff;
            color: #000000;
        }
        #devBrushStop {
            cursor: pointer;
            color: #ff5757;
            border: 1px solid #ff5757;
            padding: 0.05em 0.35em;
        }
        #devBrushStop:hover {
            background: #ff5757;
            color: #000000;
        }
        .devInlineBadge {
            display: inline-block;
            margin-left: 0.45em;
            padding: 0.05em 0.35em;
            font-size: 0.72em;
            border: 1px solid #00ffff;
            color: #00ffff;
            cursor: pointer;
            vertical-align: middle;
        }
        .devInlineBadge:hover {
            background: #00ffff;
            color: #000000;
        }
    `;
    document.head.appendChild(style);

    const devMenu = document.createElement("div");
    devMenu.id = "r74nDevMenu";
    devMenu.innerHTML = `
        <div id="r74nDevMenuHeader">
            <span id="r74nDevMenuTitle">DEV INSPECTOR</span>
            <span id="r74nDevMenuClose">X</span>
        </div>
        <div id="r74nDevMenuList"></div>
    `;
    document.body.appendChild(devMenu);

    document.getElementById("r74nDevMenuClose").onclick = () => closeDevMenu();

    function setupPanelSplitter() {
        const mapPanel = document.getElementById("mapPanel");
        const statsPanel = document.getElementById("statsPanel");
        if (!mapPanel || !statsPanel || document.getElementById("devPanelSplitter")) return;

        const parent = mapPanel.parentNode;
        const splitter = document.createElement("div");
        splitter.id = "devPanelSplitter";
        splitter.title = "Drag to resize Map & Day/Stats panel (Double-click to reset)";
        parent.insertBefore(splitter, statsPanel);

        let isDraggingSplit = false;

        splitter.addEventListener("mousedown", (e) => {
            if (!window.devMode) return;
            isDraggingSplit = true;
            splitter.classList.add("dragging");
            e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
            if (!isDraggingSplit) return;
            const rect = parent.getBoundingClientRect();
            let pct = ((e.clientX - rect.left) / rect.width) * 100;
            pct = Math.max(25, Math.min(85, pct));
            mapPanel.style.flex = `0 0 ${pct}%`;
            mapPanel.style.maxWidth = `${pct}%`;
            statsPanel.style.flex = "1 1 0%";
            statsPanel.style.maxWidth = `${100 - pct}%`;
            if (typeof window.fitToScreen === "function") window.fitToScreen();
        });

        window.addEventListener("mouseup", () => {
            if (isDraggingSplit) {
                isDraggingSplit = false;
                splitter.classList.remove("dragging");
                if (typeof window.fitToScreen === "function") window.fitToScreen();
            }
        });

        splitter.addEventListener("dblclick", () => {
            mapPanel.style.flex = "";
            mapPanel.style.maxWidth = "";
            statsPanel.style.flex = "";
            statsPanel.style.maxWidth = "";
            if (typeof window.fitToScreen === "function") window.fitToScreen();
        });
    }

    setupPanelSplitter();

    const mapDiv = document.getElementById("mapDiv");
    const brushBar = document.createElement("div");
    brushBar.id = "devBrushBar";
    brushBar.innerHTML = `
        <span id="devBrushLabel">BRUSH</span>
        <span class="devBrushBtn activeRadius" data-r="1">1x</span>
        <span class="devBrushBtn" data-r="3">3x</span>
        <span class="devBrushBtn" data-r="6">6x</span>
        <span class="devBrushBtn" data-r="10">10x</span>
        <span id="devBrushStop">STOP</span>
    `;
    if (mapDiv) {
        mapDiv.style.position = "relative";
        mapDiv.appendChild(brushBar);
    }

    let brushRadius = 1;
    brushBar.querySelectorAll(".devBrushBtn").forEach((b) => {
        b.onclick = (e) => {
            e.stopPropagation();
            brushRadius = parseInt(b.getAttribute("data-r"));
            brushBar.querySelectorAll(".devBrushBtn").forEach((el) => el.classList.remove("activeRadius"));
            b.classList.add("activeRadius");
        };
    });

    document.getElementById("devBrushStop").onclick = (e) => {
        e.stopPropagation();
        setDevBrush(null);
    };

    function setDevBrush(brushObj) {
        window.devBrush = brushObj;
        if (brushObj) {
            document.getElementById("devBrushLabel").textContent = "BRUSH: " + brushObj.label;
            brushBar.style.display = "flex";
        } else {
            brushBar.style.display = "none";
        }
    }

    function syncAll(fullTerrain = false) {
        if (fullTerrain) {
            window.updateBiomes();
            window.calculateLandmasses();
            window.renderMap();
        }
        window.renderHighlight();
        window.renderMarkers();
        window.renderCursor();
        window.updateCanvas();
        window.updateStats();
        window.refreshExecutive();
        window.autosave();
    }

    function closeDevMenu() {
        devMenu.style.display = "none";
    }

    function showDevMenu(title, items, clientX, clientY) {
        const titleEl = document.getElementById("r74nDevMenuTitle");
        const listEl = document.getElementById("r74nDevMenuList");
        titleEl.innerHTML = window.parseText(title);
        listEl.innerHTML = "";

        items.forEach((item) => {
            if (!item) return;
            if (item.section) {
                const sec = document.createElement("div");
                sec.className = "devMenuSection";
                sec.innerHTML = window.parseText(item.section);
                listEl.appendChild(sec);
                return;
            }
            const row = document.createElement("div");
            row.className = "devMenuItem" + (item.danger ? " danger" : "");
            const left = document.createElement("span");
            left.innerHTML = window.parseText(item.text);
            row.appendChild(left);

            if (item.val !== undefined) {
                const right = document.createElement("span");
                right.className = "devMenuVal";
                right.innerHTML = window.parseText(item.val.toString());
                row.appendChild(right);
            }

            row.onclick = (e) => {
                e.stopPropagation();
                if (item.keepOpen !== true) closeDevMenu();
                if (item.func) item.func(e);
            };
            listEl.appendChild(row);
        });

        devMenu.style.display = "flex";
        const rect = devMenu.getBoundingClientRect();
        let x = clientX !== undefined ? clientX : window.innerWidth / 2 - rect.width / 2;
        let y = clientY !== undefined ? clientY : window.innerHeight / 2 - rect.height / 2;
        if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
        if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
        if (x < 8) x = 8;
        if (y < 8) y = 8;
        devMenu.style.left = x + "px";
        devMenu.style.top = y + "px";
    }

    window.addEventListener("mousedown", (e) => {
        if (devMenu.style.display === "flex" && !devMenu.contains(e.target)) {
            closeDevMenu();
        }
    });

    function toggleDevMode(forceState) {
        window.devMode = forceState !== undefined ? forceState : !window.devMode;
        if (!window.devMode) {
            setDevBrush(null);
            closeDevMenu();
        }
        document.body.classList.toggle("r74n-dev-active", window.devMode);
        const btn = document.getElementById("devToggleBtn");
        if (btn) {
            btn.textContent = window.devMode ? "[DEV: ON]" : "[DEV: OFF]";
            btn.classList.toggle("active", window.devMode);
        }
        const execBtn = document.getElementById("actionItem-devMenuMain");
        if (execBtn) {
            execBtn.innerHTML = window.parseText(`<u>D</u> Dev Console: <span class="settingValue">${window.devMode ? "ON" : "OFF"}</span>`);
        }
        if (typeof window.fitToScreen === "function") window.fitToScreen();
        window.logMessage(window.devMode ? "Dev Mode enabled. Drag the cyan divider to resize panels, or click any tile, stat, or button to hack." : "Dev Mode disabled.", "tip");
    }

    function injectToggleButton() {
        const underMap = document.getElementById("underMap");
        const viewBtn = document.getElementById("viewButton");
        if (underMap && !document.getElementById("devToggleBtn")) {
            const btn = document.createElement("span");
            btn.id = "devToggleBtn";
            btn.setAttribute("role", "button");
            btn.title = "Left-click: Toggle Dev Mode | Right-click: Master Dev Hub";
            btn.textContent = window.devMode ? "[DEV: ON]" : "[DEV: OFF]";
            if (window.devMode) btn.classList.add("active");
            btn.onclick = (e) => {
                e.stopPropagation();
                toggleDevMode();
            };
            btn.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openGlobalDevHub(e.clientX, e.clientY);
            };
            if (viewBtn && viewBtn.parentNode === underMap) {
                underMap.insertBefore(btn, viewBtn);
            } else {
                underMap.appendChild(btn);
            }
        }

        const mainList = document.getElementById("actionMainList");
        if (mainList && !document.getElementById("actionItem-devMenuMain")) {
            const item = document.createElement("span");
            item.id = "actionItem-devMenuMain";
            item.className = "actionItem item clickable";
            item.setAttribute("role", "button");
            item.setAttribute("data-keybind", "d");
            item.innerHTML = window.parseText(`<u>D</u> Dev Console: <span class="settingValue">${window.devMode ? "ON" : "OFF"}</span>`);
            item.onclick = () => {
                openExecutiveDevPanel();
            };
            mainList.appendChild(item);
        }
    }

    injectToggleButton();

    const origInitExecutive = window.initExecutive;
    window.initExecutive = function () {
        origInitExecutive.apply(this, arguments);
        injectToggleButton();
    };

    function applyBrushSingle(chunk) {
        if (!chunk || !window.devBrush) return;
        const b = window.devBrush;
        const chunkSize = window.planet.config.chunkSize;

        if (b.type === "biome") {
            const targetBiome = b.value;
            chunk.b = targetBiome;
            const bData = window.biomes[targetBiome];
            const newElev = targetBiome === "water" ? Math.min(0.2, window.planet.config.waterLevel - 0.1) : targetBiome === "mountain" ? 1.0 : (bData.elevation ?? 0.6);
            chunk.e = newElev;
            if (bData.temp !== undefined) chunk.t = bData.temp;
            if (bData.moisture !== undefined) chunk.m = bData.moisture;
            for (let x = 0; x < chunkSize; x++) {
                for (let y = 0; y < chunkSize; y++) {
                    chunk.p[x][y] = newElev;
                }
            }
            if (targetBiome === "water" || targetBiome === "mountain") {
                if (chunk.v.s) {
                    const t = window.regGet("town", chunk.v.s);
                    if (t) window.happen("Unclaim", null, t, { x: chunk.x, y: chunk.y });
                }
            }
        } else if (b.type === "claim") {
            const town = window.regGet("town", b.value);
            if (!town) return;
            if (chunk.b === "water" || chunk.b === "mountain") {
                chunk.b = "grass";
                chunk.e = Math.max(0.5, window.planet.config.waterLevel + 0.1);
                for (let x = 0; x < chunkSize; x++) {
                    for (let y = 0; y < chunkSize; y++) {
                        chunk.p[x][y] = chunk.e;
                    }
                }
            }
            if (chunk.v.s !== town.id) {
                if (chunk.v.s) {
                    const prev = window.regGet("town", chunk.v.s);
                    if (prev) prev.size = Math.max(0, prev.size - 1);
                }
                chunk.v.s = town.id;
                town.size++;
                window.happen("UpdateCenter", null, town);
            }
        } else if (b.type === "unclaim") {
            if (chunk.v.s) {
                const prev = window.regGet("town", chunk.v.s);
                if (prev) window.happen("Unclaim", null, prev, { x: chunk.x, y: chunk.y });
            }
        } else if (b.type === "elev") {
            const delta = b.value;
            chunk.e = Math.max(0, Math.min(1, Math.round((chunk.e + delta) * 10) / 10));
            for (let x = 0; x < chunkSize; x++) {
                for (let y = 0; y < chunkSize; y++) {
                    chunk.p[x][y] = Math.max(0, Math.min(1, Math.round((chunk.p[x][y] + delta) * 10) / 10));
                }
            }
            if (chunk.e <= window.planet.config.waterLevel) chunk.b = "water";
            else if (chunk.e >= 1) chunk.b = "mountain";
            else if (chunk.b === "water" || chunk.b === "mountain") chunk.b = "grass";
        }
    }

    function applyBrushAtChunk(centerChunk) {
        if (!centerChunk || !window.devBrush) return;
        const targets = brushRadius > 1 ? window.circleChunks(centerChunk.x, centerChunk.y, brushRadius - 1, false) : [centerChunk];
        targets.forEach((c) => applyBrushSingle(c));
        window.renderMap();
        window.renderHighlight();
        window.updateCanvas();
    }

    window.mapCanvas.addEventListener("mousedown", (e) => {
        if (window.devBrush && e.button === 0) {
            isPaintingBrush = true;
            if (window.mousePos) {
                const c = window.chunkAt(window.mousePos.chunkX, window.mousePos.chunkY);
                applyBrushAtChunk(c);
            }
            e.stopImmediatePropagation();
        }
    }, true);

    window.mapCanvas.addEventListener("mousemove", () => {
        if (isPaintingBrush && window.devBrush && window.mousePos) {
            const c = window.chunkAt(window.mousePos.chunkX, window.mousePos.chunkY);
            applyBrushAtChunk(c);
        }
    }, true);

    window.addEventListener("mouseup", () => {
        if (isPaintingBrush) {
            isPaintingBrush = false;
            window.calculateLandmasses();
            syncAll(true);
        }
    }, true);

    window.mapCanvas.addEventListener("mouseup", (e) => {
        if (window.devBrush) {
            e.stopImmediatePropagation();
            return;
        }
        if (!window.devMode) return;
        if (e.button !== 0) return;
        if (window.lastDrag) return;
        if (window.onMapClick) return;
        if (!window.mousePos) return;

        e.stopImmediatePropagation();
        const cx = window.mousePos.chunkX;
        const cy = window.mousePos.chunkY;
        const chunk = window.chunkAt(cx, cy);
        if (!chunk) return;

        openMapContextMenu(chunk, e.clientX, e.clientY);
    }, true);

    function openMapContextMenu(chunk, x, y) {
        const items = [];
        const town = chunk.v.s ? window.regGet("town", chunk.v.s) : null;
        const marker = chunk.v.m ? window.regGet("marker", chunk.v.m) : null;
        const disaster = window.tempHover ? window.tempHover[chunk.x + "," + chunk.y] : null;

        if (town) {
            items.push({ section: `Town: ${town.name} (#${town.id})` });
            items.push({
                text: "Full Town Hack Menu...",
                val: "OPEN",
                func: () => openTownDevMenu(town, x, y)
            });
            items.push({
                text: "Open Advanced Raw Editor",
                val: "RAW",
                func: () => {
                    window.handleEdit(town);
                    window.openExecutive();
                }
            });
            items.push({
                text: "Rename Town",
                val: town.name,
                func: () => promptRenameEntity(town)
            });
            items.push({
                text: "Apply Country Preset (USA, R74n, etc.)",
                val: "PRESET",
                func: () => openSpecialCountryPicker(town, x, y)
            });
            items.push({
                text: "Set Population",
                val: town.pop,
                func: () => promptTownPop(town)
            });
            items.push({
                text: "Set Territory Size",
                val: town.size,
                func: () => promptTownSize(town)
            });
            items.push({
                text: "Paint Claim Territory Brush",
                val: "BRUSH",
                func: () => setDevBrush({ type: "claim", value: town.id, label: `Claim for ${town.name}` })
            });
            items.push({
                text: "Move Town Center Here",
                val: `${chunk.x},${chunk.y}`,
                func: () => {
                    town.center = [chunk.x, chunk.y];
                    syncAll(false);
                }
            });
            items.push({
                text: "Clone Town Elsewhere on Map",
                val: "CLONE",
                func: () => {
                    window.onMapClickMsg = window.logMessage(`Click a land tile to place a clone of {{regname:town|${town.id}}}.`, "tip");
                    window.onMapClick = () => {
                        window.fadeMessage(window.onMapClickMsg);
                        window.onMapClick = null;
                        window.onMapClickMsg = null;
                        let dest = window.chunkAt(window.mousePos.chunkX, window.mousePos.chunkY);
                        if (dest && dest.b !== "water" && dest.b !== "mountain") {
                            delete dest.v.s;
                            let clone = window.happen("Create", window.currentPlayer, null, { x: dest.x, y: dest.y, pop: town.pop }, "town");
                            if (clone) {
                                clone.name = "New " + town.name;
                                clone.color = window.colorChange(town.color);
                                clone.gov = town.gov;
                                clone.econ = town.econ;
                                clone.tax = town.tax;
                                clone.legal = window.structuredClone(town.legal);
                                clone.resources = window.structuredClone(town.resources);
                                clone.influences = window.structuredClone(town.influences);
                                syncAll(false);
                            }
                        }
                    };
                }
            });
            items.push({
                text: "Max All Town Resources & Wealth",
                val: "MAX",
                func: () => {
                    const cap = window.$c.maxResource(town);
                    ["crop", "lumber", "rock", "metal", "livestock"].forEach((r) => {
                        town.resources[r] = cap;
                    });
                    town.resources.cash = Math.max(town.resources.cash || 0, 50000);
                    town.wealth = Math.max(town.wealth || 0, 50000);
                    syncAll(false);
                }
            });
        }

        if (marker) {
            items.push({ section: `Landmark: ${marker.name || marker.subtype}` });
            items.push({
                text: "Rename Landmark",
                val: marker.name || marker.subtype,
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Rename Landmark",
                        default: marker.name || window.titleCase(marker.subtype || "Landmark"),
                        func: (res) => {
                            if (!res) return;
                            marker.name = res;
                            delete marker._named;
                            syncAll(false);
                        }
                    });
                }
            });
            items.push({
                text: "Change Landmark Symbol",
                val: marker.symbol || "⏺",
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Set Landmark Symbol",
                        default: marker.symbol || "⏺",
                        func: (res) => {
                            if (!res) return;
                            marker.symbol = res;
                            syncAll(false);
                        }
                    });
                }
            });
            items.push({
                text: "Recolor Landmark",
                val: marker.color ? window.RGBToHex(marker.color) : "#ffffff",
                func: () => promptEntityColor(marker)
            });
            items.push({
                text: "Teleport Landmark on Map",
                val: "MOVE",
                func: () => {
                    window.onMapClickMsg = window.logMessage("Click a tile on the map to teleport the landmark.", "tip");
                    window.onMapClick = () => {
                        window.fadeMessage(window.onMapClickMsg);
                        window.onMapClick = null;
                        window.onMapClickMsg = null;
                        let dest = window.chunkAt(window.mousePos.chunkX, window.mousePos.chunkY);
                        if (dest) {
                            delete chunk.v.m;
                            marker.x = dest.x;
                            marker.y = dest.y;
                            dest.v.m = marker.id;
                            if (dest.v.s) marker.town = dest.v.s;
                            syncAll(false);
                        }
                    };
                }
            });
            items.push({
                text: "Delete Landmark",
                danger: true,
                func: () => {
                    window.happen("End", null, marker);
                    syncAll(false);
                }
            });
        }

        if (disaster) {
            items.push({ section: `Disaster: ${disaster.name || disaster.subtype}` });
            items.push({
                text: "Expand Disaster Radius (+10 Chunks)",
                val: "+10",
                func: () => {
                    window.happen("AddSize", window.currentPlayer, disaster, { count: 10 });
                    syncAll(false);
                }
            });
            items.push({
                text: "End Disaster Immediately",
                danger: true,
                func: () => {
                    window.happen("Finish", null, disaster);
                    syncAll(false);
                }
            });
        }

        items.push({ section: `Chunk [${chunk.x}, ${chunk.y}]` });
        items.push({
            text: "Change Chunk Biome",
            val: window.titleCase(chunk.b),
            func: () => openBiomePickerMenu(chunk, x, y)
        });
        items.push({
            text: "Paint Biome / Map Brushes",
            val: "BRUSH",
            func: () => openBiomeBrushPicker(x, y)
        });
        items.push({
            text: "Edit Chunk Elev / Temp / Moist",
            val: `${Math.round(chunk.e * 100)}%`,
            func: () => openChunkStatsMenu(chunk, x, y)
        });
        items.push({
            text: "Terraform Circle Radius",
            val: "AREA",
            func: () => openTerraformRadiusMenu(chunk, x, y)
        });

        items.push({ section: "Spawn At Tile" });
        items.push({
            text: "Spawn New Town Here",
            val: "+",
            func: () => {
                if (chunk.b === "water" || chunk.b === "mountain") {
                    chunk.b = "grass";
                    chunk.e = Math.max(0.5, window.planet.config.waterLevel + 0.1);
                    for (let ix = 0; ix < window.planet.config.chunkSize; ix++) {
                        for (let iy = 0; iy < window.planet.config.chunkSize; iy++) {
                            chunk.p[ix][iy] = chunk.e;
                        }
                    }
                }
                delete chunk.v.s;
                const nt = window.happen("Create", window.currentPlayer, null, { x: chunk.x, y: chunk.y, pop: 25 }, "town");
                if (nt) {
                    window.planet.settled = window.planet.day;
                    window.unlockPlanet();
                    syncAll(true);
                }
            }
        });
        items.push({
            text: "Spawn Landmark Here",
            val: "+",
            func: () => openSpawnLandmarkMenu(chunk, x, y)
        });
        items.push({
            text: "Spawn Disaster Here",
            val: "+",
            func: () => openSpawnDisasterMenu(chunk, x, y)
        });

        items.push({ section: "Global Map & Camera Ops" });
        items.push({
            text: "Batch Operations (All Towns)",
            val: "BATCH",
            func: () => openBatchTownOpsMenu(x, y)
        });
        items.push({
            text: "Reset Map Zoom & Pan",
            val: `${Math.round((window.__zoom || 1) * 100)}%`,
            func: () => {
                window.__zoom = 1;
                window.__dragX = 0;
                window.__dragY = 0;
                if (window.mapCanvas) {
                    window.mapCanvas.style.scale = "1";
                    window.mapCanvas.style.translate = "0px 0px";
                }
            }
        });
        items.push({
            text: "Open Master Dev Hub",
            val: "HUB",
            func: () => openGlobalDevHub(x, y)
        });
        items.push({
            text: "Live Planet & Map Customizer",
            val: "EDIT",
            func: () => window.customizePlanet()
        });
        items.push({
            text: "Regenerate Map Seed",
            danger: true,
            func: () => {
                delete window.planet.config.seed;
                const savedName = window.planet.name;
                window.planet = window.generatePlanet(window.planet.config);
                window.planet.name = savedName;
                window.reg = window.planet.reg;
                window.updateBiomes();
                window.initGame(true);
                window.generateStarSystem(true);
                window.calculateLandmasses();
                syncAll(true);
            }
        });

        showDevMenu(`Tile [${chunk.x}, ${chunk.y}]`, items, x, y);
    }

    function openBatchTownOpsMenu(x, y) {
        const items = [
            { section: "Global Town Operations" },
            {
                text: "Max Resources & Wealth (All Towns)",
                val: "MAX",
                func: () => {
                    window.regToArray("town").forEach((t) => {
                        const cap = window.$c.maxResource(t);
                        ["crop", "lumber", "rock", "metal", "livestock"].forEach((r) => {
                            t.resources[r] = cap;
                        });
                        t.resources.cash = Math.max(t.resources.cash || 0, 50000);
                        t.wealth = Math.max(t.wealth || 0, 50000);
                    });
                    syncAll(false);
                }
            },
            {
                text: "Utopia Mode (Mood +10, Faith +10, Crime -10)",
                val: "UTOPIA",
                func: () => {
                    window.regToArray("town").forEach((t) => {
                        t.influences.happy = 10;
                        t.influences.faith = 10;
                        t.influences.crime = -10;
                        t.influences.disease = -10;
                        t.influences.hunger = -10;
                        delete t.usurp;
                    });
                    if (window.planet.usurp) window.happen("UnUsurp", null, window.currentPlayer);
                    syncAll(false);
                }
            },
            {
                text: "World Peace (End All Wars & Revolutions)",
                val: "PEACE",
                func: () => {
                    window.regFilter("process", (p) => !p.done && (p.type === "war" || p.type === "revolution" || p.type === "disaster")).forEach((p) => {
                        window.happen("Finish", null, p);
                    });
                    const allTowns = window.regToArray("town");
                    for (let i = 0; i < allTowns.length; i++) {
                        allTowns[i].issues = {};
                        for (let j = i + 1; j < allTowns.length; j++) {
                            window.happen("SetRelation", allTowns[i], allTowns[j], { amount: 10 });
                        }
                    }
                    syncAll(false);
                }
            },
            {
                text: "Double All Town Populations (2x)",
                val: "2X",
                func: () => {
                    window.regToArray("town").forEach((t) => {
                        t.pop *= 2;
                        if (!t.peakpop || t.pop > t.peakpop) t.peakpop = t.pop;
                    });
                    syncAll(false);
                }
            },
            {
                text: "Generate Flags for All Flagless Towns",
                val: "FLAGS",
                func: () => {
                    window.regToArray("town").forEach((t) => {
                        if (!t.flag) {
                            t.flag = window.gameEvents.townFlag.value(window.currentPlayer, t, {});
                        }
                    });
                    syncAll(false);
                }
            },
            {
                text: "Total World War (Every Town at War)",
                danger: true,
                func: () => {
                    const allTowns = window.regToArray("town");
                    for (let i = 0; i < allTowns.length; i++) {
                        for (let j = i + 1; j < allTowns.length; j++) {
                            window.happen("SetRelation", allTowns[i], allTowns[j], { amount: -10 });
                        }
                        if (i % 2 === 0 && allTowns[i + 1]) {
                            const proc = window.happen("Create", allTowns[i], null, {
                                type: "war",
                                towns: [allTowns[i].id, allTowns[i + 1].id]
                            }, "process");
                            allTowns[i].issues.war = proc.id;
                            allTowns[i + 1].issues.war = proc.id;
                        }
                    }
                    syncAll(false);
                }
            }
        ];
        showDevMenu("Batch Town Operations", items, x, y);
    }

    function openSpecialCountryPicker(town, x, y) {
        const keys = Object.keys(window.specialNames).filter((k) => typeof window.specialNames[k] === "object" && !window.specialNames[k].end);
        const items = keys.map((k) => ({
            text: window.titleCase(k),
            func: () => {
                window.gameEvents.townAskName.func(window.currentPlayer, town, { value: k });
                syncAll(false);
                if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
            }
        }));
        showDevMenu(`Apply Preset to ${town.name}`, items, x, y);
    }

    function openBiomePickerMenu(chunk, x, y) {
        const items = Object.keys(window.biomes).map((bKey) => ({
            text: `{{biome:${bKey}}}`,
            val: chunk.b === bKey ? "ACTIVE" : "",
            func: () => {
                const prevBrush = window.devBrush;
                window.devBrush = { type: "biome", value: bKey };
                applyBrushSingle(chunk);
                window.devBrush = prevBrush;
                window.calculateLandmasses();
                syncAll(true);
            }
        }));
        showDevMenu(`Set Biome [${chunk.x}, ${chunk.y}]`, items, x, y);
    }

    function openBiomeBrushPicker(x, y) {
        const items = Object.keys(window.biomes).map((bKey) => ({
            text: `Paint {{biome:${bKey}}}`,
            func: () => {
                setDevBrush({ type: "biome", value: bKey, label: window.titleCase(window.biomes[bKey].name || bKey) });
            }
        }));
        items.push({ section: "Territory & Elevation Brushes" });
        items.push({
            text: "Unclaim Territory Brush",
            func: () => setDevBrush({ type: "unclaim", label: "Unclaim Territory" })
        });
        items.push({
            text: "Raise Elevation Brush (+10%)",
            func: () => setDevBrush({ type: "elev", value: 0.1, label: "Raise Elevation" })
        });
        items.push({
            text: "Lower Elevation Brush (-10%)",
            func: () => setDevBrush({ type: "elev", value: -0.1, label: "Lower Elevation" })
        });
        showDevMenu("Select Map Brush", items, x, y);
    }

    function openChunkStatsMenu(chunk, x, y) {
        const chunkSize = window.planet.config.chunkSize;
        const items = [
            {
                text: "Set Elevation (0-100)",
                val: `${Math.round(chunk.e * 100)}%`,
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Chunk Elevation %",
                        default: Math.round(chunk.e * 100).toString(),
                        func: (val) => {
                            const n = Math.max(0, Math.min(100, parseFloat(val))) / 100;
                            if (isNaN(n)) return;
                            chunk.e = n;
                            for (let ix = 0; ix < chunkSize; ix++) {
                                for (let iy = 0; iy < chunkSize; iy++) {
                                    chunk.p[ix][iy] = n;
                                }
                            }
                            syncAll(true);
                        }
                    });
                }
            },
            {
                text: "Set Temperature (0-100)",
                val: `${Math.round(chunk.t * 100)}°`,
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Chunk Temperature",
                        default: Math.round(chunk.t * 100).toString(),
                        func: (val) => {
                            const n = Math.max(0, Math.min(100, parseFloat(val))) / 100;
                            if (isNaN(n)) return;
                            chunk.t = n;
                            syncAll(true);
                        }
                    });
                }
            },
            {
                text: "Set Moisture (0-100)",
                val: `${Math.round(chunk.m * 100)}%`,
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Chunk Moisture %",
                        default: Math.round(chunk.m * 100).toString(),
                        func: (val) => {
                            const n = Math.max(0, Math.min(100, parseFloat(val))) / 100;
                            if (isNaN(n)) return;
                            chunk.m = n;
                            syncAll(true);
                        }
                    });
                }
            }
        ];
        showDevMenu(`Chunk [${chunk.x}, ${chunk.y}] Stats`, items, x, y);
    }

    function openTerraformRadiusMenu(chunk, x, y) {
        const items = Object.keys(window.biomes).map((bKey) => ({
            text: `Fill Circle with {{biome:${bKey}}}`,
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: "Terraform Radius (1-30)",
                    default: "4",
                    func: (rStr) => {
                        const rad = Math.max(1, Math.min(30, parseInt(rStr)));
                        if (isNaN(rad)) return;
                        const targetChunks = window.circleChunks(chunk.x, chunk.y, rad, false);
                        const prevBrush = window.devBrush;
                        window.devBrush = { type: "biome", value: bKey };
                        targetChunks.forEach((c) => applyBrushSingle(c));
                        window.devBrush = prevBrush;
                        window.calculateLandmasses();
                        syncAll(true);
                    }
                });
            }
        }));
        showDevMenu("Terraform Circle", items, x, y);
    }

    function openSpawnLandmarkMenu(chunk, x, y) {
        const subtypes = Object.keys(window.actionables.process._projectSubtypes);
        const items = subtypes.map((st) => ({
            text: window.titleCase(st),
            val: window.actionables.process._projectSubtypes[st].symbol || "",
            func: () => {
                const data = window.actionables.process._projectSubtypes[st];
                const lm = window.happen("Create", null, null, {
                    name: window.titleCase(st),
                    type: "landmark",
                    subtype: st,
                    x: chunk.x,
                    y: chunk.y,
                    symbol: data.symbol,
                    color: data.color
                }, "marker");
                if (lm) {
                    chunk.v.m = lm.id;
                    syncAll(false);
                }
            }
        }));
        showDevMenu("Spawn Landmark", items, x, y);
    }

    function openSpawnDisasterMenu(chunk, x, y) {
        const types = Object.keys(window.actionables.process._disasterSubtypes);
        const items = types.map((dt) => ({
            text: `Spawn ${window.titleCase(dt)}`,
            danger: true,
            func: () => {
                const data = window.actionables.process._disasterSubtypes[dt];
                const affected = window.circleChunks(chunk.x, chunk.y, data.radius || 4, true);
                const dis = window.happen("Create", null, null, {
                    x: chunk.x,
                    y: chunk.y,
                    chunks: affected.map((c) => [c.x, c.y]),
                    type: "disaster",
                    subtype: dt,
                    duration: data.duration || 8
                }, "process");
                if (data.scale) dis.scale = window.choose(data.scale);
                if (data.name) dis.name = data.name(dis);
                window.logMessage(`Dev spawned {{regname:process|${dis.id}}} at [${chunk.x}, ${chunk.y}].`, "warning");
                syncAll(false);
            }
        }));
        showDevMenu("Spawn Disaster", items, x, y);
    }

    function promptRenameEntity(entity) {
        window.doPrompt({
            type: "ask",
            title: `Rename ${window.titleCase(entity._reg || "Entity")}`,
            default: entity.name || "",
            func: (res) => {
                if (!res) return;
                if (entity._reg === "town") {
                    window.happen("Rename", window.currentPlayer, entity, { value: res });
                } else {
                    entity.name = res;
                    delete entity.named;
                    delete entity._named;
                }
                syncAll(false);
                if (window.currentPopup === "regBrowser") window.regBrowse(entity._reg, entity.id);
            }
        });
    }

    function promptTownPop(town) {
        window.doPrompt({
            type: "ask",
            title: `Set ${town.name} Population`,
            default: town.pop.toString(),
            func: (res) => {
                const n = parseInt(res);
                if (isNaN(n) || n < 0) return;
                if (n === 0) {
                    window.happen("End", window.currentPlayer, town);
                } else {
                    town.pop = n;
                    if (town.peakpop === undefined || n > town.peakpop) town.peakpop = n;
                }
                syncAll(false);
                if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
            }
        });
    }

    function promptTownSize(town) {
        window.doPrompt({
            type: "ask",
            title: `Set ${town.name} Territory Size`,
            default: town.size.toString(),
            func: (res) => {
                const targetSize = Math.max(1, parseInt(res));
                if (isNaN(targetSize)) return;
                if (!town.center) window.happen("UpdateCenter", null, town);
                let diff = targetSize - town.size;
                if (diff > 0) {
                    for (let i = 0; i < diff; i++) {
                        let c = window.nearestChunk(town.center[0], town.center[1], (ch) => ch.v.s === undefined && ch.b !== "water" && ch.b !== "mountain");
                        if (!c) break;
                        c.v.s = town.id;
                        town.size++;
                    }
                } else if (diff < 0) {
                    const owned = window.filterChunks((ch) => ch.v.s === town.id);
                    owned.sort((a, b) => window.distanceCoords(b.x, b.y, town.center[0], town.center[1]) - window.distanceCoords(a.x, a.y, town.center[0], town.center[1]));
                    for (let i = 0; i < Math.abs(diff) && i < owned.length - 1; i++) {
                        window.happen("Unclaim", null, town, { x: owned[i].x, y: owned[i].y });
                    }
                }
                window.happen("UpdateCenter", null, town);
                syncAll(false);
                if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
            }
        });
    }

    function promptEntityColor(entity) {
        window.doPrompt({
            type: "ask",
            title: "Set Hex Color (#RRGGBB)",
            default: entity.color ? window.RGBToHex(entity.color) : "#ff5757",
            func: (res) => {
                if (!res) return;
                if (!res.startsWith("#")) res = "#" + res;
                const rgb = window.hexToRGB(res);
                if (!rgb) return;
                entity.color = rgb;
                syncAll(true);
                if (window.currentPopup === "regBrowser" && entity._reg) window.regBrowse(entity._reg, entity.id);
            }
        });
    }

    function openTownDevMenu(town, x, y) {
        const items = [
            { section: `${town.name} (ID #${town.id})` },
            {
                text: "Open Advanced Raw Editor",
                val: "RAW",
                func: () => {
                    window.closePopups();
                    window.handleEdit(town);
                    window.openExecutive();
                }
            },
            {
                text: "Rename Town",
                val: town.name,
                func: () => promptRenameEntity(town)
            },
            {
                text: "Edit Demonym / Adjective",
                val: town.dem || "Unset",
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: `Set ${town.name} Demonym`,
                        default: town.dem || town.name + "ian",
                        func: (res) => {
                            if (!res) return;
                            town.dem = window.titleCase(res);
                            town.dems = window.titleCase(window.wordPlural(res));
                            town.adj = window.titleCase(window.wordAdjective(res));
                            syncAll(false);
                            if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                        }
                    });
                }
            },
            {
                text: "Apply Special Country Preset",
                val: "PRESET",
                func: () => openSpecialCountryPicker(town, x, y)
            },
            {
                text: "Generate / Reroll Flag",
                val: town.flag || "NONE",
                func: () => {
                    const fl = window.gameEvents.townFlag.value(window.currentPlayer, town, {});
                    town.flag = fl;
                    syncAll(false);
                    if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                }
            },
            {
                text: "Set Population",
                val: town.pop,
                func: () => promptTownPop(town)
            },
            {
                text: "Set Territory Size",
                val: town.size,
                func: () => promptTownSize(town)
            },
            {
                text: "Change Color (Hex)",
                val: window.RGBToHex(town.color),
                func: () => promptEntityColor(town)
            },
            {
                text: "Paint Territory Brush",
                val: "BRUSH",
                func: () => setDevBrush({ type: "claim", value: town.id, label: `Claim for ${town.name}` })
            },
            {
                text: "Edit Resources & Wealth",
                val: "EDIT",
                func: () => openTownResourcesMenu(town, x, y)
            },
            {
                text: "Edit Influences (Mood, Crime, etc.)",
                val: "EDIT",
                func: () => openTownInfluencesMenu(town, x, y)
            },
            {
                text: "Edit Research Priorities",
                val: "EDIT",
                func: () => openTownResearchMenu(town, x, y)
            },
            {
                text: "Edit Laws (Legal / Illegal)",
                val: "EDIT",
                func: () => openTownLawsMenu(town, x, y)
            },
            {
                text: "Edit Diplomatic Relations",
                val: "EDIT",
                func: () => openTownRelationsMenu(town, x, y)
            },
            {
                text: "Edit Jobs",
                val: "EDIT",
                func: () => openTownJobsMenu(town, x, y)
            },
            {
                text: "Set Government / Economy / Tax",
                val: `${town.gov || "None"} / ${town.econ || "None"}`,
                func: () => openTownGovEconMenu(town, x, y)
            },
            {
                text: "Instant Build Landmark in Town...",
                val: "BUILD",
                func: () => {
                    const subtypes = Object.keys(window.actionables.process._projectSubtypes);
                    showDevMenu(`Build in ${town.name}`, subtypes.map((st) => ({
                        text: window.titleCase(st),
                        val: window.actionables.process._projectSubtypes[st].symbol || "",
                        func: () => {
                            const proj = window.happen("Create", town, null, {
                                type: "project",
                                subtype: st,
                                cost: 1
                            }, "process");
                            window.happen("Finish", null, proj);
                            syncAll(false);
                            if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                        }
                    })), x, y);
                }
            },
            {
                text: "Annex Another Town...",
                val: "ANNEX",
                func: () => {
                    const others = window.regFilter("town", (t) => t.id !== town.id);
                    if (!others.length) return;
                    showDevMenu(`Annex into ${town.name}`, others.map((ot) => ({
                        text: ot.name,
                        val: `${ot.pop} pop`,
                        func: () => {
                            window.happen("Migrate", ot, town, { count: ot.pop });
                            window.filterChunks((c) => c.v.s === ot.id).forEach((c) => {
                                window.happen("Unclaim", town, ot, { x: c.x, y: c.y });
                                c.v.s = town.id;
                                town.size++;
                            });
                            if (!ot.end) window.happen("End", null, ot);
                            window.happen("UpdateCenter", null, town);
                            syncAll(false);
                        }
                    })), x, y);
                }
            },
            {
                text: "Toggle Autonomy (Usurp)",
                val: town.usurp ? "AUTONOMOUS" : "LOYAL",
                func: () => {
                    if (town.usurp) {
                        delete town.usurp;
                        town.influences.faith = 10;
                    } else {
                        town.usurp = window.planet.day;
                        town.influences.faith = -10;
                    }
                    syncAll(false);
                    if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                }
            },
            {
                text: "Trigger Revolution",
                danger: true,
                func: () => {
                    const proc = window.happen("Create", town, null, {
                        type: "revolution",
                        town: town.id,
                        duration: 6
                    }, "process");
                    town.issues.revolution = proc.id;
                    window.logMessage(`Dev triggered a revolution in {{regname:town|${town.id}}}!`, "warning");
                    syncAll(false);
                }
            },
            {
                text: "Declare War On...",
                danger: true,
                func: () => {
                    const others = window.regFilter("town", (t) => t.id !== town.id);
                    if (!others.length) return;
                    showDevMenu("Declare War Target", others.map((ot) => ({
                        text: ot.name,
                        danger: true,
                        func: () => {
                            window.happen("SetRelation", town, ot, { amount: -10 });
                            const proc = window.happen("Create", town, null, {
                                type: "war",
                                towns: [town.id, ot.id]
                            }, "process");
                            town.issues.war = proc.id;
                            ot.issues.war = proc.id;
                            window.logMessage(`War declared between {{regname:town|${town.id}}} and {{regname:town|${ot.id}}}!`, "warning");
                            syncAll(false);
                        }
                    })), x, y);
                }
            },
            {
                text: "Destroy / Fall Town",
                danger: true,
                func: () => {
                    window.happen("End", window.currentPlayer, town);
                    syncAll(false);
                }
            }
        ];
        showDevMenu(`Hack Town: ${town.name}`, items, x, y);
    }

    function openTownResearchMenu(town, x, y) {
        const rKeys = Object.keys(window.researchInfluences);
        const items = rKeys.map((rk) => ({
            text: window.titleCase(window.researchInfluences[rk]),
            val: town.research[rk] || 0,
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: `Set ${window.titleCase(window.researchInfluences[rk])} Research (0-10)`,
                    default: (town.research[rk] || 10).toString(),
                    func: (val) => {
                        const n = Math.max(0, Math.min(10, parseInt(val)));
                        if (isNaN(n)) return;
                        if (n === 0) delete town.research[rk];
                        else town.research[rk] = n;
                        syncAll(false);
                        if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                    }
                });
            }
        }));
        showDevMenu(`${town.name} Research`, items, x, y);
    }

    function openTownLawsMenu(town, x, y) {
        const lawKeys = Object.keys(window.allLaws);
        const items = lawKeys.map((lk) => {
            const isLegal = window.happen("Legality", null, town, { law: lk });
            const label = lk.split(".").pop().replace(/_/g, " ");
            return {
                text: window.titleCase(label),
                val: isLegal ? "LEGAL" : "ILLEGAL",
                keepOpen: true,
                func: () => {
                    town.legal[lk] = !isLegal;
                    syncAll(false);
                    if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                    openTownLawsMenu(town, x, y);
                }
            };
        });
        showDevMenu(`${town.name} Laws`, items, x, y);
    }

    function openTownRelationsMenu(town, x, y) {
        const others = window.regFilter("town", (t) => t.id !== town.id);
        const items = others.map((ot) => ({
            text: ot.name,
            val: Math.round((town.relations[ot.id] || 0) * 10) / 10,
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: `Relation with ${ot.name} (-10 to 10)`,
                    default: (town.relations[ot.id] || 0).toString(),
                    func: (val) => {
                        const n = Math.max(-10, Math.min(10, parseFloat(val)));
                        if (!isNaN(n)) {
                            window.happen("SetRelation", town, ot, { amount: n });
                            syncAll(false);
                            if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                        }
                    }
                });
            }
        }));
        showDevMenu(`${town.name} Relations`, items, x, y);
    }

    function openTownResourcesMenu(town, x, y) {
        const resKeys = ["crop", "lumber", "rock", "metal", "livestock", "cash"];
        const items = resKeys.map((rk) => ({
            text: window.titleCase(rk),
            val: town.resources[rk] || 0,
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: `Set ${town.name} ${window.titleCase(rk)}`,
                    default: (town.resources[rk] || 0).toString(),
                    func: (val) => {
                        const n = Math.max(0, parseInt(val));
                        if (isNaN(n)) return;
                        if (n === 0) delete town.resources[rk];
                        else town.resources[rk] = n;
                        syncAll(false);
                        if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                    }
                });
            }
        }));
        items.push({
            text: "Private Wealth",
            val: Math.round(town.wealth || 0),
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: `Set ${town.name} Private Wealth`,
                    default: Math.round(town.wealth || 0).toString(),
                    func: (val) => {
                        const n = Math.max(0, parseInt(val));
                        if (isNaN(n)) return;
                        town.wealth = n;
                        syncAll(false);
                        if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                    }
                });
            }
        });
        showDevMenu(`${town.name} Resources`, items, x, y);
    }

    function openTownInfluencesMenu(town, x, y) {
        const infKeys = Object.keys(window.allInfluences);
        const items = infKeys.map((ik) => ({
            text: window.regBrowserKeys[ik] || window.titleCase(ik),
            val: Math.round((town.influences[ik] || 0) * 100) / 100,
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: `Set ${window.titleCase(ik)} (-10 to 10)`,
                    default: (town.influences[ik] || 0).toString(),
                    func: (val) => {
                        const n = Math.max(-10, Math.min(10, parseFloat(val)));
                        if (isNaN(n)) return;
                        town.influences[ik] = n;
                        syncAll(false);
                        if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                    }
                });
            }
        }));
        showDevMenu(`${town.name} Influences`, items, x, y);
    }

    function openTownJobsMenu(town, x, y) {
        const items = window.defaultJobs.map((jk) => ({
            text: window.titleCase(jk),
            val: town.jobs[jk] || 0,
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: `Set ${window.titleCase(jk)} Count`,
                    default: (town.jobs[jk] || 0).toString(),
                    func: (val) => {
                        const n = Math.max(0, parseInt(val));
                        if (isNaN(n)) return;
                        town.jobs[jk] = n;
                        syncAll(false);
                        if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                    }
                });
            }
        }));
        showDevMenu(`${town.name} Jobs`, items, x, y);
    }

    function openTownGovEconMenu(town, x, y) {
        const items = [{ section: "Government Form" }];
        [...Object.keys(window.govForms), "anarchy"].forEach((gf) => {
            items.push({
                text: window.titleCase(gf),
                val: town.gov === gf ? "ACTIVE" : "",
                func: () => {
                    town.gov = gf;
                    syncAll(false);
                    if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                }
            });
        });
        items.push({ section: "Economic System" });
        Object.keys(window.econForms).forEach((ef) => {
            items.push({
                text: window.titleCase(ef),
                val: town.econ === ef ? "ACTIVE" : "",
                func: () => {
                    town.econ = ef;
                    syncAll(false);
                    if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                }
            });
        });
        items.push({ section: "Taxation & Currency" });
        items.push({
            text: "Set Tax Rate % (0-100)",
            val: `${Math.round((town.tax || 0) * 100)}%`,
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: "Set Tax Rate %",
                    default: Math.round((town.tax || 0) * 100).toString(),
                    func: (val) => {
                        const n = Math.max(0, Math.min(100, parseFloat(val))) / 100;
                        if (!isNaN(n)) {
                            town.tax = n;
                            syncAll(false);
                            if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                        }
                    }
                });
            }
        });
        items.push({
            text: "Set Currency Name",
            val: town.currency || "Unset",
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: "Set Currency Name",
                    default: town.currency || "Dollar",
                    func: (val) => {
                        if (!val) return;
                        window.gameEvents.townCurrency.func(window.currentPlayer, town, { value: val });
                        syncAll(false);
                        if (window.currentPopup === "regBrowser") window.regBrowse("town", town.id);
                    }
                });
            }
        });
        showDevMenu(`${town.name} Gov & Econ`, items, x, y);
    }

    function skipDays(count) {
        const prevMode = window.planet.mode;
        window.planet.mode = window.$c.FREEPLAY;
        for (let i = 0; i < count; i++) {
            window.nextDay();
        }
        window.planet.mode = prevMode;
        syncAll(false);
    }

    function openTimeSkipMenu(x, y) {
        const items = [
            { section: `Current: Day ${window.planet.day}` },
            { text: "Advance +1 Day", val: "+1", func: () => window.nextDay() },
            { text: "Skip +5 Days", val: "+5", func: () => skipDays(5) },
            { text: "Skip +10 Days", val: "+10", func: () => skipDays(10) },
            { text: "Skip +50 Days", val: "+50", func: () => skipDays(50) },
            { text: "Skip +100 Days", val: "+100", func: () => skipDays(100) },
            {
                text: "Skip Custom Days...",
                val: "ASK",
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Skip N Days",
                        message: "Enter number of simulation days to run:",
                        default: "25",
                        func: (val) => {
                            const n = Math.max(1, Math.min(2000, parseInt(val)));
                            if (!isNaN(n)) skipDays(n);
                        }
                    });
                }
            },
            {
                text: "Set Exact Day Number...",
                val: window.planet.day,
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Set Planet Day",
                        default: window.planet.day.toString(),
                        func: (val) => {
                            const n = Math.max(1, parseInt(val));
                            if (!isNaN(n)) {
                                window.planet.day = n;
                                window.updateTitle();
                                syncAll(false);
                            }
                        }
                    });
                }
            },
            { section: "Event & Blurb Injector" },
            {
                text: "Force Trigger Any Game Event...",
                val: "RUN",
                func: () => openEventInjectorMenu(x, y)
            },
            {
                text: "Trigger Random Ambient Blurb",
                val: "BLURB",
                func: () => {
                    const caller = window.readyEvent("ambientBlurb");
                    if (caller) {
                        window.doEvent("ambientBlurb", caller);
                        if (caller.message) window.logMessage(caller.message);
                    }
                }
            }
        ];
        showDevMenu("Time & Simulation Control", items, x, y);
    }

    function openEventInjectorMenu(x, y) {
        const evKeys = Object.keys(window.gameEvents);
        const items = evKeys.map((ek) => ({
            text: ek,
            val: window.gameEvents[ek].daily ? "DAILY" : "EVENT",
            func: () => {
                const caller = window.readyEvent(ek);
                if (caller) {
                    window.doEvent(ek, caller);
                    if (caller.message) window.logMessage(caller.message);
                    syncAll(false);
                } else {
                    window.logMessage(`Event ${ek} could not find valid subject/target.`, "error");
                }
            }
        }));
        showDevMenu("Trigger Game Event", items, x, y);
    }

    function openConstantsHacker(x, y) {
        const numKeys = Object.keys(window.$c).filter((k) => typeof window.$c[k] === "number" && k !== "DEFAULT" && k !== "FREEPLAY");
        const items = numKeys.map((k) => ({
            text: k,
            val: window.$c[k],
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: `Edit $c.${k}`,
                    default: window.$c[k].toString(),
                    func: (val) => {
                        const n = parseFloat(val);
                        if (!isNaN(n)) {
                            window.$c[k] = n;
                            syncAll(false);
                        }
                    }
                });
            }
        }));
        showDevMenu("Engine Constants ($c)", items, x, y);
    }

    function openStarSystemHacker(x, y) {
        const bodies = window.regToArray("body");
        const items = [
            {
                text: "Regenerate Star System",
                val: "NEW",
                func: () => {
                    window.generateStarSystem(true);
                    syncAll(false);
                }
            },
            {
                text: "Reveal All Planets & Moons",
                val: "SHOW",
                func: () => {
                    bodies.forEach((b) => window.unhideEntity(b));
                    syncAll(false);
                }
            },
            { section: "Celestial Bodies" }
        ];
        bodies.forEach((b) => {
            items.push({
                text: `{{regname:body|${b.id}}}`,
                val: b.subtype || b.type,
                func: () => window.regBrowse("body", b.id)
            });
        });
        showDevMenu("Star System Hacker", items, x, y);
    }

    function openGlobalDevHub(x, y) {
        const items = [
            { section: "Planet & Unlocks" },
            {
                text: "Unlock Entire Tech Tree (100%)",
                val: "MAX",
                func: () => {
                    for (let type in window.unlockTree) {
                        const levels = window.unlockTree[type].levels;
                        window.planet.unlocks[type] = levels[levels.length - 1].level;
                    }
                    ["towns", "unlocks", "almanac", "projects", "stats", "timeline"].forEach((id) => window.unlockExecutive(id));
                    window.logMessage("All technologies and Executive tabs unlocked!", "milestone");
                    syncAll(false);
                }
            },
            {
                text: "Toggle Individual Unlocks...",
                val: "EDIT",
                func: () => openUnlockTreeEditor(x, y)
            },
            {
                text: "Batch Operations (All Towns)",
                val: "BATCH",
                func: () => openBatchTownOpsMenu(x, y)
            },
            {
                text: "Reveal All Undiscovered Species & Planets",
                val: "SHOW",
                func: () => {
                    window.regToArray("species").forEach((s) => {
                        window.happen("PopulateTraits", null, s);
                        if (!s.name) s.name = window.happen("RandomName", null, s);
                        window.unhideEntity(s);
                    });
                    window.regToArray("body").forEach((b) => window.unhideEntity(b));
                    window.unlockExecutive("almanac");
                    syncAll(false);
                }
            },
            {
                text: "Star System & Celestial Hacker",
                val: "SPACE",
                func: () => openStarSystemHacker(x, y)
            },
            {
                text: "Hack Engine Constants ($c)",
                val: "CONSTS",
                func: () => openConstantsHacker(x, y)
            },
            {
                text: "Switch Game Mode",
                val: window.planet.mode === window.$c.FREEPLAY ? "FREE PLAY" : "STRATEGY",
                func: () => {
                    window.planet.mode = window.planet.mode === window.$c.FREEPLAY ? window.$c.DEFAULT : window.$c.FREEPLAY;
                    window.initGame(true);
                    syncAll(false);
                }
            },
            {
                text: "Toggle Global Usurp",
                val: window.planet.usurp ? "USURPED" : "LOYAL",
                func: () => {
                    if (window.planet.usurp) window.happen("UnUsurp", null, window.currentPlayer);
                    else window.happen("Usurp", null, window.currentPlayer);
                    syncAll(false);
                }
            },
            {
                text: "Planet Generator & Dimensions",
                val: "OPEN",
                func: () => window.customizePlanet()
            },
            {
                text: "Time & Event Manipulator",
                val: `Day ${window.planet.day}`,
                func: () => openTimeSkipMenu(x, y)
            },
            {
                text: "Map Painting Brushes",
                val: "BRUSH",
                func: () => openBiomeBrushPicker(x, y)
            }
        ];
        showDevMenu("R74n Dev Master Hub", items, x, y);
    }

    function openUnlockTreeEditor(x, y) {
        const items = [];
        for (let type in window.unlockTree) {
            items.push({ section: window.titleCase(type) });
            window.unlockTree[type].levels.forEach((lvl) => {
                const isUnlocked = (window.planet.unlocks[type] || 0) >= lvl.level;
                items.push({
                    text: lvl.name,
                    val: isUnlocked ? "ON" : "OFF",
                    keepOpen: true,
                    func: () => {
                        if (isUnlocked) {
                            window.planet.unlocks[type] = lvl.level - 10;
                            if (window.planet.unlocks[type] <= 0) delete window.planet.unlocks[type];
                        } else {
                            window.planet.unlocks[type] = lvl.level;
                            window.unlockExecutive("unlocks");
                        }
                        syncAll(false);
                        openUnlockTreeEditor(x, y);
                    }
                });
            });
        }
        showDevMenu("Tech Tree Unlocks", items, x, y);
    }

    function openExecutiveDevPanel() {
        window.populateExecutive([
            {
                text: `Interactive Dev Mode: <span class="settingValue">${window.devMode ? "ON" : "OFF"}</span>`,
                func: () => {
                    toggleDevMode();
                    openExecutiveDevPanel();
                }
            },
            {
                text: "Open Master Dev Hub Popup",
                func: () => openGlobalDevHub(window.innerWidth / 2, window.innerHeight / 3)
            },
            {
                text: "Batch Town Operations (Utopia, Peace, 2x)",
                func: () => openBatchTownOpsMenu(window.innerWidth / 2, window.innerHeight / 3)
            },
            {
                text: "Unlock All Tech & Tabs",
                func: () => {
                    for (let type in window.unlockTree) {
                        const levels = window.unlockTree[type].levels;
                        window.planet.unlocks[type] = levels[levels.length - 1].level;
                    }
                    ["towns", "unlocks", "almanac", "projects", "stats", "timeline"].forEach((id) => window.unlockExecutive(id));
                    syncAll(false);
                }
            },
            {
                text: "Reveal All Hidden Species & Bodies",
                func: () => {
                    window.regToArray("species").forEach((s) => {
                        window.happen("PopulateTraits", null, s);
                        if (!s.name) s.name = window.happen("RandomName", null, s);
                        window.unhideEntity(s);
                    });
                    window.regToArray("body").forEach((b) => window.unhideEntity(b));
                    window.unlockExecutive("almanac");
                    syncAll(false);
                }
            },
            {
                text: "Map Painting Brushes",
                func: () => openBiomeBrushPicker(window.innerWidth / 2, window.innerHeight / 3)
            },
            {
                text: "Time Warp / Skip Days",
                func: () => openTimeSkipMenu(window.innerWidth / 2, window.innerHeight / 3)
            },
            {
                text: "Trigger Any Game Event",
                func: () => openEventInjectorMenu(window.innerWidth / 2, window.innerHeight / 3)
            },
            {
                text: "Hack Engine Constants ($c)",
                func: () => openConstantsHacker(window.innerWidth / 2, window.innerHeight / 3)
            },
            {
                text: "Star System & Celestial Hacker",
                func: () => openStarSystemHacker(window.innerWidth / 2, window.innerHeight / 3)
            },
            {
                text: "Live Planet Customizer",
                func: () => window.customizePlanet()
            }
        ], "Dev Console");
        window.openExecutive();
    }

    ["nextDay", "nextDayMobile"].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener("click", (e) => {
            if (window.devMode) {
                e.stopImmediatePropagation();
                e.preventDefault();
                openTimeSkipMenu(e.clientX, e.clientY);
            }
        }, true);
        btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openTimeSkipMenu(e.clientX, e.clientY);
        });
    });

    ["dayNumber", "dayNumberMobile"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("click", (e) => {
            if (!window.devMode) return;
            e.stopPropagation();
            openTimeSkipMenu(e.clientX, e.clientY);
        }, true);
    });

    const viewButton = document.getElementById("viewButton");
    if (viewButton) {
        viewButton.addEventListener("click", (e) => {
            if (!window.devMode) return;
            e.stopImmediatePropagation();
            const items = Object.keys(window.viewData).map((vk) => ({
                text: `View: ${window.titleCase(vk)}`,
                val: window.currentView === vk ? "ACTIVE" : "",
                func: () => window.setView(vk)
            }));
            items.push({ section: "Map Display Toggles" });
            items.push({
                text: "Town Names on Map",
                val: window.userSettings.townNames ? "ON" : "OFF",
                func: () => {
                    window.userSettings.townNames = !window.userSettings.townNames;
                    window.saveSettings();
                    syncAll(false);
                }
            });
            items.push({
                text: "Carve Coastline Borders",
                val: window.userSettings.carve ? "ON" : "OFF",
                func: () => {
                    window.userSettings.carve = !window.userSettings.carve;
                    window.saveSettings();
                    syncAll(false);
                }
            });
            items.push({
                text: "Show Landmarks",
                val: window.userSettings.markers !== false ? "ON" : "OFF",
                func: () => {
                    window.userSettings.markers = window.userSettings.markers === false;
                    window.saveSettings();
                    syncAll(false);
                }
            });
            items.push({
                text: "Reset Zoom & Pan",
                val: `${Math.round((window.__zoom || 1) * 100)}%`,
                func: () => {
                    window.__zoom = 1;
                    window.__dragX = 0;
                    window.__dragY = 0;
                    if (window.mapCanvas) {
                        window.mapCanvas.style.scale = "1";
                        window.mapCanvas.style.translate = "0px 0px";
                    }
                }
            });
            showDevMenu("Map View & Layers", items, e.clientX, e.clientY);
        }, true);
    }

    const planetNameEl = document.getElementById("planetName");
    if (planetNameEl) {
        planetNameEl.addEventListener("click", (e) => {
            if (!window.devMode) return;
            e.stopImmediatePropagation();
            openGlobalDevHub(e.clientX, e.clientY);
        }, true);
    }

    const statsDiv = document.getElementById("statsDiv");
    if (statsDiv) {
        statsDiv.addEventListener("click", (e) => {
            if (!window.devMode) return;
            const localStatSpan = e.target.closest(".localStats span");
            if (localStatSpan) {
                const chunkKey = window.mousePos ? `${window.mousePos.chunkX},${window.mousePos.chunkY}` : (window.selectedChunk ? `${window.selectedChunk.x},${window.selectedChunk.y}` : null);
                const chunk = window.selectedChunk || (chunkKey ? window.planet.chunks[chunkKey] : null);
                if (chunk) {
                    e.stopImmediatePropagation();
                    openChunkStatsMenu(chunk, e.clientX, e.clientY);
                    return;
                }
            }
            const entityEl = e.target.closest(".entityName[data-reg='town']");
            if (entityEl) {
                e.stopImmediatePropagation();
                const tid = parseInt(entityEl.getAttribute("data-id"));
                const town = window.regGet("town", tid);
                if (town) openTownDevMenu(town, e.clientX, e.clientY);
                return;
            }
            const tr = e.target.closest("tr");
            if (tr && !tr.classList.contains("total")) {
                const rowTownEl = tr.querySelector(".entityName[data-reg='town']");
                if (rowTownEl) {
                    e.stopImmediatePropagation();
                    const tid = parseInt(rowTownEl.getAttribute("data-id"));
                    const town = window.regGet("town", tid);
                    if (town) openTownDevMenu(town, e.clientX, e.clientY);
                }
            } else if (tr && tr.classList.contains("total")) {
                e.stopImmediatePropagation();
                openBatchTownOpsMenu(e.clientX, e.clientY);
            }
        }, true);
    }

    const actionSubList = document.getElementById("actionSubList");
    if (actionSubList) {
        actionSubList.addEventListener("click", (e) => {
            if (!window.devMode) return;
            if (window.currentExecutive && window.currentExecutive.startsWith("unlocks")) {
                const item = e.target.closest(".actionItem.item");
                if (item) {
                    e.stopImmediatePropagation();
                    openUnlockTreeEditor(e.clientX, e.clientY);
                }
            } else if (window.currentExecutive === "stats") {
                const item = e.target.closest(".actionItem.item");
                if (item && item.getAttribute("data-entity")) {
                    e.stopImmediatePropagation();
                    const ent = JSON.parse(item.getAttribute("data-entity"));
                    const statKey = Object.keys(window.regBrowserKeys).find((k) => k.startsWith("stats.") && window.regBrowserKeys[k] === ent.name);
                    if (statKey) {
                        const rawKey = statKey.split(".")[1];
                        if (window.planet.stats[rawKey] !== undefined) {
                            window.doPrompt({
                                type: "ask",
                                title: `Edit Stat: ${ent.name}`,
                                default: window.planet.stats[rawKey].toString(),
                                func: (val) => {
                                    const n = parseFloat(val);
                                    if (!isNaN(n)) {
                                        window.planet.stats[rawKey] = n;
                                        syncAll(false);
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }, true);
    }

    const origOpenRegBrowser = window.openRegBrowser;
    window.openRegBrowser = function (obj, regName) {
        origOpenRegBrowser.apply(this, arguments);
        const regContent = document.getElementById("regContent");
        if (!regContent || !obj) return;

        const titleSec = regContent.querySelector(".regSection.regTitle");
        if (titleSec) {
            const hackBtn = document.createElement("span");
            hackBtn.className = "devInlineBadge";
            hackBtn.textContent = "DEV EDIT";
            hackBtn.onclick = (e) => {
                e.stopPropagation();
                if (regName === "town" && obj.id) {
                    openTownDevMenu(obj, e.clientX, e.clientY);
                } else if (regName === "planet") {
                    openGlobalDevHub(e.clientX, e.clientY);
                } else {
                    openGenericEntityDevMenu(obj, regName, e.clientX, e.clientY);
                }
            };
            titleSec.appendChild(hackBtn);

            if (obj._reg && obj.id) {
                const rawBtn = document.createElement("span");
                rawBtn.className = "devInlineBadge";
                rawBtn.textContent = "RAW DATA";
                rawBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.closePopups();
                    window.__currentEntity = obj;
                    if (window.entityTemplates[obj.subtype] || window.entityTemplates[obj.type] || window.entityTemplates[obj._reg]) {
                        window.handleEdit(obj);
                    } else {
                        window.populateExecutive([], `Edit {{regname:${obj._reg}|${obj.id}}}`);
                    }
                    window.openExecutive();
                };
                titleSec.appendChild(rawBtn);
            }

            if (window.devMode) {
                const titleEl = titleSec.querySelector(".regTitle");
                if (titleEl) {
                    titleEl.onclick = (e) => {
                        e.stopPropagation();
                        if (regName === "planet") {
                            window.doPrompt({
                                type: "ask",
                                title: "Rename Planet",
                                default: window.planet.name,
                                func: (res) => {
                                    if (!res) return;
                                    window.planet.name = res;
                                    const b = window.regGet("body", window.planet.body);
                                    if (b) b.name = res;
                                    document.getElementById("planetName").innerHTML = window.parseText("{{planet}}");
                                    window.regBrowsePlanet();
                                    syncAll(false);
                                }
                            });
                        } else if (obj.id && regName) {
                            promptRenameEntity(obj);
                        }
                    };
                }
            }
        }

        regContent.querySelectorAll(".regSection").forEach((sec) => {
            if (sec.classList.contains("regTitle") || sec.classList.contains("regSubTitle")) return;
            sec.addEventListener("click", (e) => {
                if (!window.devMode) return;
                if (e.target.closest(".entityName")) return;
                const secTitleEl = sec.querySelector(".regSectionTitle");
                if (!secTitleEl) return;
                const label = secTitleEl.innerText.trim();
                e.stopPropagation();

                if (regName === "town") {
                    if (label === "Population") promptTownPop(obj);
                    else if (label === "Size") promptTownSize(obj);
                    else if (label === "Resources") openTownResourcesMenu(obj, e.clientX, e.clientY);
                    else if (label === "Influences") openTownInfluencesMenu(obj, e.clientX, e.clientY);
                    else if (label === "Jobs") openTownJobsMenu(obj, e.clientX, e.clientY);
                    else if (label === "Laws") openTownLawsMenu(obj, e.clientX, e.clientY);
                    else if (label === "Relations") openTownRelationsMenu(obj, e.clientX, e.clientY);
                    else if (label === "Economy") openTownGovEconMenu(obj, e.clientX, e.clientY);
                    else if (label === "Researching") openTownResearchMenu(obj, e.clientX, e.clientY);
                    else openTownDevMenu(obj, e.clientX, e.clientY);
                } else if (regName === "planet") {
                    openGlobalDevHub(e.clientX, e.clientY);
                } else {
                    openGenericEntityDevMenu(obj, regName, e.clientX, e.clientY);
                }
            });
        });
    };

    function openGenericEntityDevMenu(obj, regName, x, y) {
        const items = [
            { section: `${regName || obj.type || "Entity"} ${obj.id ? "#" + obj.id : ""}` },
            {
                text: "Open Raw Data Panel",
                val: "RAW",
                func: () => {
                    window.closePopups();
                    window.__currentEntity = obj;
                    if (window.entityTemplates[obj.subtype] || window.entityTemplates[obj.type] || window.entityTemplates[obj._reg]) {
                        window.handleEdit(obj);
                    } else {
                        window.populateExecutive([], `Edit {{regname:${obj._reg}|${obj.id}}}`);
                    }
                    window.openExecutive();
                }
            },
            {
                text: "Rename",
                val: obj.name || "Unset",
                func: () => promptRenameEntity(obj)
            }
        ];
        if (obj.color) {
            items.push({
                text: "Change Color (Hex)",
                val: window.RGBToHex(obj.color),
                func: () => promptEntityColor(obj)
            });
        }
        if (regName === "species") {
            items.push({
                text: "Set Efficiency Rate",
                val: (obj.rate || 1) + "x",
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Set Species Rate Multiplier",
                        default: (obj.rate || 1).toString(),
                        func: (val) => {
                            const n = parseFloat(val);
                            if (!isNaN(n) && n > 0) {
                                obj.rate = n;
                                obj.domesticated = window.planet.day;
                                syncAll(false);
                                window.regBrowse("species", obj.id);
                            }
                        }
                    });
                }
            });
            items.push({
                text: "Reroll Species Traits",
                val: "REROLL",
                func: () => {
                    ["habitat", "sized", "time", "texture", "ability", "speed", "horns", "offspring", "diet", "subtype", "produce"].forEach((k) => delete obj[k]);
                    window.happen("PopulateTraits", null, obj);
                    syncAll(false);
                    window.regBrowse("species", obj.id);
                }
            });
        }
        if (regName === "process" && !obj.done) {
            items.push({
                text: "Finish / Complete Immediately",
                val: "DONE",
                func: () => {
                    window.happen("Finish", null, obj);
                    syncAll(false);
                    window.closePopups();
                }
            });
        }
        items.push({
            text: "Edit Property (Key/Value)...",
            val: "JSON",
            func: () => {
                window.doPrompt({
                    type: "ask",
                    title: "Property Key",
                    message: "Keys: " + Object.keys(obj).join(", "),
                    func: (k) => {
                        if (!k) return;
                        window.doPrompt({
                            type: "ask",
                            title: `Set ${k}`,
                            default: JSON.stringify(obj[k]),
                            func: (v) => {
                                try {
                                    obj[k] = JSON.parse(v);
                                } catch {
                                    obj[k] = v;
                                }
                                syncAll(false);
                                if (regName && obj.id) window.regBrowse(regName, obj.id);
                            }
                        });
                    }
                });
            }
        });
        showDevMenu("Entity Inspector", items, x, y);
    }

    const origRegBrowseBiome = window.regBrowseBiome;
    window.regBrowseBiome = function (biomeKey) {
        origRegBrowseBiome.apply(this, arguments);
        if (!window.biomes[biomeKey]) return;
        const regContent = document.getElementById("regContent");
        if (!regContent) return;
        const titleSec = regContent.querySelector(".regSection.regTitle");
        if (titleSec) {
            const bBtn = document.createElement("span");
            bBtn.className = "devInlineBadge";
            bBtn.textContent = "HACK BIOME";
            bBtn.onclick = (e) => {
                e.stopPropagation();
                const bData = window.biomes[biomeKey];
                showDevMenu(`Biome: ${window.titleCase(bData.name || biomeKey)}`, [
                    {
                        text: "Paint This Biome on Map",
                        val: "BRUSH",
                        func: () => {
                            window.closePopups();
                            setDevBrush({ type: "biome", value: biomeKey, label: window.titleCase(bData.name || biomeKey) });
                        }
                    },
                    {
                        text: "Change Biome Color (Hex)",
                        val: window.RGBToHex(bData.colorOverride || bData.color),
                        func: () => {
                            window.doPrompt({
                                type: "ask",
                                title: "Set Biome Hex Color",
                                default: window.RGBToHex(bData.colorOverride || bData.color),
                                func: (hex) => {
                                    if (!hex) return;
                                    if (!hex.startsWith("#")) hex = "#" + hex;
                                    const rgb = window.hexToRGB(hex);
                                    if (rgb) {
                                        bData.colorOverride = rgb;
                                        syncAll(true);
                                    }
                                }
                            });
                        }
                    },
                    {
                        text: "Spawn New Species in Biome",
                        val: "+",
                        func: () => {
                            const sp = window.happen("Create", null, null, { type: "animal", biome: biomeKey, named: true }, "species");
                            window.happen("PopulateTraits", null, sp);
                            window.unlockExecutive("almanac");
                            window.regBrowseBiome(biomeKey);
                        }
                    },
                    {
                        text: "Convert All Map Chunks of This Biome...",
                        func: () => {
                            showDevMenu("Convert To Biome", Object.keys(window.biomes).map((targetB) => ({
                                text: `Convert to {{biome:${targetB}}}`,
                                func: () => {
                                    const prevBrush = window.devBrush;
                                    window.devBrush = { type: "biome", value: targetB };
                                    window.filterChunks((c) => c.b === biomeKey).forEach((c) => applyBrushSingle(c));
                                    window.devBrush = prevBrush;
                                    window.calculateLandmasses();
                                    syncAll(true);
                                }
                            })), e.clientX, e.clientY);
                        }
                    }
                ], e.clientX, e.clientY);
            };
            titleSec.appendChild(bBtn);
        }
    };

    document.getElementById("logMessages").addEventListener("click", (e) => {
        if (!window.devMode) return;
        const logMsg = e.target.closest(".logMessage");
        if (!logMsg || e.target.closest(".logAct") || e.target.closest(".entityName")) return;
        e.stopPropagation();
        const logText = logMsg.querySelector(".logText");
        showDevMenu("Hack Chronicle Entry", [
            {
                text: "Edit Message Text",
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Edit Log Text",
                        default: logText ? logText.innerText : "",
                        limit: 500,
                        func: (res) => {
                            if (res && logText) logText.innerHTML = window.parseText(res);
                        }
                    });
                }
            },
            {
                text: "Post Custom Chronicle Message...",
                func: () => {
                    window.doPrompt({
                        type: "ask",
                        title: "Inject Chronicle Message",
                        limit: 500,
                        func: (res) => {
                            if (res) window.logMessage(res, "milestone");
                        }
                    });
                }
            },
            {
                text: "Clear Entire Chronicle",
                danger: true,
                func: () => window.clearLog()
            },
            {
                text: "Delete Message",
                danger: true,
                func: () => logMsg.remove()
            }
        ], e.clientX, e.clientY);
    }, true);
});
