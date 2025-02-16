import CONFIG from "./adventure.mjs";
import CONFIGURATION from "./adventure.mjs";

/**
 * Define the structure of adventure data fields which require localization.
 * @type {Object<string|Array<object>>}
 */
const LOCALIZATION_FIELDS = {
  name: "",
  description: "",
  caption: "",
  actors: [
    {
      name: "",
      items: [
        {
          name: "",
          system: {
            description: {
              value: "",
            },
            publication: {
              title: "",
            },
            rules: {
              choices: {
                label: "",
              },
              label: "",
              prompt: "",
              text: "",
            },
          },
        },
      ],
      system: {
        details: {
          description: "",
          disable: "",
          publicNotes: "",
          reset: "",
          routine: "",
        },
      },
    },
  ],
  folders: [
    {
      name: "",
    },
  ],
  items: [
    {
      name: "",
      system: {
        description: {
          value: "",
        },
        publication: {
          title: "",
        },
        rules: {
          choices: {
            label: "",
          },
          label: "",
          prompt: "",
          text: "",
        },
      },
    },
  ],
  journal: [
    {
      name: "",
      pages: [
        {
          name: "",
          image: {
            caption: "",
          },
        },
      ],
    },
  ],
  macros: [
    {
      name: "",
    },
  ],
  playlists: [
    {
      name: "",
      description: "",
      sounds: [
        {
          name: "",
          description: "",
        },
      ],
    },
  ],
  scenes: [
    {
      name: "",
      navName: "",
      notes: [
        {
          text: "",
        },
      ],
      tokens: [
        {
          name: "",
          actorData: "",
        },
      ],
    },
  ],
};

/**
 * Extract the values of all localization fields from the provided adventure data
 * @returns {Array<object>} The localization schema
 */
export async function extractLocalization() {
  const pack = game.packs.get(`${CONFIG.moduleId}.${CONFIG.packName}`);
  await pack.getDocuments();

  for (const adventure of pack.contents) {
    const config = CONFIG.adventures.find((a) => a.id === adventure.id);
    const path = `modules/${CONFIG.moduleId}/lang/en/${config.slug}`;
    await FilePicker.createDirectory("data", path).catch((err) => {});

    // Extract localization fields
    const i18n = _extractLocalizedFields(adventure.toObject());
    const lf = _createFile(JSON.stringify(i18n, null, 2), `${config.slug}.json`);
    await FilePicker.upload("data", path, lf, {}, { notify: false });

    // Extract HTML
    for (const entry of adventure.data.journal) {
      for (const page of entry.pages) {
        if (!page.text.content?.trim()) continue;
        const hf = _createFile(page.text.content, `${page.id}-${page.name.slugify({ strict: true })}.html`, "text/html");
        await FilePicker.upload("data", path, hf, {}, { notify: false });
      }
    }
  }
}

/**
 * Apply localization to the index of an adventure pack which contains adventures which may be imported.
 * @param {Compendium} pack       The pack to localize
 * @returns {Promise<void>}
 */
export async function localizeCompendiumIndex(pack) {
  const path = `modules/${CONFIGURATION.moduleId}/lang/${game.i18n.lang}`;
  for (const idx of pack.index.values()) {
    const config = CONFIG.adventures.find((a) => a.id === idx._id);
    if (!config) {
      console.warn(`Adventure configuration not found for Adventure ${idx._id} in Compendium ${pack.collection}`);
      continue;
    }
    const src = `${path}/${config.slug}/${config.slug}.json`;
    let json;
    try {
      const request = await fetch(src);
      json = await request.json();
      idx.name = json.name;
    } catch (err) {
      console.warn(`Failed to load localization data for Adventure ${idx._id} in Compendium ${pack.collection}`);
    }
  }
}

/**
 * Extract the values of all localization fields from a data object and provided set of fields
 * @param {object} documentData
 * @param {Object<string|Array<object>>} fields
 * @returns {Object<string|Array<object>>}
 */
function _extractLocalizedFields(documentData, fields=LOCALIZATION_FIELDS) {
  const mapping = {};
  if ( !documentData ) return mapping;
  const sourceId = documentData.flags?.core?.sourceId;

  // For documents sourced from a compendium pack, only localize name
  if ( sourceId?.startsWith("Compendium.pf2e") && ["npc", "character", "hazard"].includes(documentData.type) ) {
    mapping.name = documentData.name;
    mapping._id = documentData._id;
    return mapping;
  }

  // Full field extraction
  for (const [key, value] of Object.entries(fields)) {

    // Special case handling For rule elements create an object structure with the array index as key
    if ( key === "rules" ) {
      mapping.rules = _extractRuleElements(documentData.rules, value);
      continue;
    }

    // Inner arrays
    if (value instanceof Array && documentData[key]) {
      const collection = documentData[key];
      const entries = collection.reduce((arr, d) => {
        const inner = _extractLocalizedFields(d, value[0]);
        if (inner) arr.push(inner);
        return arr;
      }, []);
      if (entries.length > 0) mapping[key] = entries;
      continue;
    }

    // Inner objects
    if (typeof value === "object") {
      const inner = _extractLocalizedFields(documentData[key], value);
      if ( !foundry.utils.isEmpty(inner) ) mapping[key] = inner;
      continue;
    }

    // Fields
    if (documentData[key]) mapping[key] = documentData[key];
  }

  // Skip documents which have no mapped strings
  if ( foundry.utils.isEmpty(mapping) ) return null;
  if ( documentData._id ) mapping._id = documentData._id;
  return mapping;
}

/**
 * Special handling for rules elements which are an object of arbitrary keys and schema values.
 * @private
 */
function _extractRuleElements(rulesData, rulesFields) {
  const rules = [];
  for ( const [key, value] of rulesData.entries() ) {
    const rule = _extractLocalizedFields(value, rulesFields);
    if ( !foundry.utils.isEmpty(rule) ) rules[key] = rule;
  }
  return rules;
}

/**
 * Create a File object which can be uploaded.
 * @returns {File}
 * @private
 */
function _createFile(content, fileName, dataType) {
  const blob = new Blob([content], { type: dataType });
  return new File([blob], fileName, { type: dataType });
}
