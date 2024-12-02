browser.runtime.onMessage.addListener((message) => {
  if (message.command === "store") {
    const title = document.title;
    const contentDiv = document.getElementById("chapter-container");
    if (contentDiv) {
      const paragraphs = contentDiv.querySelectorAll("p");
      const content = Array.from(paragraphs)
        .map((p) => p.innerHTML)
        .join("\n");

      browser.runtime.sendMessage({ command: "storeContent", data: title });
    }
  }
});
