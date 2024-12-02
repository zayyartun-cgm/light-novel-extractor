browser.runtime.onMessage.addListener(async (message) => {
  if (message.command === "store") {
    const title = document.title;
    const extractedTitle = title.split("|")[0].trim();
    const [novelName, chapterName] = extractedTitle.split("-").map((part) => part.trim());
    console.log(novelName);
    console.log(chapterName);
    const contentDiv = document.getElementById("chapter-container");
    if (contentDiv) {
      const paragraphs = contentDiv.querySelectorAll("p");
      const content = Array.from(paragraphs)
        .map((p) => p.innerHTML)
        .join("\n");

      // retrieve existing data
      const existingData = (await browser.storage.local.get("novelData")).novelData ?? [];
      let addNew = true;
      for (let i = 0; i < existingData.length; i++) {
        if (existingData[i].chapter === chapterName && existingData[i].name === novelName) {
          addNew = false;
          break;
        }
      }
      console.log(existingData);
      if (addNew) existingData.push({ name: novelName, chapter: chapterName, content: content });

      await browser.storage.local.set({ novelData: existingData });

      // browser.runtime.sendMessage({ command: "storeContent", data: title });
    }
  } else if (message.command === "clear") {
    await browser.storage.local.clear();
  }
});
