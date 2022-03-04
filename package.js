"use strict";

const modPackage = require("./package.json")
const basename = require('path').basename;

const TRAP_MODLOADER = basename(__dirname);

function importMods() {
    // get mods
    if (!VFS.exists(ModLoader.basepath)) {
        // no mods folder found
        VFS.createDir(ModLoader.basepath);
        return;
    }

    Logger.log("TrapModLoader: loading mods...");

    const loadorderFile = `${ModLoader.basepath}loadorder.json`

    let mods;
    // if loadorder.json exists: load it, otherwise get filesystem default order
    if (VFS.exists(loadorderFile)) {
        mods = JsonUtil.deserialize(VFS.readFile(loadorderFile));
    }
    else {
        mods = VFS.getDirs(ModLoader.basepath);

        VFS.writeFile(loadorderFile, JsonUtil.serialize(mods, true));
        Logger.info("TrapModLoader: loadorder.json file generated");
    }


    // Used to check all errors before stopping the load execution
    let errorsFound = false;
    // validate mods
    for (const mod of mods) {
        if (!ModLoader.validMod(mod)) {
            Logger.error("Invalid mod encountered");
            return;
        }
    }

    const loadedMods = {};
    for (const mod of mods) {
        loadedMods[mod] = JsonUtil.deserialize(VFS.readFile(`${ModLoader.getModPath(mod)}/package.json`));
    }

    for (const modToValidate of Object.values(loadedMods)) {
        // Returns if any mod dependency is not satisfied
        if (!ModLoader.areModDependenciesFulfilled(modToValidate, loadedMods)) {
            errorsFound = true;
        }

        // Returns if at least two incompatible mods are found
        if (!ModLoader.isModCompatible(modToValidate, loadedMods)) {
            errorsFound = true;
        }

        // Returns if mod isnt compatible with this verison of aki
        if (!ModLoader.isModCombatibleWithAki(modToValidate)) {
            errorsFound = true;
        }
    }

    if (errorsFound) {
        return;
    }

    // add mods
    for (const mod of mods) {
        ModLoader.addMod(mod);
    }
}

class TrapModLoader {
    constructor() {
        this.hijacked = false;
        this.saved = {};


        Logger.info(`Loading: ${modPackage.name} v${modPackage.version}`);

        ModLoader.onLoad[modPackage.name] = this.onLoad.bind(this);

    }


    onLoad() {
        this.hijackModLoader();

        ModLoader.importMods();
        ModLoader.executeMods();

        this.restoreModLoader();
    }

    hijackModLoader() {
        if (this.hijacked) {
            return;
        }

        // save
        this.saved.importMods = ModLoader.importMods;
        this.saved.basePath = ModLoader.basePath;
        this.saved.imported = ModLoader.imported;
        this.saved.onLoad = ModLoader.onLoad;

        // hijack
        ModLoader.importMods = importMods;
        ModLoader.basepath = `user/mods/${TRAP_MODLOADER}/mods/`;
        ModLoader.imported = {};
        ModLoader.onLoad = {};

        this.hijacked = true;
    }

    restoreModLoader() {
        if (!this.hijacked) {
            return;
        }

        ModLoader.importMods = this.saved.importMods;
        ModLoader.basePath = this.saved.basePath;
        ModLoader.imported = this.saved.imported;
        ModLoader.onLoad = this.saved.onLoad;

        this.saved = {};
        this.hijacked = false;
    }
}

module.exports = new TrapModLoader();