// The Menace Under Otari Adventure
const MENACE_UNDER_OTARI = {
  id: "5QXyvFAkXMfGuqT3",
  slug: "menace-under-otari",
  importOptions: {
    enhancedMaps: {
      label: "PF2EBB.ImportEnhancedMaps",
      default: true,
      sceneIds: {
        original: ["GN8rnmtLqwFIqZ7F", "kiSlv7vcx4HrVCmd"],
        enhanced: ["JJJCFUCadDPRwnSX", "cgv9iVmx3dNIL3YA"],
      },
      handler: (adventure, option, enabled) => {
        return Scene.updateDocuments([
          ...option.sceneIds.original.map((_id) => ({ _id, navigation: !enabled })),
          ...option.sceneIds.enhanced.map((_id) => ({ _id, navigation: enabled })),
        ]);
      },
    },
    beginnerMonsters: {
      label: "PF2EBB.ImportBeginnerMonsters",
      default: true,
    },
    activateScene: {
      label: "PF2EBB.ImportActivateScene",
      default: true,
      handler: (adventure, option, enabled) => {
        if (!enabled) return;
        return game.scenes.get(option.sceneId).activate();
      },
      sceneId: "U5t0Mq8glKBXO3qH",
    },
    displayJournal: {
      label: "PF2EBB.ImportDisplayJournal",
      default: true,
      handler: (adventure, option, enabled) => {
        if (!enabled) return;
        const entry = game.journal.get(option.entryId);
        return entry.sheet.render(true);
      },
      entryId: "S1UnJk4t55aRFaCs",
    },
    populateHotbar: {
      label: "PF2EBB.ImportPopulateHotbar",
      default: true,
      handler: (adventure, option, enabled) => {
        if (enabled) game.user.update({ hotbar: option.hotbar });
      },
      hotbar: { 1: "x0YlgNBucXkYT6RG", 2: "MppBkkOiWyW1z6fW" },
    },
    customizeJoin: {
      label: "PF2EBB.ImportCustomizeWorld",
      default: false,
      background: "modules/pf2e-beginner-box/assets/artwork-vignettes/view-of-otari.webp",
      handler: async (adventure, option, enabled) => {
        if (!enabled) return;
        const worldData = {
          action: "editWorld",
          id: game.world.id,
          description: game.i18n.localize("PF2EBB.WorldDescription"),
          background: option.background,
        };
        await fetchJsonWithTimeout(foundry.utils.getRoute("setup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(worldData),
        });
        game.world.updateSource(worldData);
      },
    },
  },
};

// The Pirate King's Plunder Adventure
const PIRATE_KINGS_PLUNDER = {
  id: "5KQWZpnK28WGytlL",
  slug: "pirate-kings-plunder",
  importOptions: {
    displayJournal: {
      label: "PF2EBB.ImportDisplayJournal",
      default: true,
      entryId: "MNx5B6xIGsHwGzqe",
      handler: (adventure, option, enabled) => {
        if (!enabled) return;
        const entry = game.journal.get(option.entryId);
        return entry.sheet.render(true);
      },
    },
  },
};

// Beginner's Box Module Credits
const CREDITS = {
  id: "4hyvl2gjUfMNSExJ",
  slug: "credits",
};

export default {
  moduleId: "pf2e-beginner-box",
  packName: "adventures",
  journalFlag: "isBB",
  cssClass: "pf2e-bb",
  adventures: [MENACE_UNDER_OTARI, PIRATE_KINGS_PLUNDER, CREDITS],
};
