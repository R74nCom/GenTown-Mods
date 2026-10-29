Mod.afterLoad(function() {
    window.camX = window.camX || 0;
    window.camY = window.camY || 0;
    window.camZoom = window.camZoom || 1;

    let origFitToScreen = window.fitToScreen;
    window.fitToScreen = function() {
        if (!window.planet || !window.planet.config) return;
        if (origFitToScreen) origFitToScreen();
    };

    let canvasList = [
        window.mapCanvas,
        window.canvasLayers ? window.canvasLayers.terrain : null,
        window.canvasLayers ? window.canvasLayers.highlight : null,
        window.canvasLayers ? window.canvasLayers.markers : null,
        window.canvasLayers ? window.canvasLayers.cursor : null
    ];
    canvasList.forEach(c => {
        if (!c) return;
        c.style.transformOrigin = "";
        c.style.translate = "";
        c.style.scale = "";
    });

    let originalGeneratePlanet = window.generatePlanet;
    window.generatePlanet = function(config) {
        if (!config) config = window.defaultPlanet().config;
        config.borderFalloff = 0;
        let p = originalGeneratePlanet(config);
        p.config.borderFalloff = 0;

        const width = config.width;
        const height = config.height;
        const chunkSize = config.chunkSize;
        const waterLevel = p.config.waterLevel;
        const biomeSize = p.config.biomeSize ?? 20;
        const configTemp = p.config.temp ?? 0;
        const configMoisture = p.config.moisture ?? 0;
        const configElevation = p.config.elevation ?? 0;
        const detail = p.config.detail ?? 5;
        const smooth = 1 - (p.config.smooth ?? 0.5);
        const landmassSize = p.config.landmassSize ?? 40;
        const tuneX = -(p.config.tuneX ?? 0);
        const tuneY = -(p.config.tuneY ?? 0);
        const tuneXChunk = tuneX / chunkSize;
        const tuneYChunk = tuneY / chunkSize;

        for (let chunkX = 0; chunkX < width / chunkSize; chunkX++) {
            for (let chunkY = 0; chunkY < height / chunkSize; chunkY++) {
                let chunkKey = chunkX + "," + chunkY;
                let chunk = {
                    v: {},
                    x: chunkX,
                    y: chunkY
                };

                chunk.t = window.noise.perlin2((chunkX + tuneXChunk) / biomeSize, (chunkY + tuneYChunk) / biomeSize);
                chunk.t = (chunk.t - -0.5) / 0.8 + configTemp;
                chunk.t = Math.max(0, Math.min(chunk.t, 1));
                chunk.t = Math.ceil(chunk.t * 10) / 10;

                chunk.m = window.noise.perlin2((chunkX + 1000 + tuneXChunk) / biomeSize, (chunkY + 1000 + tuneYChunk) / biomeSize);
                chunk.m = (chunk.m - -0.5) / 0.8 + configMoisture;
                chunk.m = Math.max(0, Math.min(chunk.m, 1));
                chunk.m = Math.ceil(chunk.m * 10) / 10;

                let elevations = 0;
                let isLand = false;
                let chunkPixels = [];

                for (let x0 = 0; x0 < chunkSize; x0++) {
                    chunkPixels.push([]);
                    for (let y0 = 0; y0 < chunkSize; y0++) {
                        let x = chunkX * chunkSize + x0;
                        let y = chunkY * chunkSize + y0;
                        let value = window.generatePerlinNoise((x + tuneX) / landmassSize, (y + tuneY) / landmassSize, detail, smooth);
                        value = (value - -0.3) / 0.72;
                        value += configElevation;
                        value = Math.max(0, Math.min(1, value));
                        value = Math.ceil(value * 10) / 10;

                        chunkPixels[x0].push(value);
                        elevations += value;
                        if (value > waterLevel) isLand = true;
                    }
                }

                chunk.p = chunkPixels;
                chunk.e = elevations / (chunkSize * chunkSize);
                chunk.e = Math.ceil(chunk.e * 10) / 10;
                if (chunk.e <= waterLevel + 0.05) chunk.m = 1;

                if (!isLand || chunk.e <= waterLevel) {
                    chunk.b = "water";
                } else if (chunk.e === 1) {
                    chunk.b = "mountain";
                } else {
                    let closestBiome = "grass";
                    let closestDiff = Infinity;
                    for (let biomeKey in window.biomes) {
                        let b = window.biomes[biomeKey];
                        if (b.noAuto) continue;
                        let diff = 0;
                        if (b.elevation !== undefined) diff += Math.pow(b.elevation - chunk.e, 2);
                        if (b.temp !== undefined) diff += Math.pow(b.temp - chunk.t, 2);
                        if (b.moisture !== undefined) diff += Math.pow(b.moisture - chunk.m, 2);
                        let dist = Math.sqrt(diff);
                        if (dist < closestDiff) {
                            closestBiome = biomeKey;
                            closestDiff = dist;
                        }
                    }
                    chunk.b = closestBiome;
                }

                p.chunks[chunkKey] = chunk;
            }
        }

        return p;
    };

    let initInfiniteWorld = () => {
        if (!window.planet || !window.planet.config) return;
        window.planet.config.borderFalloff = 0;

        window.getOrGenChunk = function(cx, cy) {
            let key = cx + "," + cy;
            if (window.planet.chunks[key]) return window.planet.chunks[key];

            const chunkSize = window.planet.config.chunkSize;
            const waterLevel = window.planet.config.waterLevel;
            const biomeSize = window.planet.config.biomeSize ?? 20;
            const configTemp = window.planet.config.temp ?? 0;
            const configMoisture = window.planet.config.moisture ?? 0;
            const configElevation = window.planet.config.elevation ?? 0;
            const detail = window.planet.config.detail ?? 5;
            const smooth = 1 - (window.planet.config.smooth ?? 0.5);
            const landmassSize = window.planet.config.landmassSize ?? 40;
            const tuneX = -(window.planet.config.tuneX ?? 0);
            const tuneY = -(window.planet.config.tuneY ?? 0);
            const tuneXChunk = tuneX / chunkSize;
            const tuneYChunk = tuneY / chunkSize;

            let chunk = {
                v: {},
                x: cx,
                y: cy
            };

            chunk.t = window.noise.perlin2((cx + tuneXChunk) / biomeSize, (cy + tuneYChunk) / biomeSize);
            chunk.t = (chunk.t - -0.5) / 0.8 + configTemp;
            chunk.t = Math.max(0, Math.min(chunk.t, 1));
            chunk.t = Math.ceil(chunk.t * 10) / 10;

            chunk.m = window.noise.perlin2((cx + 1000 + tuneXChunk) / biomeSize, (cy + 1000 + tuneYChunk) / biomeSize);
            chunk.m = (chunk.m - -0.5) / 0.8 + configMoisture;
            chunk.m = Math.max(0, Math.min(chunk.m, 1));
            chunk.m = Math.ceil(chunk.m * 10) / 10;

            let elevations = 0;
            let isLand = false;
            let chunkPixels = [];

            for (let x0 = 0; x0 < chunkSize; x0++) {
                chunkPixels.push([]);
                for (let y0 = 0; y0 < chunkSize; y0++) {
                    let x = cx * chunkSize + x0;
                    let y = cy * chunkSize + y0;
                    let value = window.generatePerlinNoise((x + tuneX) / landmassSize, (y + tuneY) / landmassSize, detail, smooth);
                    value = (value - -0.3) / 0.72;
                    value += configElevation;
                    value = Math.max(0, Math.min(1, value));
                    value = Math.ceil(value * 10) / 10;

                    chunkPixels[x0].push(value);
                    elevations += value;
                    if (value > waterLevel) isLand = true;
                }
            }

            chunk.p = chunkPixels;
            chunk.e = elevations / (chunkSize * chunkSize);
            chunk.e = Math.ceil(chunk.e * 10) / 10;
            if (chunk.e <= waterLevel + 0.05) chunk.m = 1;

            if (!isLand || chunk.e <= waterLevel) {
                chunk.b = "water";
            } else if (chunk.e === 1) {
                chunk.b = "mountain";
            } else {
                let closestBiome = "grass";
                let closestDiff = Infinity;
                for (let biomeKey in window.biomes) {
                    let b = window.biomes[biomeKey];
                    if (b.noAuto) continue;
                    let diff = 0;
                    if (b.elevation !== undefined) diff += Math.pow(b.elevation - chunk.e, 2);
                    if (b.temp !== undefined) diff += Math.pow(b.temp - chunk.t, 2);
                    if (b.moisture !== undefined) diff += Math.pow(b.moisture - chunk.m, 2);
                    let dist = Math.sqrt(diff);
                    if (dist < closestDiff) {
                        closestBiome = biomeKey;
                        closestDiff = dist;
                    }
                }
                chunk.b = closestBiome;
            }

            window.planet.chunks[key] = chunk;
            return chunk;
        };

        window.chunkAt = function(x, y) {
            return window.getOrGenChunk(x, y);
        };

        window.coordsToChunk = function(x, y) {
            return Math.floor(x / window.planet.config.chunkSize) + "," + Math.floor(y / window.planet.config.chunkSize);
        };

        window.pixelAt = function(x, y) {
            let cx = Math.floor(x / window.planet.config.chunkSize);
            let cy = Math.floor(y / window.planet.config.chunkSize);
            let chunk = window.getOrGenChunk(cx, cy);
            let px = ((x % window.planet.config.chunkSize) + window.planet.config.chunkSize) % window.planet.config.chunkSize;
            let py = ((y % window.planet.config.chunkSize) + window.planet.config.chunkSize) % window.planet.config.chunkSize;
            return chunk.p[px][py];
        };

        window.renderMap = function() {
            let ctx = window.canvasLayersCtx.terrain;
            ctx.clearRect(0, 0, window.canvasLayers.terrain.width, window.canvasLayers.terrain.height);

            const chunkSize = window.planet.config.chunkSize;
            const waterLevel = window.planet.config.waterLevel;
            const viewW = window.planet.config.width * window.camZoom;
            const viewH = window.planet.config.height * window.camZoom;

            let startChunkX = Math.floor(window.camX / chunkSize);
            let endChunkX = Math.ceil((window.camX + viewW) / chunkSize);
            let startChunkY = Math.floor(window.camY / chunkSize);
            let endChunkY = Math.ceil((window.camY + viewH) / chunkSize);

            for (let cx = startChunkX; cx <= endChunkX; cx++) {
                for (let cy = startChunkY; cy <= endChunkY; cy++) {
                    let chunk = window.getOrGenChunk(cx, cy);
                    let biome = window.biomes[chunk.b] || window.biomes.water;
                    let biomeColor = biome.colorOverride || biome.color;

                    for (let x0 = 0; x0 < chunkSize; x0++) {
                        for (let y0 = 0; y0 < chunkSize; y0++) {
                            let wx = cx * chunkSize + x0;
                            let wy = cy * chunkSize + y0;
                            let sx = Math.floor((wx - window.camX) / window.camZoom);
                            let sy = Math.floor((wy - window.camY) / window.camZoom);
                            let sw = Math.max(1, Math.ceil((wx + 1 - window.camX) / window.camZoom) - sx);
                            let sh = Math.max(1, Math.ceil((wy + 1 - window.camY) / window.camZoom) - sy);

                            if (sx + sw <= 0 || sx >= window.planet.config.width || sy + sh <= 0 || sy >= window.planet.config.height) continue;

                            let value = chunk.p[x0][y0];

                            if (window.viewData[window.currentView].showTerrain === true) {
                                let pixelColor = biomeColor;
                                let isWater = chunk.b === "water";

                                if (y0 === chunkSize - 1 && Math.sin((cx + x0) * 167) < 0.5) {
                                    let adj = window.getOrGenChunk(cx, cy + 1);
                                    if (adj && window.biomes[adj.b]) {
                                        pixelColor = window.biomes[adj.b].colorOverride || window.biomes[adj.b].color;
                                        value = adj.p[x0][0];
                                        isWater = window.compareWater[adj.b];
                                    }
                                } else if (x0 === chunkSize - 1 && Math.sin((cy + y0) * 167) < 0.5) {
                                    let adj = window.getOrGenChunk(cx + 1, cy);
                                    if (adj && window.biomes[adj.b]) {
                                        pixelColor = window.biomes[adj.b].colorOverride || window.biomes[adj.b].color;
                                        value = adj.p[0][y0];
                                        isWater = window.compareWater[adj.b];
                                    }
                                }

                                let color;
                                if (value <= waterLevel || (isWater && value === 0.5)) {
                                    value += 1 - waterLevel - 0.1;
                                    value = Math.max(value, 0);
                                    color = window.waterColors[Math.min(window.waterColors.length - 1, Math.floor(value * window.waterColors.length))];
                                } else {
                                    let percent = value - (waterLevel - window.$c.defaultWaterLevel);
                                    color = [pixelColor[0] * percent + 50, pixelColor[1] * percent + 50, pixelColor[2] * percent + 50];
                                }

                                if (window.userSettings.desaturate) {
                                    let hsl = window.RGBtoHSL(color);
                                    hsl[1] *= 0.7;
                                    color = window.HSLtoRGB(hsl);
                                }

                                ctx.fillStyle = "rgb(" + color.join(",") + ")";
                                ctx.fillRect(sx, sy, sw, sh);
                            }

                            if (window.viewData[window.currentView].pixelColor !== undefined) {
                                let color = window.viewData[window.currentView].pixelColor(value);
                                if (color) {
                                    ctx.fillStyle = window.viewData[window.currentView].colorFunction + color.join(",") + ")";
                                    ctx.fillRect(sx, sy, sw, sh);
                                }
                            }
                        }
                    }

                    if (window.viewData[window.currentView].chunkColor !== undefined) {
                        let color = window.viewData[window.currentView].chunkColor(chunk);
                        if (color) {
                            let csx = Math.floor((cx * chunkSize - window.camX) / window.camZoom);
                            let csy = Math.floor((cy * chunkSize - window.camY) / window.camZoom);
                            let csw = Math.max(1, Math.ceil(((cx + 1) * chunkSize - window.camX) / window.camZoom) - csx);
                            let csh = Math.max(1, Math.ceil(((cy + 1) * chunkSize - window.camY) / window.camZoom) - csy);
                            ctx.fillStyle = window.viewData[window.currentView].colorFunction + color.join(",") + ")";
                            ctx.fillRect(csx, csy, csw, csh);
                        }
                    }
                }
            }
        };

        window.renderHighlight = function() {
            if (!window.viewData[window.currentView].showHighlight) return;
            window.tempHover = {};

            let ctx = window.canvasLayersCtx.highlight;
            ctx.clearRect(0, 0, window.canvasLayers.highlight.width, window.canvasLayers.highlight.height);

            const chunkSize = window.planet.config.chunkSize;
            const waterLevel = window.planet.config.waterLevel;
            const viewW = window.planet.config.width;
            const viewH = window.planet.config.height;

            let chunks = window.filterChunks((c) => c.v.s !== undefined);
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                let sx = Math.floor((chunk.x * chunkSize - window.camX) / window.camZoom);
                let sy = Math.floor((chunk.y * chunkSize - window.camY) / window.camZoom);
                let sw = Math.max(1, Math.ceil(((chunk.x + 1) * chunkSize - window.camX) / window.camZoom) - sx);
                let sh = Math.max(1, Math.ceil(((chunk.y + 1) * chunkSize - window.camY) / window.camZoom) - sy);
                if (sx + sw < 0 || sx >= viewW || sy + sh < 0 || sy >= viewH) continue;

                const town = window.regGet("town", chunk.v.s);
                if (!town) continue;

                let color = town.color;
                let opacity = window.userSettings.opacity || 0.5;
                if (window.currentHighlight && window.currentHighlight[1] === chunk.v.s && window.currentHighlight[0] === "town") {
                    color = window.colorBrightness(color, 1.15);
                    opacity *= 1.5;
                }
                if (town.usurp) {
                    color = [...color];
                    let avg = (color[0] + color[1] + color[2]) / 3;
                    color[0] += (avg - color[0]) * 0.75;
                    color[1] += (avg - color[1]) * 0.75;
                    color[2] += (avg - color[2]) * 0.75;
                }

                ctx.fillStyle = "rgba(" + color.join(",") + "," + opacity + ")";
                ctx.fillRect(sx, sy, sw, sh);

                ctx.fillStyle = "rgb(" + color.join(",") + ")";
                let bt = Math.max(1, Math.round(1 / window.camZoom));
                for (let j = 0; j < window.adjacentCoords.length; j++) {
                    const coords = window.adjacentCoords[j];
                    const adj = window.getOrGenChunk(chunk.x + coords[0], chunk.y + coords[1]);
                    if (adj !== undefined && adj.v.s !== chunk.v.s) {
                        if (coords[0] === -1) ctx.fillRect(sx, sy, bt, sh);
                        else if (coords[0] === 1) ctx.fillRect(sx + sw - bt, sy, bt, sh);
                        else if (coords[1] === -1) ctx.fillRect(sx, sy, sw, bt);
                        else if (coords[1] === 1) ctx.fillRect(sx, sy + sh - bt, sw, bt);
                    }
                }

                if (window.userSettings.carve) {
                    for (let x = 0; x < chunk.p.length; x++) {
                        for (let y = 0; y < chunk.p[x].length; y++) {
                            let absX = chunkSize * chunk.x + x;
                            let absY = chunkSize * chunk.y + y;
                            let psx = Math.floor((absX - window.camX) / window.camZoom);
                            let psy = Math.floor((absY - window.camY) / window.camZoom);
                            let psw = Math.max(1, Math.ceil((absX + 1 - window.camX) / window.camZoom) - psx);
                            let psh = Math.max(1, Math.ceil((absY + 1 - window.camY) / window.camZoom) - psy);
                            let adjacent = false;
                            for (let k = 0; k < window.adjacentCoords.length; k++) {
                                let adjPixel = window.pixelAt(absX + window.adjacentCoords[k][0], absY + window.adjacentCoords[k][1]);
                                if (adjPixel <= waterLevel) {
                                    adjacent = true;
                                    break;
                                }
                            }
                            if (chunk.p[x][y] <= waterLevel) {
                                ctx.clearRect(psx, psy, psw, psh);
                            } else if (adjacent === true) {
                                ctx.fillRect(psx, psy, psw, psh);
                            }
                        }
                    }
                }
            }

            const disasters = window.regFilter("process", (p) => p.done === undefined && p.type === "disaster");
            for (let i = 0; i < disasters.length; i++) {
                const disaster = disasters[i];
                let color = disaster.color || [255, 0, 0];
                if (window.currentHighlight && window.currentHighlight[1] === disaster.id && window.currentHighlight[0] === "process") {
                    color = window.colorBrightness(color, 1.15);
                }
                if (Array.isArray(disaster.chunks)) {
                    let dChunks = {};
                    disaster.chunks.forEach((coords) => {
                        dChunks[coords[0] + "," + coords[1]] = true;
                        window.tempHover[coords[0] + "," + coords[1]] = disaster;
                    });
                    disaster.chunks.forEach((chunkCoords) => {
                        let sx = Math.floor((chunkCoords[0] * chunkSize - window.camX) / window.camZoom);
                        let sy = Math.floor((chunkCoords[1] * chunkSize - window.camY) / window.camZoom);
                        let sw = Math.max(1, Math.ceil(((chunkCoords[0] + 1) * chunkSize - window.camX) / window.camZoom) - sx);
                        let sh = Math.max(1, Math.ceil(((chunkCoords[1] + 1) * chunkSize - window.camY) / window.camZoom) - sy);
                        if (sx + sw < 0 || sx >= viewW || sy + sh < 0 || sy >= viewH) return;

                        ctx.fillStyle = "rgba(" + color.join(",") + ", 0.66)";
                        ctx.fillRect(sx, sy, sw, sh);

                        ctx.fillStyle = "rgba(0, 0, 0, 0.66)";
                        let bt = Math.max(1, Math.round(1 / window.camZoom));
                        for (let j = 0; j < window.adjacentCoords.length; j++) {
                            const coords = window.adjacentCoords[j];
                            if (!dChunks[(chunkCoords[0] + coords[0]) + "," + (chunkCoords[1] + coords[1])]) {
                                if (coords[0] === -1) ctx.fillRect(sx, sy, bt, sh);
                                else if (coords[0] === 1) ctx.fillRect(sx + sw - bt, sy, bt, sh);
                                else if (coords[1] === -1) ctx.fillRect(sx, sy, sw, bt);
                                else if (coords[1] === 1) ctx.fillRect(sx, sy + sh - bt, sw, bt);
                            }
                        }
                    });
                }
            }

            window.renderMarkers();
        };

        window.renderMarkers = function() {
            if (!window.viewData[window.currentView].showMarkers) return;

            let ctx = window.canvasLayersCtx.markers;
            ctx.clearRect(0, 0, window.canvasLayers.markers.width, window.canvasLayers.markers.height);
            const res = window.planet.config.pixelSize * window.$c.markerResolution;
            const _chunkSize = (window.planet.config.chunkSize * res) / window.camZoom;
            const viewW = window.planet.config.width * res;
            const viewH = window.planet.config.height * res;

            if (ctx.textAlign !== "center") {
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
            }
            ctx.font = Math.max(1, _chunkSize) + "px PublicPixel";

            let markers = window.userSettings.markers === false ? [] : window.regToArray("marker");
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                if (marker.x === undefined || marker.y === undefined) continue;
                let sx = ((marker.x * window.planet.config.chunkSize - window.camX) * res) / window.camZoom;
                let sy = ((marker.y * window.planet.config.chunkSize - window.camY) * res) / window.camZoom;
                if (sx + _chunkSize < 0 || sx >= viewW || sy + _chunkSize < 0 || sy >= viewH) continue;

                const symbol = marker.symbol || "⏺";
                let color = marker.color || [176, 176, 153];
                let highlight = window.currentHighlight && window.currentHighlight[1] === marker.id && window.currentHighlight[0] === "marker";
                if (highlight) {
                    color = window.colorBrightness(color, 1.2);
                    ctx.font = Math.max(1, _chunkSize * 1.5) + "px PublicPixel";
                }

                let offset = (window.planet.config.pixelSize / 1.5) / window.camZoom;
                ctx.strokeStyle = "rgb(" + window.colorBrightness(color, 0.8) + ")";
                ctx.lineWidth = Math.max(1, (window.planet.config.pixelSize * 2) / window.camZoom);
                ctx.strokeText(symbol, sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);
                ctx.fillStyle = "rgb(" + color.join(",") + ")";
                ctx.fillText(symbol, sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);

                if (highlight) ctx.font = Math.max(1, _chunkSize) + "px PublicPixel";
            }

            ctx.strokeStyle = "rgb(0,0,0)";
            window.regToArray("town").forEach((town) => {
                if (!town.center) window.happen("UpdateCenter", null, town);
                let hasIssue = Object.values(town.issues).length;
                let sx = ((town.center[0] * window.planet.config.chunkSize - window.camX) * res) / window.camZoom;
                let sy = ((town.center[1] * window.planet.config.chunkSize - window.camY) * res) / window.camZoom;
                if (sx + _chunkSize < -200 || sx >= viewW + 200 || sy + _chunkSize < -200 || sy >= viewH + 200) return;

                let offset = (window.planet.config.pixelSize / 1.5) / window.camZoom;
                if ((window.userSettings.townNames && !window.controlState.shift) || (window.controlState.shift && !window.userSettings.townNames)) {
                    let name = town.name;
                    if (hasIssue) {
                        ctx.strokeStyle = "rgb(255, 0, 0)";
                        ctx.fillStyle = "rgb(255, 255, 0)";
                    } else {
                        ctx.strokeStyle = "rgb(0,0,0)";
                        ctx.fillStyle = "rgb(" + town.color.join(",") + ")";
                    }
                    let fontSize = Math.max(8, Math.round(Math.max(64, Math.round(Math.min(town.size, 100) / 100 * 96)) / window.camZoom));
                    ctx.font = (town.usurp ? "italic " : "") + fontSize + "px VT323";
                    ctx.lineWidth = Math.max(1, (window.planet.config.pixelSize * 2.5) / window.camZoom);
                    ctx.strokeText(name, sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);
                    ctx.fillText(name, sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);
                } else if (hasIssue && window.userSettings.markers !== false) {
                    ctx.lineWidth = Math.max(1, (window.planet.config.pixelSize * 3) / window.camZoom);
                    ctx.strokeStyle = "rgb(255, 0, 0)";
                    ctx.fillStyle = "rgb(255, 255, 0)";
                    let fontSize = Math.max(12, Math.round(Math.max(112, Math.round(Math.min(town.size, 128) / 100 * 96)) / window.camZoom));
                    ctx.font = (town.usurp ? "italic " : "") + fontSize + "px VT323";
                    ctx.strokeText("!".repeat(hasIssue), sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);
                    ctx.fillText("!".repeat(hasIssue), sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);
                }
            });
        };

        window.renderCursor = function() {
            let ctx = window.canvasLayersCtx.cursor;
            ctx.clearRect(0, 0, window.canvasLayers.cursor.width, window.canvasLayers.cursor.height);
            const chunkSize = window.planet.config.chunkSize;
            if (window.mousePos) {
                let sx = Math.floor((window.mousePos.chunkX * chunkSize - window.camX) / window.camZoom);
                let sy = Math.floor((window.mousePos.chunkY * chunkSize - window.camY) / window.camZoom);
                let sw = Math.max(1, Math.ceil(((window.mousePos.chunkX + 1) * chunkSize - window.camX) / window.camZoom) - sx);
                let sh = Math.max(1, Math.ceil(((window.mousePos.chunkY + 1) * chunkSize - window.camY) / window.camZoom) - sy);
                ctx.fillStyle = "rgba(240,240,240,0.5)";
                ctx.fillRect(sx, sy, sw, sh);
            }
            if (window.selectedChunk) {
                let sx = Math.floor((window.selectedChunk.x * chunkSize - window.camX) / window.camZoom);
                let sy = Math.floor((window.selectedChunk.y * chunkSize - window.camY) / window.camZoom);
                let sw = Math.max(1, Math.ceil(((window.selectedChunk.x + 1) * chunkSize - window.camX) / window.camZoom) - sx);
                let sh = Math.max(1, Math.ceil(((window.selectedChunk.y + 1) * chunkSize - window.camY) / window.camZoom) - sy);
                ctx.fillStyle = "rgba(240,240,240,0.8)";
                ctx.fillRect(sx, sy, sw, sh);
            }
        };

        window.handleCursor = function(e) {
            const rect = window.mapCanvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;

            let screenX = Math.floor((x / window.mapCanvas.clientWidth) * (window.planet.config.width * window.camZoom));
            let screenY = Math.floor((y / window.mapCanvas.clientHeight) * (window.planet.config.height * window.camZoom));

            let worldX = screenX + window.camX;
            let worldY = screenY + window.camY;

            let chunkX = Math.floor(worldX / window.planet.config.chunkSize);
            let chunkY = Math.floor(worldY / window.planet.config.chunkSize);

            let oldChunkX = window.mousePos ? window.mousePos.chunkX : null;
            let oldChunkY = window.mousePos ? window.mousePos.chunkY : null;

            window.mousePos = {
                x: worldX,
                y: worldY,
                chunkX: chunkX,
                chunkY: chunkY
            };

            let chunk = window.getOrGenChunk(chunkX, chunkY);
            let chunkKey = chunkX + "," + chunkY;
            let hovered = false;
            let highlight = null;

            if (window.viewData[window.currentView].hover) {
                hovered = !window.viewData[window.currentView].hover(chunk);
            } else if (window.tempHover[chunkKey]) {
                hovered = true;
                highlight = ["process", window.tempHover[chunkKey].id];
            } else if (chunk.v.s) {
                hovered = true;
                highlight = ["town", chunk.v.s];
            }

            if (chunk.v.m) {
                highlight = ["marker", chunk.v.m];
            }

            window.mapCanvas.style.cursor = hovered ? "pointer" : "";

            if (!window.currentHighlight || !highlight || (highlight[0] !== window.currentHighlight[0] || highlight[1] !== window.currentHighlight[1])) {
                window.currentHighlight = highlight;
                window.renderHighlight();
                window.updateCanvas();
            }

            if (oldChunkX !== chunkX || oldChunkY !== chunkY) {
                window.renderCursor();
                window.updateCanvas();
                window.updateStats();
            }
        };

        window.mapCanvas.onwheel = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = window.mapCanvas.getBoundingClientRect();
            let mouseNormX = (e.clientX - rect.left) / window.mapCanvas.clientWidth;
            let mouseNormY = (e.clientY - rect.top) / window.mapCanvas.clientHeight;

            let oldZoom = window.camZoom;
            let factor = e.deltaY < 0 ? 0.8 : 1.25;
            let newZoom = Math.max(0.2, Math.min(25, oldZoom * factor));

            if (newZoom === oldZoom) return;

            let focusWorldX = window.camX + mouseNormX * (window.planet.config.width * oldZoom);
            let focusWorldY = window.camY + mouseNormY * (window.planet.config.height * oldZoom);

            window.camZoom = newZoom;
            window.camX = Math.round(focusWorldX - mouseNormX * (window.planet.config.width * newZoom));
            window.camY = Math.round(focusWorldY - mouseNormY * (window.planet.config.height * newZoom));

            window.renderMap();
            window.renderHighlight();
            window.renderCursor();
            window.updateCanvas();
            window.updateStats();
        };

        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let camStartX = 0;
        let camStartY = 0;

        window.mapCanvas.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };

        window.mapCanvas.onmousedown = (e) => {
            if (e.button === 0 || e.button === 2) {
                isPanning = true;
                panStartX = e.clientX;
                panStartY = e.clientY;
                camStartX = window.camX;
                camStartY = window.camY;
            }
        };

        window.addEventListener("mousemove", (e) => {
            if (isPanning) {
                let dx = e.clientX - panStartX;
                let dy = e.clientY - panStartY;
                let scaleX = (window.planet.config.width * window.camZoom) / window.mapCanvas.clientWidth;
                let scaleY = (window.planet.config.height * window.camZoom) / window.mapCanvas.clientHeight;

                window.camX = Math.round(camStartX - dx * scaleX);
                window.camY = Math.round(camStartY - dy * scaleY);

                window.renderMap();
                window.renderHighlight();
                window.renderCursor();
                window.updateCanvas();
                window.updateStats();
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (isPanning) {
                let dist = Math.hypot(e.clientX - panStartX, e.clientY - panStartY);
                isPanning = false;
                if (dist > 5) {
                    window.lastDrag = true;
                    return;
                }
            }
        });

        window.handleMouseUp = function(e) {
            window.handleCursor(e);

            if (window.lastDrag) {
                window.lastDrag = null;
                return;
            }

            let chunk = window.getOrGenChunk(window.mousePos.chunkX, window.mousePos.chunkY);
            let chunkKey = window.mousePos.chunkX + "," + window.mousePos.chunkY;

            if (e.button === 0 || e.force !== undefined) {
                if (window.onMapClick) {
                    window.onMapClick(e);
                } else if (window.selectedChunk) {
                    window.deselectChunk();
                } else if (window.tempHover[chunkKey]) {
                    let entity = window.tempHover[chunkKey];
                    window.regBrowse(entity._reg, entity.id);
                } else if (chunk) {
                    if (window.viewData[window.currentView].click) window.viewData[window.currentView].click(chunk);
                    else if (chunk.v.m) window.regBrowse("marker", chunk.v.m);
                    else if (chunk.v.s) window.regBrowse("town", chunk.v.s);
                }
            } else if (e.button === 2) {
                if (window.selectedChunk) {
                    window.deselectChunk();
                } else if (window.mousePos) {
                    window.selectedChunk = chunk;
                    document.querySelector("#statsPanel .panelX").style.display = "flex";
                }
            }

            window.updateStats();
            window.renderCursor();
            window.updateCanvas();
        };

        window.renderMap();
        window.renderHighlight();
        window.renderCursor();
        window.updateCanvas();
        window.logMessage("Infinite world initialized.", "tip");
    };

    let regenerateWorld = () => {
        window.planet.config.borderFalloff = 0;
        delete window.planet.config.seed;
        window.planet.chunks = {};
        window.camX = 0;
        window.camY = 0;
        window.camZoom = 1;
        window.planet = window.generatePlanet(window.planet.config);
        window.planet.config.borderFalloff = 0;
        window.reg = window.planet.reg;
        window.updateBiomes();
        window.initGame(true);
        window.generateStarSystem(true);
        window.calculateLandmasses();
        initInfiniteWorld();
    };

    let hasColonies = window.regCount("town") > 0;
    if (hasColonies) {
        window.doPrompt({
            type: "confirm",
            title: "Reset Infinite World",
            message: "A colony has already been founded on this planet. Regenerating will remove the border water falloff but delete current progress. Do you want to reset and regenerate?",
            danger: true,
            func: (confirmed) => {
                if (confirmed) {
                    regenerateWorld();
                } else {
                    initInfiniteWorld();
                }
            }
        });
    } else {
        regenerateWorld();
    }
});
