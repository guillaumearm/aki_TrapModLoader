"use strict";

const fs = require('fs');
const path = require('path');
const modPackage = require("./package.json");
const basename = require('path').basename;

const TRAP_MODLOADER = basename(__dirname);

const ATF_ID = 'AdvancedTraderFramework';

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

    return;
}

function getModlist() {
    // if loadorder.json exists: load it, otherwise generate load order
    if (VFS.exists(`${ModLoader.basepath}loadorder.json`)) {
        return JsonUtil.deserialize(VFS.readFile(`${ModLoader.basepath}loadorder.json`));
    }
    else {
        return Object.keys(ModLoader.getLoadOrder(ModLoader.imported));
    }
}

function executeMods(modlist) {
    // import mod classes
    for (const mod of modlist) {
        if ("main" in ModLoader.imported[mod]) {
            ModLoader.importClass(mod, `${ModLoader.getModPath(mod)}${ModLoader.imported[mod].main}`);
        }
    }
}

function loadMods() {
    // load mods
    for (const mod in ModLoader.onLoad) {
        ModLoader.onLoad[mod]();
    }

    // update the handbook lookup with modded items
    HandbookController.load();
}

function getATFModname(modlist) {
    for (const mod of modlist) {
        if (ModLoader.imported[mod].name === ATF_ID) {
            return mod;
        }
    }
}

function hijackATFexportPresetsMethod(ATFClass) {
    const modPath = path.normalize(path.join(__dirname, '..'));

    ATFClass.exportPresets = (keyword = 'export') => {
        let presetList = {};
        let profilesPath = path.normalize(path.join(modPath, '../profiles/'));

        let profileIDs = fs.readdirSync(profilesPath);
        Logger.info("ATF: Profiles:  " + profileIDs + "  found");

        profileIDs.forEach(profileFileName => {
            if (path.extname(profileFileName) == ".json") {
                let profile = require(profilesPath + profileFileName);
                if (profile.weaponbuilds != undefined) {
                    Object.values(profile.weaponbuilds).map((preset) => {
                        if (preset.name.includes(keyword)) {
                            presetList[preset.name] = Mod.convertPresetToTrade(preset);
                        }
                    });
                }
            }
        });

        let allPresetNames = Object.keys(presetList);

        Object.values(allPresetNames).map((presetName) => {
            Mod.writeFile(modPath + "/utility/exportedPresets/" + presetName + ".json", JSON.stringify(presetList[presetName], null, "\t"));
            Logger.info("ATF: Exporting Preset: " + presetName);
        });

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

        importMods();

        const modlist = getModlist();
        executeMods(modlist);

        const atfModname = getATFModname(modlist);

        // if Advanced Trader Framework mod is installed
        if (atfModname) {
            hijackATFexportPresetsMethod(globalThis[atfModname].mod.constructor)
            Logger.success('=> TrapModLoader: AdvancedTraderFramework exportPresets method hijacked');
        }

        loadMods()

        this.restoreModLoader();
    }

    hijackModLoader() {
        if (this.hijacked) {
            return;
        }

        // save
        this.saved.basePath = ModLoader.basePath;
        this.saved.imported = ModLoader.imported;
        this.saved.onLoad = ModLoader.onLoad;

        // hijack
        ModLoader.basepath = `user/mods/${TRAP_MODLOADER}/mods/`;
        ModLoader.imported = {};
        ModLoader.onLoad = {};

        this.hijacked = true;
    }

    restoreModLoader() {
        if (!this.hijacked) {
            return;
        }

        ModLoader.basePath = this.saved.basePath;
        ModLoader.imported = this.saved.imported;
        ModLoader.onLoad = this.saved.onLoad;

        this.saved = {};
        this.hijacked = false;
    }
}

module.exports = new TrapModLoader();