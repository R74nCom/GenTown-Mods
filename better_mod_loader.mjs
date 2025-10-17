// @ts-check

/**
 * @typedef ModMetadata
 * @property {string} url
 * @property {string} [prettyName]
 * @property {string[]} [dependencies]
 */

/**
 * The mod containment and initialization system.
 */
class ModContainer {
    /**
     * The mods installed in this ModContainer.
     * @type {Record<string, AbstractMod>}
     */
    mods = {};

    /**
     * Holds metadata about mods, like dependencies and pretty names.
     * @type {Record<string, ModMetadata>}
     */
    modMetadata = {};

    /**
     * @returns {Promise<ModContainer>}
     */
    static async make(){
        var container = new ModContainer();
        await container.fetchModMetadataFromURL("mods.json");
        return container;
    }

    constructor() {
    }

    /**
     * Checks an identifier for validity.
     * @param {string} str The string to check.
     * @returns {Boolean} If the identifier is valid or not.
     */
    static allowableIdentifier(str) {
        const regex = new RegExp(`[^A-Za-z0-9_]`, 'g');
        return !regex.test(str);
    }

    /**
     * Loads mod metadata from a provided object.
     * @param {Record<string, ModMetadata>} metadata The metadata object.
     */
    loadModMetadata(metadata) {
        this.modMetadata = {...this.modMetadata, ...metadata};
    }

    /**
     * Fetches mod metadata from a URL.
     * @param {string} url The URL to the mods.json file.
     * @returns {Promise<void>}
     */
    async fetchModMetadataFromURL(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const metadata = await response.json();
            this.loadModMetadata(metadata);
            console.log(`Successfully loaded mod metadata from ${url}`);
        } catch (e) {
            console.error(`Failed to fetch or parse mod metadata from ${url}:`, e);
        }
    }

    /** 
     * Loads all mods, respecting priorities and dependencies.
     * This should be called by the game engine after all mod files have been loaded.
     */
    loadAllMods() {
        // Iterate from highest priority to lowest
        for (let priority = 5; priority >= 0; priority--) {
            // Get all unloaded mods at the current priority level.
            let modsToLoad = Object.values(this.mods).filter(mod => mod.loadPriority === priority && !mod.initialized);
            
            /** @type {number} */
            let loadedInPass;

            // We loop repeatedly until we've either loaded all mods successfully or we didn't load any mods in the pass.
            do {
                loadedInPass = 0;
                modsToLoad.forEach(mod => {
                    if (mod.requiredDependenciesRemainingToLoad.length === 0) {
                        try {
                            mod.initialize();
                            mod.initialized = true;
                            loadedInPass++;
                        } catch (e) {
                            console.error(`Error initializing mod ${mod.identifier}:`, e);
                        }
                    }
                });
                modsToLoad = modsToLoad.filter(mod => !mod.initialized);
            } while (loadedInPass > 0 && modsToLoad.length > 0);
        }

        // After trying all priorities, report any mods that failed to load.
        const unloadedMods = Object.values(this.mods).filter(mod => !mod.initialized);
        if (unloadedMods.length > 0) {
            console.warn("The following mods could not be loaded (likely due to missing or failed dependencies):");
            for (const mod of unloadedMods) {
                const missingDeps = mod.requiredDependenciesRemainingToLoad;
                console.warn(`- ${mod.prettyName} (${mod.identifier}) | Missing dependencies: [${missingDeps.join(', ')}]`);
            }
        }
    }
}

let $bml = await ModContainer.make();

export class AbstractError extends Error {
    /**
     * @param {string} message
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class ModExistsError extends AbstractError {
    /**
     * @param {string} message
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class InvalidIdentifierError extends AbstractError {
    /**
     * @param {string} message
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class AbstractMod {
    /**
     * Constructs a mod. Note that this also puts the mod in the registry by default.
     * @param {string} identifier The mod's identifier, e.g. "my_cool_mod" Allowed characters are A-Z, a-z, 0-9, and underscores. 
     * @param {string} prettyName The prettified mod name, e.g. "My Cool Mod".
     * @param {Number} loadPriority The priority of loading for your mod. Should be from 5 [highest] to 0 [lowest.] Must be on the same tier or a lower tier than all dependencies.
     * 
     * It is STRONGLY recommended to keep this at 0 unless you have an explicit reason to load earlier.
     * @param {Array<string>} dependencies A list of dependencies in the form of string IDs. 
     */
    constructor(identifier, prettyName, loadPriority=0, dependencies=[], autoset=true){
        if (new.target === AbstractMod) {
            throw new AbstractError("Your mod must subclass the AbstractMod type.");
        }
        if (identifier in $bml.mods){
            throw new ModExistsError(`Mod with identifier ${identifier} already exists. (Are you sure you're only instantiating one copy of your mod?)`);
        }
        if (ModContainer.allowableIdentifier(identifier) === false){
            throw new InvalidIdentifierError(`Mod identifier "${identifier}" contains invalid characters. Only A-Z, a-z, 0-9, and underscores are allowed.`);
        }
        
        const metadata = $bml.modMetadata[identifier];

        this.identifier = identifier;
        this.prettyName = prettyName || (metadata && metadata.prettyName) || identifier;
        this.loadPriority = loadPriority;
        
        const metadataDependencies = metadata && metadata.dependencies ? metadata.dependencies : [];
        
        // Just in case for some reason you have differing metadata deps and code deps, merge the two
        this.dependencies = [...new Set([...metadataDependencies, ...dependencies])];

        this.initialized = false;
        if (autoset){
            $bml.mods[identifier] = this; // We initialize mods automatically in construction so you don't have to do it manually later
        }
    }

    /**
     * @returns {Array<string>} The list of dependencies remaining for this mod to load. If empty, then the mod may load.
     */
    get requiredDependenciesRemainingToLoad(){
        return this.dependencies.filter(dep => {
            const depMod = $bml.mods[dep];
            // A dependency is missing if it's not registered or not initialized.
            return !depMod || !depMod.initialized;
        });
    }
  
    /**
     * This method is called by the mod loader when it's time for your mod to load.
     * You MUST override this method in your mod's class.
     * You do not need to set this.initialized manually.
     */
    initialize(){
        throw new AbstractError("Your mod must override the initialize() method.");
    }
}

export default $bml;