Mod.afterLoad(function () {
    const defaultColorList = [
        "#ff5757",
        "#ff7433",
        "#ffa449",
        "#ffe500",
        "#57ff57",
        "#00cc66",
        "#5757ff",
        "#9757ff",
        "#ff199f",
        "#ff57ff",
        "#ffffff",
        "#e0e0e0",
        "#808080",
        "#262626",
        "#000000"
    ];

    function injectFlagStyles() {
        if (document.getElementById("customFlagStyles")) return;
        const style = document.createElement("style");
        style.id = "customFlagStyles";
        style.textContent = `
            .flagEditorWrap {
                display: flex;
                flex-direction: column;
                gap: 0.75em;
                width: 100%;
                font-family: inherit;
            }
            .flagPreviewBox {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.35em;
                padding: 0.75em;
                background: rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.15);
            }
            .flagPreviewBox .liveFlag {
                font-size: 2.2em;
                line-height: 1;
                user-select: none;
            }
            .flagEditRow {
                display: flex;
                flex-direction: column;
                gap: 0.25em;
            }
            .flagEditLabel {
                font-size: 0.85em;
                opacity: 0.8;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .flagChoiceGrid {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35em;
            }
            .flagChoiceItem {
                padding: 0.25em 0.5em;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.2);
                cursor: pointer;
                user-select: none;
                font-size: 0.9em;
            }
            .flagChoiceItem:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            .flagChoiceItem.activeChoice {
                background: rgba(255, 255, 255, 0.35);
                border-color: #ffff8c;
                color: #ffff8c;
            }
            .flagColorPalette {
                display: flex;
                flex-wrap: wrap;
                gap: 0.3em;
            }
            .flagColorSwatch {
                width: 1.5em;
                height: 1.5em;
                border: 1px solid rgba(255, 255, 255, 0.3);
                cursor: pointer;
                box-sizing: border-box;
            }
            .flagColorSwatch:hover {
                transform: scale(1.1);
            }
            .flagColorSwatch.activeChoice {
                border: 2px solid #ffff8c;
                outline: 1px solid #000;
            }
        `;
        document.head.appendChild(style);
    }

    function buildFlagString(template, emblem, fg, bg, emblemColor) {
        let t = template.replace(/ /g, " ");
        if (t.match(/\$/)) {
            return t
                .replace(/^([^$]+)/, `{{color:$1|${fg}|${bg}}}`)
                .replace(/([^$]+)$/, `{{color:$1|${fg}|${bg}}}`)
                .replace(/\$/g, `{{color:${emblem}|${emblemColor}|${bg}}}`);
        }
        return `{{color:${t}|${fg}|${bg}}}`;
    }

    window.openFlagPainter = function (town) {
        injectFlagStyles();

        let curTemplate = wordComponents.flags.TEMPLATE[0];
        let curEmblem = (town.emblem || town.name[0] || "A").toUpperCase();
        let curBg = defaultColorList[0];
        let curFg = defaultColorList[10];
        let curEmblemColor = RGBToHex(town.color || [255, 87, 87]);

        const editor = document.createElement("div");
        editor.className = "flagEditorWrap";

        const previewContainer = document.createElement("div");
        previewContainer.className = "flagPreviewBox";
        const previewDisplay = document.createElement("div");
        previewDisplay.className = "liveFlag font2";
        previewContainer.appendChild(previewDisplay);
        editor.appendChild(previewContainer);

        function refreshPreview() {
            const flagStr = buildFlagString(curTemplate, curEmblem, curFg, curBg, curEmblemColor);
            previewDisplay.innerHTML = parseText(flagStr);
        }

        function createSection(label) {
            const row = document.createElement("div");
            row.className = "flagEditRow";
            const lbl = document.createElement("span");
            lbl.className = "flagEditLabel";
            lbl.textContent = label;
            row.appendChild(lbl);
            editor.appendChild(row);
            return row;
        }

        const templateRow = createSection("Template");
        const templateGrid = document.createElement("div");
        templateGrid.className = "flagChoiceGrid";
        wordComponents.flags.TEMPLATE.forEach((tmpl) => {
            const item = document.createElement("span");
            item.className = "flagChoiceItem font2";
            item.textContent = tmpl.replace(/ /g, " ");
            if (tmpl === curTemplate) item.classList.add("activeChoice");
            item.onclick = () => {
                templateGrid.querySelectorAll(".flagChoiceItem").forEach(el => el.classList.remove("activeChoice"));
                item.classList.add("activeChoice");
                curTemplate = tmpl;
                refreshPreview();
            };
            templateGrid.appendChild(item);
        });
        templateRow.appendChild(templateGrid);

        const emblemRow = createSection("Emblem");
        const emblemGrid = document.createElement("div");
        emblemGrid.className = "flagChoiceGrid";
        const townLetter = (town.name[0] || "A").toUpperCase();
        const emblems = [townLetter, ...wordComponents.flags.EMBLEM.filter(e => e !== "A")];
        emblems.forEach((emb) => {
            const item = document.createElement("span");
            item.className = "flagChoiceItem font2";
            item.textContent = emb;
            if (emb === curEmblem) item.classList.add("activeChoice");
            item.onclick = () => {
                emblemGrid.querySelectorAll(".flagChoiceItem").forEach(el => el.classList.remove("activeChoice"));
                item.classList.add("activeChoice");
                curEmblem = emb;
                refreshPreview();
            };
            emblemGrid.appendChild(item);
        });
        emblemRow.appendChild(emblemGrid);

        function createPaletteSection(label, getVal, setVal) {
            const row = createSection(label);
            const grid = document.createElement("div");
            grid.className = "flagColorPalette";
            defaultColorList.forEach((hex) => {
                const swatch = document.createElement("div");
                swatch.className = "flagColorSwatch";
                swatch.style.backgroundColor = hex;
                if (getVal().toLowerCase() === hex.toLowerCase()) swatch.classList.add("activeChoice");
                swatch.onclick = () => {
                    grid.querySelectorAll(".flagColorSwatch").forEach(el => el.classList.remove("activeChoice"));
                    swatch.classList.add("activeChoice");
                    setVal(hex);
                    refreshPreview();
                };
                grid.appendChild(swatch);
            });
            row.appendChild(grid);
        }

        createPaletteSection("Background Color", () => curBg, (val) => { curBg = val; });
        createPaletteSection("Foreground Color", () => curFg, (val) => { curFg = val; });
        createPaletteSection("Emblem Color", () => curEmblemColor, (val) => { curEmblemColor = val; });

        refreshPreview();

        doPrompt({
            type: "text",
            title: `Paint Flag: ${town.name}`,
            message: null,
            func: () => {
                const finalFlag = buildFlagString(curTemplate, curEmblem, curFg, curBg, curEmblemColor);
                town.flag = finalFlag;
                town.emblem = curEmblem;
                logMessage(`{{regname:town|${town.id}}} adopted a custom flag. ${finalFlag}`);
                renderMarkers();
                updateCanvas();
                autosave();
                regBrowse("town", town.id);
            }
        });

        const popupContent = document.getElementById("popupContent");
        popupContent.innerHTML = "";
        popupContent.style.display = "";
        popupContent.appendChild(editor);

        const okBtn = document.getElementById("popupOk");
        if (okBtn) okBtn.textContent = "Apply";
    };

    const origOpenRegBrowser = window.openRegBrowser;
    window.openRegBrowser = function (obj, regName) {
        origOpenRegBrowser(obj, regName);
        if (regName === "town" && obj && obj.flag) {
            const titleRow = document.querySelector("#regBrowser .regSection.regTitle");
            if (titleRow) {
                const titleTargets = titleRow.querySelectorAll(".regTitle, .entityName, .font2");
                titleTargets.forEach((targetElem) => {
                    targetElem.style.cursor = "pointer";
                    targetElem.onmousedown = (e) => e.stopPropagation();
                    targetElem.onclick = (e) => {
                        e.stopPropagation();
                        closePopups();
                        window.openFlagPainter(obj);
                    };
                });
            }
        }
    };

    const origHandleMore = window.handleMore;
    window.handleMore = function (elem, entity) {
        let regName, id;
        if (elem) {
            const regBrowser = elem.parentNode;
            regName = regBrowser.getAttribute("data-reg");
            id = regBrowser.getAttribute("data-id");
        } else if (entity) {
            regName = entity._reg;
            id = entity.id;
        }

        origHandleMore(elem, entity);

        if (regName === "town" && id) {
            const town = regGet("town", parseInt(id));
            if (town && town.flag) {
                const subList = document.getElementById("actionSubList");
                if (subList) {
                    const paintBtn = document.createElement("span");
                    paintBtn.className = "actionItem item clickable";
                    paintBtn.setAttribute("role", "button");
                    paintBtn.innerHTML = parseText("Paint Custom Flag");
                    paintBtn.onclick = () => {
                        closeExecutive();
                        window.openFlagPainter(town);
                    };
                    subList.insertBefore(paintBtn, subList.children[1] || null);
                }
            }
        }
    };
});
