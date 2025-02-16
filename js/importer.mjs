import CONFIGURATION from "./adventure.mjs";

/**
 * @typedef {Object} LocalizationData
 * @property {Set<string>} html       HTML files which provide Journal Entry page translations
 * @property {object} i18n            An object of localization keys and translation strings
 */

/**
 * A subclass of the core AdventureImporter which performs some special functions for Pathfinder premium content.
 */
export default class PF2EAdventureImporter extends AdventureImporter {
  constructor(adventure, options) {
    super(adventure, options);
    this.config = CONFIGURATION.adventures.find((a) => adventure.id === a.id);
    this.options.classes.push(CONFIGURATION.cssClass);
  }

  /**
   * Cached localization data used during the import process for this Adventure.
   * @type {LocalizationData}
   */
  #localization;

  /* -------------------------------------------- */

  /** @inheritDoc */
  async getData(options = {}) {
    if (!this.#localization) {
      this.#localization = await this.#prepareLocalizationData();
      const updates = {};
      for (const key of ["name", "caption", "description"]) {
        if (this.#localization.i18n && this.#localization.i18n[key]) updates[key] = this.#localization.i18n[key];
      }
      this.document.updateSource(updates);
    }
    return foundry.utils.mergeObject(await super.getData(options), {
      importOptions: this.config.importOptions || {},
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderInner(data) {
    const html = await super._renderInner(data);
    if (!this.config.importOptions) return html;

    // Format options HTML
    let options = `<section class="import-form"><h2>${game.i18n.localize("ADVENTURE.ImporterOptions")}</h2>`;
    for (const [name, option] of Object.entries(this.config.importOptions)) {
      options += `<div class="form-group">
        <label class="checkbox">
            <input type="checkbox" name="${name}" data-tooltip="${game.i18n.localize(option.label)}" ${option.default ? "checked" : ""}/>
            ${game.i18n.localize(option.label)}
        </label>
    </div>`;
    }
    options += `</section>`;

    // Insert options and return
    html.find(".adventure-contents").append(options);
    return html;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareImportData(formData) {
    this.submitOptions = formData;
    const { toCreate, toUpdate, documentCount } = await super._prepareImportData(formData);

    // Merge Compendium Actor data
    if ("Actor" in toCreate) await this.#mergeCompendiumActors(toCreate.Actor, formData);
    if ("Actor" in toUpdate) await this.#mergeCompendiumActors(toUpdate.Actor, formData);

    // Merge Journal HTML data
    if ("JournalEntry" in toCreate) await this.#mergeJournalHTML(toCreate.JournalEntry);
    if ("JournalEntry" in toUpdate) await this.#mergeJournalHTML(toUpdate.JournalEntry);

    // Apply localized translations
    await this.#applyTranslations(toCreate);
    await this.#applyTranslations(toUpdate);
    return { toCreate, toUpdate, documentCount };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _importContent(toCreate, toUpdate, documentCount) {
    const importResult = await super._importContent(toCreate, toUpdate, documentCount);
    for (let [name, option] of Object.entries(this.config.importOptions || {})) {
      if (!option.handler) continue;
      await option.handler(this.document, option, this.submitOptions[name]);
    }
    return importResult;
  }

  /* -------------------------------------------- */
  /*  Pre-Import Customizations                   */
  /* -------------------------------------------- */

  /**
   * Get available localization data which can be used during the import process
   * @returns {Promise<LocalizationData>}
   */
  async #prepareLocalizationData() {
    const path = `modules/${CONFIGURATION.moduleId}/lang/${game.i18n.lang}/${this.config.slug}`;

    // Do not localize for English, instead use the true data directly from the Adventure document
    if (game.i18n.lang === "en") return { path, i18n: {}, html: new Set() };

    // Prepare localization data
    const json = `${path}/${this.config.slug}.json`;
    try {
      const files = (await FilePicker.browse("data", path)).files;
      const i18n = files.includes(json) ? await fetch(json).then((r) => r.json()) : {};
      const html = new Set(files.filter((f) => f.endsWith(".html")));
      return { path, i18n, html };
    } catch (err) {
      return { path, i18n: {}, html: new Set() };
    }
  }

  /* -------------------------------------------- */

  /**
   * Merge Actor data with authoritative source data from system compendium packs
   * @param {Actor[]} actors        Actor documents intended to be imported
   * @param {object} importOptions  Form submission import options
   * @returns {Promise<void>}
   */
  async #mergeCompendiumActors(actors, importOptions) {
    const beginnerMonsters = importOptions.beginnerMonsters;
    for (const actor of actors) {
      let source;
      let pack;

      // Retrieve a source document
      switch (actor.type) {
        case "character":
          const iconicPackId = beginnerMonsters ? "pf2e.paizo-pregens" : "pf2e.iconics";
          pack = game.packs.get(iconicPackId);
          source = await pack.getDocument(actor._id);
          break;
        case "hazard":
          pack = game.packs.get("pf2e.menace-under-otari-bestiary");
          source = await pack.getDocument(actor._id);
          break;
        case "npc":
          const npcPackId = beginnerMonsters ? "pf2e.menace-under-otari-bestiary" : "pf2e.pathfinder-bestiary";
          pack = game.packs.get(npcPackId);
          source = await pack.getDocument(actor._id);
          break;
        case "loot":
          continue;
      }

      // Merge that source document
      if (source) {
        const sourceData = source.toObject();
        foundry.utils.mergeObject(actor, {
          system: sourceData.system,
          items: sourceData.items,
          effects: sourceData.effects,
          rules: sourceData.rules,
          "flags.core.sourceId": source.uuid,
        });
      }
      else console.warn(`[${CONFIGURATION.moduleId}] Compendium source data for "${actor.name}" [${actor._id}]`
        + ` not found in pack ${pack?.collection}`);
    }
  }

  /* -------------------------------------------- */

  /**
   * Merge JournalEntry data with localized source HTML.
   * @param {JournalEntry[]} entries                JournalEntry documents intended to be imported
   * @returns {Promise<void>}
   */
  async #mergeJournalHTML(entries) {
    for (const entry of entries) {
      for (const page of entry.pages) {
        const htmlFile = `${this.#localization.path}/${page._id}-${page.name.slugify({ strict: true })}.html`;
        if (this.#localization.html.has(htmlFile)) {
          const content = await fetch(htmlFile)
            .then((r) => r.text())
            .catch((err) => null);
          if (content) foundry.utils.mergeObject(page, { "text.content": content });
        }
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Apply localization translations to documents prior to import.
   * @param {Object<string,Document[]>} group       A group of documents to be created or updated
   * @returns {Promise<void>}
   */
  async #applyTranslations(group) {
    for (const [documentName, documents] of Object.entries(group)) {
      const cls = getDocumentClass(documentName);
      const translations = this.#localization.i18n[cls.collectionName] || [];

      // Iterate over documents to translate
      for (const document of documents) {
        const translation = translations.find((d) => d._id === document._id);
        if ( !translation ) continue;
        const doc = cls.fromSource(document);

        // Special handling for rules elements
        if ( (documentName === "Item") && translation.system?.rules) {
          translation.system.rules = this.#translateRulesElements(doc.system.rules, translation.system.rules);
        }
        else if ( (documentName === "Actor") && translation.items ) {
          for ( const ti of translation.items ) {
            const i = doc.items.find(i => i._id === ti._id);
            if ( ti.system?.rules ) ti.system.rules = this.#translateRulesElements(i.system.rules, ti.system.rules);
          }
        }

        // Update the document with translated values and merge the final result back
        doc.updateSource(translation);
        foundry.utils.mergeObject(document, doc.toObject());
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Special handling to translate rules elements
   * @param {object[]} rulesData
   * @param {object[]} translations
   */
  #translateRulesElements(rulesData, translations) {
    return rulesData.map((rule, i) => foundry.utils.mergeObject(rule, translations[i]));
  }
}

/* -------------------------------------------- */

/**
 * Apply localization translations to rule elements prior to import.
 * @param {Array[]} rules          An array of rule elements
 * @param {Object>} translations   An object list containing localized rule element fields
 * @returns {Array[]}              The localized rule element array
 */
function _applyRulesTranslations(rules, translations) {
  const rulesArray = [];
  rules.forEach((value, key) => {
    rulesArray.push(foundry.utils.mergeObject(value, translations[key]));
  });
  return rulesArray;
}
