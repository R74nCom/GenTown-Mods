Mod.afterLoad(function() {
    window.camX = window.camX || 0;
    window.camY = window.camY || 0;
    window.camZoom = window.camZoom || 1;

    let origFitToScreen = window.fitToScreen;
    window.fitToScreen = function() {
        if (!planet || !planet.config) return;
        origFitToScreen();
    };

    let canvasList = [mapCanvas, canvasLayers.terrain, canvasLayers.highlight, canvasLayers.markers, canvasLayers.cursor];
    canvasList.forEach(c => {
        if (!c) return;
        c.style.transformOrigin = "";
        c.style.translate = "";
        c.style.scale = "";
    });

    let originalGeneratePlanet = window.generatePlanet;
    window.generatePlanet = function(config) {
        if (!config) config = defaultPlanet().config;
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

                chunk.t = noise.perlin2((chunkX + tuneXChunk) / biomeSize, (chunkY + tuneYChunk) / biomeSize);
                chunk.t = (chunk.t - -0.5) / 0.8 + configTemp;
                chunk.t = Math.max(0, Math.min(chunk.t, 1));
                chunk.t = Math.ceil(chunk.t * 10) / 10;

                chunk.m = noise.perlin2((chunkX + 1000 + tuneXChunk) / biomeSize, (chunkY + 1000 + tuneYChunk) / biomeSize);
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
                        let value = generatePerlinNoise((x + tuneX) / landmassSize, (y + tuneY) / landmassSize, detail, smooth);
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
                    for (let biomeKey in biomes) {
                        let b = biomes[biomeKey];
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
        if (!planet || !planet.config) return;
        planet.config.borderFalloff = 0;

        window.getOrGenChunk = function(cx, cy) {
            let key = cx + "," + cy;
            if (planet.chunks[key]) return planet.chunks[key];

            const chunkSize = planet.config.chunkSize;
            const waterLevel = planet.config.waterLevel;
            const biomeSize = planet.config.biomeSize ?? 20;
            const configTemp = planet.config.temp ?? 0;
            const configMoisture = planet.config.moisture ?? 0;
            const configElevation = planet.config.elevation ?? 0;
            const detail = planet.config.detail ?? 5;
            const smooth = 1 - (planet.config.smooth ?? 0.5);
            const landmassSize = planet.config.landmassSize ?? 40;
            const tuneX = -(planet.config.tuneX ?? 0);
            const tuneY = -(planet.config.tuneY ?? 0);
            const tuneXChunk = tuneX / chunkSize;
            const tuneYChunk = tuneY / chunkSize;

            let chunk = {
                v: {},
                x: cx,
                y: cy
            };

            chunk.t = noise.perlin2((cx + tuneXChunk) / biomeSize, (cy + tuneYChunk) / biomeSize);
            chunk.t = (chunk.t - -0.5) / 0.8 + configTemp;
            chunk.t = Math.max(0, Math.min(chunk.t, 1));
            chunk.t = Math.ceil(chunk.t * 10) / 10;

            chunk.m = noise.perlin2((cx + 1000 + tuneXChunk) / biomeSize, (cy + 1000 + tuneYChunk) / biomeSize);
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
                    let value = generatePerlinNoise((x + tuneX) / landmassSize, (y + tuneY) / landmassSize, detail, smooth);
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
                for (let biomeKey in biomes) {
                    let b = biomes[biomeKey];
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

            planet.chunks[key] = chunk;
            return chunk;
        };

        window.chunkAt = function(x, y) {
            return window.getOrGenChunk(x, y);
        };

        window.coordsToChunk = function(x, y) {
            return Math.floor(x / planet.config.chunkSize) + "," + Math.floor(y / planet.config.chunkSize);
        };

        window.pixelAt = function(x, y) {
            let cx = Math.floor(x / planet.config.chunkSize);
            let cy = Math.floor(y / planet.config.chunkSize);
            let chunk = window.getOrGenChunk(cx, cy);
            let px = ((x % planet.config.chunkSize) + planet.config.chunkSize) % planet.config.chunkSize;
            let py = ((y % planet.config.chunkSize) + planet.config.chunkSize) % planet.config.chunkSize;
            return chunk.p[px][py];
        };

        window.renderMap = function() {
            let ctx = canvasLayersCtx.terrain;
            ctx.clearRect(0, 0, canvasLayers.terrain.width, canvasLayers.terrain.height);

            const chunkSize = planet.config.chunkSize;
            const waterLevel = planet.config.waterLevel;
            const viewW = planet.config.width * window.camZoom;
            const viewH = planet.config.height * window.camZoom;

            let startChunkX = Math.floor(window.camX / chunkSize);
            let endChunkX = Math.ceil((window.camX + viewW) / chunkSize);
            let startChunkY = Math.floor(window.camY / chunkSize);
            let endChunkY = Math.ceil((window.camY + viewH) / chunkSize);

            for (let cx = startChunkX; cx <= endChunkX; cx++) {
                for (let cy = startChunkY; cy <= endChunkY; cy++) {
                    let chunk = window.getOrGenChunk(cx, cy);
                    let biome = biomes[chunk.b] || biomes.water;
                    let biomeColor = biome.colorOverride || biome.color;

                    for (let x0 = 0; x0 < chunkSize; x0++) {
                        for (let y0 = 0; y0 < chunkSize; y0++) {
                            let wx = cx * chunkSize + x0;
                            let wy = cy * chunkSize + y0;
                            let sx = Math.floor((wx - window.camX) / window.camZoom);
                            let sy = Math.floor((wy - window.camY) / window.camZoom);
                            let sw = Math.max(1, Math.ceil((wx + 1 - window.camX) / window.camZoom) - sx);
                            let sh = Math.max(1, Math.ceil((wy + 1 - window.camY) / window.camZoom) - sy);

                            if (sx + sw <= 0 || sx >= planet.config.width || sy + sh <= 0 || sy >= planet.config.height) continue;

                            let value = chunk.p[x0][y0];

                            if (viewData[currentView].showTerrain === true) {
                                let pixelColor = biomeColor;
                                let isWater = chunk.b === "water";

                                if (y0 === chunkSize - 1 && Math.sin((cx + x0) * 167) < 0.5) {
                                    let adj = window.getOrGenChunk(cx, cy + 1);
                                    if (adj && biomes[adj.b]) {
                                        pixelColor = biomes[adj.b].colorOverride || biomes[adj.b].color;
                                        value = adj.p[x0][0];
                                        isWater = compareWater[adj.b];
                                    }
                                } else if (x0 === chunkSize - 1 && Math.sin((cy + y0) * 167) < 0.5) {
                                    let adj = window.getOrGenChunk(cx + 1, cy);
                                    if (adj && biomes[adj.b]) {
                                        pixelColor = biomes[adj.b].colorOverride || biomes[adj.b].color;
                                        value = adj.p[0][y0];
                                        isWater = compareWater[adj.b];
                                    }
                                }

                                let color;
                                if (value <= waterLevel || (isWater && value === 0.5)) {
                                    value += 1 - waterLevel - 0.1;
                                    value = Math.max(value, 0);
                                    color = waterColors[Math.min(waterColors.length - 1, Math.floor(value * waterColors.length))];
                                } else {
                                    let percent = value - (waterLevel - $c.defaultWaterLevel);
                                    color = [pixelColor[0] * percent + 50, pixelColor[1] * percent + 50, pixelColor[2] * percent + 50];
                                }

                                if (userSettings.desaturate) {
                                    let hsl = RGBtoHSL(color);
                                    hsl[1] *= 0.7;
                                    color = HSLtoRGB(hsl);
                                }

                                ctx.fillStyle = "rgb(" + color.join(",") + ")";
                                ctx.fillRect(sx, sy, sw, sh);
                            }

                            if (viewData[currentView].pixelColor !== undefined) {
                                let color = viewData[currentView].pixelColor(value);
                                if (color) {
                                    ctx.fillStyle = viewData[currentView].colorFunction + color.join(",") + ")";
                                    ctx.fillRect(sx, sy, sw, sh);
                                }
                            }
                        }
                    }

                    if (viewData[currentView].chunkColor !== undefined) {
                        let color = viewData[currentView].chunkColor(chunk);
                        if (color) {
                            let csx = Math.floor((cx * chunkSize - window.camX) / window.camZoom);
                            let csy = Math.floor((cy * chunkSize - window.camY) / window.camZoom);
                            let csw = Math.max(1, Math.ceil(((cx + 1) * chunkSize - window.camX) / window.camZoom) - csx);
                            let csh = Math.max(1, Math.ceil(((cy + 1) * chunkSize - window.camY) / window.camZoom) - csy);
                            ctx.fillStyle = viewData[currentView].colorFunction + color.join(",") + ")";
                            ctx.fillRect(csx, csy, csw, csh);
                        }
                    }
                }
            }
        };

        window.renderHighlight = function() {
            if (!viewData[currentView].showHighlight) return;
            tempHover = {};

            let ctx = canvasLayersCtx.highlight;
            ctx.clearRect(0, 0, canvasLayers.highlight.width, canvasLayers.highlight.height);

            const chunkSize = planet.config.chunkSize;
            const waterLevel = planet.config.waterLevel;
            const viewW = planet.config.width;
            const viewH = planet.config.height;

            let chunks = filterChunks((c) => c.v.s !== undefined);
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                let sx = Math.floor((chunk.x * chunkSize - window.camX) / window.camZoom);
                let sy = Math.floor((chunk.y * chunkSize - window.camY) / window.camZoom);
                let sw = Math.max(1, Math.ceil(((chunk.x + 1) * chunkSize - window.camX) / window.camZoom) - sx);
                let sh = Math.max(1, Math.ceil(((chunk.y + 1) * chunkSize - window.camY) / window.camZoom) - sy);
                if (sx + sw < 0 || sx >= viewW || sy + sh < 0 || sy >= viewH) continue;

                const town = regGet("town", chunk.v.s);
                if (!town) continue;

                let color = town.color;
                let opacity = userSettings.opacity || 0.5;
                if (currentHighlight && currentHighlight[1] === chunk.v.s && currentHighlight[0] === "town") {
                    color = colorBrightness(color, 1.15);
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
                for (let j = 0; j < adjacentCoords.length; j++) {
                    const coords = adjacentCoords[j];
                    const adj = window.getOrGenChunk(chunk.x + coords[0], chunk.y + coords[1]);
                    if (adj !== undefined && adj.v.s !== chunk.v.s) {
                        if (coords[0] === -1) ctx.fillRect(sx, sy, bt, sh);
                        else if (coords[0] === 1) ctx.fillRect(sx + sw - bt, sy, bt, sh);
                        else if (coords[1] === -1) ctx.fillRect(sx, sy, sw, bt);
                        else if (coords[1] === 1) ctx.fillRect(sx, sy + sh - bt, sw, bt);
                    }
                }

                if (userSettings.carve) {
                    for (let x = 0; x < chunk.p.length; x++) {
                        for (let y = 0; y < chunk.p[x].length; y++) {
                            let absX = chunkSize * chunk.x + x;
                            let absY = chunkSize * chunk.y + y;
                            let psx = Math.floor((absX - window.camX) / window.camZoom);
                            let psy = Math.floor((absY - window.camY) / window.camZoom);
                            let psw = Math.max(1, Math.ceil((absX + 1 - window.camX) / window.camZoom) - psx);
                            let psh = Math.max(1, Math.ceil((absY + 1 - window.camY) / window.camZoom) - psy);
                            let adjacent = false;
                            for (let k = 0; k < adjacentCoords.length; k++) {
                                let adjPixel = pixelAt(absX + adjacentCoords[k][0], absY + adjacentCoords[k][1]);
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

            const disasters = regFilter("process", (p) => p.done === undefined && p.type === "disaster");
            for (let i = 0; i < disasters.length; i++) {
                const disaster = disasters[i];
                let color = disaster.color || [255, 0, 0];
                if (currentHighlight && currentHighlight[1] === disaster.id && currentHighlight[0] === "process") {
                    color = colorBrightness(color, 1.15);
                }
                if (Array.isArray(disaster.chunks)) {
                    let dChunks = {};
                    disaster.chunks.forEach((coords) => {
                        dChunks[coords[0] + "," + coords[1]] = true;
                        tempHover[coords[0] + "," + coords[1]] = disaster;
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
                        for (let j = 0; j < adjacentCoords.length; j++) {
                            const coords = adjacentCoords[j];
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

            renderMarkers();
        };

        window.renderMarkers = function() {
            if (!viewData[currentView].showMarkers) return;

            let ctx = canvasLayersCtx.markers;
            ctx.clearRect(0, 0, canvasLayers.markers.width, canvasLayers.markers.height);
            const res = planet.config.pixelSize * $c.markerResolution;
            const _chunkSize = (planet.config.chunkSize * res) / window.camZoom;
            const viewW = planet.config.width * res;
            const viewH = planet.config.height * res;

            if (ctx.textAlign !== "center") {
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
            }
            ctx.font = Math.max(1, _chunkSize) + "px PublicPixel";

            let markers = userSettings.markers === false ? [] : regToArray("marker");
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                if (marker.x === undefined || marker.y === undefined) continue;
                let sx = ((marker.x * planet.config.chunkSize - window.camX) * res) / window.camZoom;
                let sy = ((marker.y * planet.config.chunkSize - window.camY) * res) / window.camZoom;
                if (sx + _chunkSize < 0 || sx >= viewW || sy + _chunkSize < 0 || sy >= viewH) continue;

                const symbol = marker.symbol || "⏺";
                let color = marker.color || [176, 176, 153];
                let highlight = currentHighlight && currentHighlight[1] === marker.id && currentHighlight[0] === "marker";
                if (highlight) {
                    color = colorBrightness(color, 1.2);
                    ctx.font = Math.max(1, _chunkSize * 1.5) + "px PublicPixel";
                }

                let offset = (planet.config.pixelSize / 1.5) / window.camZoom;
                ctx.strokeStyle = "rgb(" + colorBrightness(color, 0.8) + ")";
                ctx.lineWidth = Math.max(1, (planet.config.pixelSize * 2) / window.camZoom);
                ctx.strokeText(symbol, sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);
                ctx.fillStyle = "rgb(" + color.join(",") + ")";
                ctx.fillText(symbol, sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);

                if (highlight) ctx.font = Math.max(1, _chunkSize) + "px PublicPixel";
            }

            ctx.strokeStyle = "rgb(0,0,0)";
            regToArray("town").forEach((town) => {
                if (!town.center) happen("UpdateCenter", null, town);
                let hasIssue = Object.values(town.issues).length;
                let sx = ((town.center[0] * planet.config.chunkSize - window.camX) * res) / window.camZoom;
                let sy = ((town.center[1] * planet.config.chunkSize - window.camY) * res) / window.camZoom;
                if (sx + _chunkSize < -200 || sx >= viewW + 200 || sy + _chunkSize < -200 || sy >= viewH + 200) return;

                let offset = (planet.config.pixelSize / 1.5) / window.camZoom;
                if ((userSettings.townNames && !controlState.shift) || (controlState.shift && !userSettings.townNames)) {
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
                    ctx.lineWidth = Math.max(1, (planet.config.pixelSize * 2.5) / window.camZoom);
                    ctx.strokeText(name, sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);
                    ctx.fillText(name, sx + _chunkSize / 2 + offset, sy + _chunkSize / 2 - offset);
                } else if (hasIssue && userSettings.markers !== false) {
                    ctx.lineWidth = Math.max(1, (planet.config.pixelSize * 3) / window.camZoom);
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
            let ctx = canvasLayersCtx.cursor;
            ctx.clearRect(0, 0, canvasLayers.cursor.width, canvasLayers.cursor.height);
            const chunkSize = planet.config.chunkSize;
            if (mousePos) {
                let sx = Math.floor((mousePos.chunkX * chunkSize - window.camX) / window.camZoom);
                let sy = Math.floor((mousePos.chunkY * chunkSize - window.camY) / window.camZoom);
                let sw = Math.max(1, Math.ceil(((mousePos.chunkX + 1) * chunkSize - window.camX) / window.camZoom) - sx);
                let sh = Math.max(1, Math.ceil(((mousePos.chunkY + 1) * chunkSize - window.camY) / window.camZoom) - sy);
                ctx.fillStyle = "rgba(240,240,240,0.5)";
                ctx.fillRect(sx, sy, sw, sh);
            }
            if (selectedChunk) {
                let sx = Math.floor((selectedChunk.x * chunkSize - window.camX) / window.camZoom);
                let sy = Math.floor((selectedChunk.y * chunkSize - window.camY) / window.camZoom);
                let sw = Math.max(1, Math.ceil(((selectedChunk.x + 1) * chunkSize - window.camX) / window.camZoom) - sx);
                let sh = Math.max(1, Math.ceil(((selectedChunk.y + 1) * chunkSize - window.camY) / window.camZoom) - sy);
                ctx.fillStyle = "rgba(240,240,240,0.8)";
                ctx.fillRect(sx, sy, sw, sh);
            }
        };

        window.handleCursor = function(e) {
            const rect = mapCanvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;

            let screenX = Math.floor((x / mapCanvas.clientWidth) * (planet.config.width * window.camZoom));
            let screenY = Math.floor((y / mapCanvas.clientHeight) * (planet.config.height * window.camZoom));

            let worldX = screenX + window.camX;
            let worldY = screenY + window.camY;

            let chunkX = Math.floor(worldX / planet.config.chunkSize);
            let chunkY = Math.floor(worldY / planet.config.chunkSize);

            let oldChunkX = mousePos ? mousePos.chunkX : null;
            let oldChunkY = mousePos ? mousePos.chunkY : null;

            mousePos = {
                x: worldX,
                y: worldY,
                chunkX: chunkX,
                chunkY: chunkY
            };

            let chunk = window.getOrGenChunk(chunkX, chunkY);
            let chunkKey = chunkX + "," + chunkY;
            let hovered = false;
            let highlight = null;

            if (viewData[currentView].hover) {
                hovered = !!viewData[currentView].hover(chunk);
            } else if (tempHover[chunkKey]) {
                hovered = true;
                highlight = ["process", tempHover[chunkKey].id];
            } else if (chunk.v.s) {
                hovered = true;
                highlight = ["town", chunk.v.s];
            }

            if (chunk.v.m) {
                highlight = ["marker", chunk.v.m];
            }

            mapCanvas.style.cursor = hovered ? "pointer" : "";

            if (!currentHighlight || !highlight || (highlight[0] !== currentHighlight[0] || highlight[1] !== currentHighlight[1])) {
                currentHighlight = highlight;
                renderHighlight();
                updateCanvas();
            }

            if (oldChunkX !== chunkX || oldChunkY !== chunkY) {
                renderCursor();
                updateCanvas();
                updateStats();
            }
        };

        mapCanvas.onwheel = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = mapCanvas.getBoundingClientRect();
            let mouseNormX = (e.clientX - rect.left) / mapCanvas.clientWidth;
            let mouseNormY = (e.clientY - rect.top) / mapCanvas.clientHeight;

            let oldZoom = window.camZoom;
            let factor = e.deltaY < 0 ? 0.8 : 1.25;
            let newZoom = Math.max(0.2, Math.min(25, oldZoom * factor));

            if (newZoom === oldZoom) return;

            let focusWorldX = window.camX + mouseNormX * (planet.config.width * oldZoom);
            let focusWorldY = window.camY + mouseNormY * (planet.config.height * oldZoom);

            window.camZoom = newZoom;
            window.camX = Math.round(focusWorldX - mouseNormX * (planet.config.width * newZoom));
            window.camY = Math.round(focusWorldY - mouseNormY * (planet.config.height * newZoom));

            renderMap();
            renderHighlight();
            renderCursor();
            updateCanvas();
            updateStats();
        };

        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let camStartX = 0;
        let camStartY = 0;

        mapCanvas.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };

        mapCanvas.onmousedown = (e) => {
            if (e.button === 0 || e.button === 2) {
                isPanning = true;
                panStartX = e.clientX;
                panStartY = e.clientY;
                camStartX = window.camX;
                camStartY = window.camY;
            }
        };

        window.onmousemove = (e) => {
            if (isPanning) {
                let dx = e.clientX - panStartX;
                let dy = e.clientY - panStartY;
                let scaleX = (planet.config.width * window.camZoom) / mapCanvas.clientWidth;
                let scaleY = (planet.config.height * window.camZoom) / mapCanvas.clientHeight;

                window.camX = Math.round(camStartX - dx * scaleX);
                window.camY = Math.round(camStartY - dy * scaleY);

                renderMap();
                renderHighlight();
                renderCursor();
                updateCanvas();
                updateStats();
            }
        };

        window.onmouseup = (e) => {
            if (isPanning) {
                let dist = Math.hypot(e.clientX - panStartX, e.clientY - panStartY);
                isPanning = false;
                if (dist > 5) {
                    lastDrag = true;
                    return;
                }
            }
        };

        window.handleMouseUp = function(e) {
            handleCursor(e);

            if (lastDrag) {
                lastDrag = null;
                return;
            }

            let chunk = window.getOrGenChunk(mousePos.chunkX, mousePos.chunkY);
            let chunkKey = mousePos.chunkX + "," + mousePos.chunkY;

            if (e.button === 0 || e.force !== undefined) {
                if (onMapClick) {
                    onMapClick(e);
                } else if (selectedChunk) {
                    deselectChunk();
                } else if (tempHover[chunkKey]) {
                    let entity = tempHover[chunkKey];
                    regBrowse(entity._reg, entity.id);
                } else if (chunk) {
                    if (viewData[currentView].click) viewData[currentView].click(chunk);
                    else if (chunk.v.m) regBrowse("marker", chunk.v.m);
                    else if (chunk.v.s) regBrowse("town", chunk.v.s);
                }
            } else if (e.button === 2) {
                if (selectedChunk) {
                    deselectChunk();
                } else if (mousePos) {
                    selectedChunk = chunk;
                    document.querySelector("#statsPanel .panelX").style.display = "flex";
                }
            }

            updateStats();
            renderCursor();
            updateCanvas();
        };

        renderMap();
        renderHighlight();
        renderCursor();
        updateCanvas();
        logMessage("Infinite world initialized.", "tip");
    };

    let regenerateWorld = () => {
        planet.config.borderFalloff = 0;
        delete planet.config.seed;
        planet.chunks = {};
        window.camX = 0;
        window.camY = 0;
        window.camZoom = 1;
        planet = generatePlanet(planet.config);
        planet.config.borderFalloff = 0;
        reg = planet.reg;
        updateBiomes();
        initGame(true);
        generateStarSystem(true);
        calculateLandmasses();
        initInfiniteWorld();
    };

    let hasColonies = regCount("town") > 0;
    if (hasColonies) {
        doPrompt({
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
