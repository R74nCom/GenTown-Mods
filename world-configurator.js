const WHIRLLOADER = "whirl-load.js"
const MOD_NAME = "world_configurator"

const $world_configurator_opts = {
    resolutions: {
        "600,360": "Ultra (3x)",
        "400,240": "High (2x)",
        "300,180": "Medium (1.5x)",
        "200,120": "Default (1x)",
        "150,90": "Smaller (.75x)",
        "100,60": "Itty bitty (.5x)",
    },
    continentSizes: {
        "0.5": "Huge scale (2x)",
        "1": "Regular scale (1x)",
        "1.33": "More continents (0.75x)",
        "2": "Even more continents!! (0.5x)"
    },
    chunkScales: {
        "5": "Larger chunks (1.25x)",
        "4": "Default (1x)"
    }
}

window.addEventListener("tools-initialized", worldConfigurator__load)

if (userSettings.mods.some(s => s.endsWith("whirl-load.js"))) {
    // We can wait for the mod initialization event since it has to be there
    if (window.whirlLoaderLoaded) { // ...unless it's loaded in front of us, then we need to manually load
        worldConfigurator__load()
    }
} else {
    addMod(WHIRLLOADER);
}

// overridden
function createGeneratedPerlinWithResizing(scale){
    function generatePerlinNoise(x, y, octaves, persistence) {
        x *= scale
        y *= scale
    	let total = 0;
    	let frequency = 1;
    	let amplitude = 1;
    	let maxValue = 0;  // Used for normalizing the result

    	for (let i = 0; i < octaves; i++) {
    		total += noise.perlin2(x * frequency, y * frequency) * amplitude;
    		maxValue += amplitude; // Keep track of maximum possible value
    		amplitude *= persistence;
    		frequency *= 2;
    	}

    	return total / maxValue; // Normalize the result to stay within 0-1 range
    }
    return generatePerlinNoise
}

function redraw(){
    resizeCanvases();
    renderMap();
    renderHighlight();
    renderCursor();
    updateStats();
    updateCanvas(); 
}

function worldConfigurator__load(){
    if ($wt.modsLoaded.includes(MOD_NAME)){
        return;
    }
    console.log($wt.__version__)
    console.log($wt.__version__.major != 1 || $wt.__version__.minor < 0)
    if ($wt.__version__.major != 1 || $wt.__version__.minor < 0) {
        $wt._mod_notice__update("World Configurator")
        return;
    }
    if (userSettings.worldConfigurator__haveOpenedBefore === undefined){
        userSettings.worldConfigurator__haveOpenedBefore = false;
    }
    saveSettings();
    $wt.modsLoaded.push(MOD_NAME);
    const btn = $wt.addExecutiveButton(
        false,
        !userSettings.worldConfigurator__haveOpenedBefore,
        "World Configurator",
        "actionWorldConfigurator",
        document.querySelector('#actionMain').querySelector('div:not(#actionMainList)').firstElementChild
    )
    btn.addEventListener('click', () => {
        userSettings.worldConfigurator__haveOpenedBefore = true;
        btn.classList.remove('notify')
        populateExecutive([
            {
                text: "World resolution",
                setting: "worldConfigurator__resolution",
                options: $world_configurator_opts.resolutions,
                default: "200,120"
            },
            {
                text: "World size",
                setting: "worldConfigurator__continentSize",
                options: $world_configurator_opts.continentSizes,
                default: "1"
            },
            {
                text: "Chunk scale",
                setting: "worldConfigurator__chunkScale",
                options: $world_configurator_opts.chunkScales,
                default: "4"
            },
            { spacer: true },
            {
                text: "Create a new world",
                func: () => {
                    doPrompt({
                        type: "confirm",
                        message: "{{people}} look up dreadfully at the sky.\n\nAre you sure you want to DELETE them permanently?",
                        title: "Create new world",
                        func: (r) => {
                            if (r) {
                                R74n.del("GenTownSave");
                                delete userSettings.view;
                                saveSettings();
                                location.reload();
                            }
                        },
                        danger: true
                    })
                },
                notify: planet.dead,
                danger: true
            }
        ], "World Configurator")
    })
    generatePlanet = $wt.bindBefore(
        generatePlanet,
        () => {
            const regularWidth = 200;
            if (userSettings.worldConfigurator__resolution){
                const [width, height] = userSettings.worldConfigurator__resolution.split(",");
                planetWidth = +width;
                planetHeight = +height;
                $c.defaultPlanetWidth = width;
                $c.defaultPlanetHeight = planetHeight;
            }  
            const csize = (+userSettings.worldConfigurator__continentSize || 1) * (1 / ($c.defaultPlanetWidth / regularWidth)); // We want to preserve the scale by default even at higher resolutions so we account for that
            generatePerlinNoise = createGeneratedPerlinWithResizing(csize);
            if (userSettings.worldConfigurator__chunkScale){
                chunkSize = +userSettings.worldConfigurator__chunkScale;
                $c.defaultChunkSize = chunkSize;
            }
        }
    );
    window.addEventListener("load", (event) => {
        redraw();
    });
}
