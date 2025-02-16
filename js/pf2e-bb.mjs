import CONFIG from "./adventure.mjs";
import PF2EAdventureImporter from "./importer.mjs";
import { extractLocalization, localizeCompendiumIndex } from "./i18n.mjs";

/**
 * A reference to the Beginner Box module.
 * @type {Module}
 */
let module;

/* -------------------------------------------- */
/*  Initialize Module API 		                  */
/* -------------------------------------------- */

Hooks.once("init", () => {
  module = game.modules.get(CONFIG.moduleId);
  module.api = {
    PF2EAdventureImporter,
    extractLocalization,
  };

  // Register settings
  game.settings.register(CONFIG.moduleId, "startup", {
    name: "One-Time Startup Prompt",
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
  });

  // Register sheets
  DocumentSheetConfig.registerSheet(Adventure, CONFIG.moduleId, PF2EAdventureImporter, {
    label: "Beginner Box Importer",
  });
});

/* -------------------------------------------- */
/*  Initialize localization 		                */
/* -------------------------------------------- */
Hooks.once("langDePf2e.ready", () => {
  game.langDePf2e.registerCompendium("pf2e-beginner-box", "pathfinder-bestiary", "de", "lang/de/compendium/pathfinder-bestiary");
});

/* -------------------------------------------- */
/*  Activate Module Features                    */
/* -------------------------------------------- */

Hooks.on("ready", () => {
  const firstStartup = game.settings.get(CONFIG.moduleId, "startup") === false;
  for (const p of module.packs) {
    const pack = game.packs.get(`${CONFIG.moduleId}.${p.name}`);

    // FIXME - for now this has to be done in "ready", but in v11 it should be moved to "setup"
    if (game.i18n.lang !== "en" && module.languages.find((l) => l.lang === game.i18n.lang)) {
      pack.metadata.label = game.i18n.localize("PF2EBB.CompendiumTitle");
      localizeCompendiumIndex(pack);
    }
    if (firstStartup) pack.apps[0].render(true);
  }
  game.settings.set(CONFIG.moduleId, "startup", true);
});

/* -------------------------------------------- */
/*  Journal Styling						        */
/* -------------------------------------------- */

Hooks.on("renderJournalSheet", (app, html) => {
  const journal = app.document;
  if (journal.getFlag(CONFIG.moduleId, CONFIG.journalFlag)) html[0].classList.add(CONFIG.cssClass);
});

Hooks.on("renderJournalPageSheet", (app, html) => {
  const journal = app.document.parent;
  if (journal.getFlag(CONFIG.moduleId, CONFIG.journalFlag)) html[0].classList.add(CONFIG.cssClass);
});
