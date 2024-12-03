let isRecording = false;

function showToast(message) {
  // Remove any existing toast messages
  document.querySelectorAll(".extension-toast").forEach((toast) => toast.remove());

  // Create a new toast element
  const toast = document.createElement("div");
  toast.className = "extension-toast";
  toast.innerText = message;

  // Apply basic styling
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.background = "rgba(0, 0, 0, 0.8)";
  toast.style.color = "#fff";
  toast.style.padding = "10px 15px";
  toast.style.borderRadius = "5px";
  toast.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
  toast.style.fontSize = "14px";
  toast.style.zIndex = "9999";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.4s ease";

  // Append the toast to the document body
  document.body.appendChild(toast);

  // Show the toast with a fade-in effect
  setTimeout(() => (toast.style.opacity = "1"), 0);

  // Remove the toast after 3 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function extractContent() {
  const title = document.title;
  const extractedTitle = title.split("|")[0].trim();
  const [novelName, chapterName] = extractedTitle.split("-").map((part) => part.trim());
  const chapterNameParts = chapterName.split(":");
  const chapterNo = Number(chapterNameParts[0].split(" ")[1]);
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
      if (existingData[i].chapter === chapterNameParts[1].trim() && existingData[i].name === novelName) {
        addNew = false;
        break;
      }
    }
    if (addNew) existingData.push({ name: novelName, no: chapterNo, chapter: chapterNameParts[1].trim(), content: content });

    existingData.sort((a, b) => a.no - b.no);
    console.log(existingData);
    await browser.storage.local.set({ novelData: existingData, recording: isRecording });

    const no = existingData.map((item) => item.no);
    browser.runtime.sendMessage({ command: "result", data: { recording: isRecording, no: no } });
  }
}

async function initialize() {
  isRecording = (await browser.storage.local.get("recording")).recording ?? false;
  if (isRecording) await extractContent();
}

initialize();

browser.runtime.onMessage.addListener(async (message) => {
  if (message.command === "clear-all") {
    await browser.storage.local.set({ recording: isRecording });
    showToast("All saved pages cleared.");
  } else if (message.command === "start-recording") {
    isRecording = true;
    await extractContent();
    showToast("Recording started.");
  } else if (message.command === "stop-recording") {
    isRecording = false;
    await extractContent();
    showToast("Recording stopped.");
  } else if (message.command === "extract-epub") {
    const existingData = (await browser.storage.local.get("novelData")).novelData ?? [];
    if (existingData.length > 0) {
      browser.runtime.sendMessage({ command: "epub", data: existingData });
      await browser.storage.local.clear();
      showToast("Extracting EPUB File...");
    } else {
      showToast("No data to extract.");
    }
  }
});
