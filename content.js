let isSaving = false;

function showToast(message) {
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
  toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";

  // Append the toast to the document body
  document.body.appendChild(toast);

  // Show the toast with a fade-in effect
  setTimeout(() => (toast.style.opacity = "1"), 0);

  // Move existing toasts up
  document.querySelectorAll(".extension-toast").forEach((existingToast) => {
    if (existingToast !== toast) {
      existingToast.style.transform = `translateY(-${toast.offsetHeight + 10}px)`;
    }
  });

  // Remove the toast after 3 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function extractContent() {
  let bookTitle = document.getElementsByClassName("booktitle")[0]?.textContent.trim();
  const chapterTitle = document.getElementsByClassName("chapter-title")[0]?.textContent.trim();
  const contentDiv = document.getElementById("chapter-container");

  if (!bookTitle || !chapterTitle || !contentDiv) return;

  const chapterTitleParts = chapterTitle.match(/[Cc]hapter\s*(\d+):?\s*(.*)?/i);
  const chapterNo = parseInt(chapterTitleParts[1], 10);
  const chapterName = chapterTitleParts[2]?.trim() || "";

  if (!chapterTitle.trim().toLowerCase().startsWith("chapter")) {
    const frontPart = chapterTitle.split(chapterTitleParts[0])[0].trim();
    bookTitle = `${bookTitle} ${frontPart}`.replace(/[\\/:?"<>|]/g, "");
  }

  const paragraphs = contentDiv.querySelectorAll("p");
  const content = Array.from(paragraphs)
    .map((p) => p.textContent.trim())
    .join("\n");

  const existingData = (await browser.storage.local.get("novelData")).novelData ?? [];
  const index = existingData.findIndex((item) => item.name === bookTitle);

  if (index === -1) {
    existingData.push({ name: bookTitle, data: [{ no: chapterNo, chapter: chapterName, content: content }] });
  } else {
    const isExist = existingData[index].data.some((item) => item.no === chapterNo && item.chapter === chapterName);
    if (!isExist) existingData[index].data.push({ no: chapterNo, chapter: chapterName, content: content });
    existingData[index].data.sort((a, b) => a.no - b.no);
  }

  await browser.storage.local.set({ novelData: existingData, recording: isSaving });
  showToast(`Saved: ${bookTitle} - ${chapterName}`);
}

async function clearCurrentBook() {
  let bookTitle = document.getElementsByClassName("booktitle")[0]?.textContent.trim();
  const chapterTitle = document.getElementsByClassName("chapter-title")[0]?.textContent.trim();

  if (!bookTitle || !chapterTitle) return;
  const chapterTitleParts = chapterTitle.match(/[Cc]hapter\s*(\d+):?\s*(.*)?/i);

  if (!chapterTitle.trim().toLowerCase().startsWith("chapter")) {
    const frontPart = chapterTitle.split(chapterTitleParts[0])[0].trim();
    bookTitle = `${bookTitle} ${frontPart}`.replace(/[\\/:?"<>|]/g, "");
  }

  const existingData = (await browser.storage.local.get("novelData")).novelData ?? [];
  const index = existingData.findIndex((item) => item.name === bookTitle);
  if (index !== -1) {
    existingData.splice(index, 1);
    showToast(`Cleared: ${bookTitle}`);
  }

  await browser.storage.local.set({ novelData: existingData, recording: isSaving });
}

async function initialize() {
  isSaving = (await browser.storage.local.get("recording")).recording ?? false;
  if (isSaving) await extractContent();
}

async function updateRecordingStatus() {
  const existingData = (await browser.storage.local.get("novelData")).novelData ?? [];
  await browser.storage.local.set({ recording: isSaving, novelData: existingData });
}

initialize();

browser.runtime.onMessage.addListener(async (message) => {
  if (message.command === "clear-all") {
    await browser.storage.local.set({ recording: isSaving, novelData: [] });
    showToast("All saved books cleared.");
  } else if (message.command === "start-saving") {
    isSaving = true;
    await extractContent();
    browser.runtime.sendMessage({ command: "result", data: { recording: isSaving } });
    showToast("Recording started.");
  } else if (message.command === "stop-saving") {
    isSaving = false;
    await updateRecordingStatus();
    showToast("Recording stopped.");
  } else if (message.command === "clear-current") {
    await clearCurrentBook();
  } else if (message.command === "extract-epub") {
    const existingData = (await browser.storage.local.get("novelData")).novelData ?? [];
    if (existingData.length > 0) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      showToast("Please upload the cover image.");

      input.addEventListener("change", (event) => {
        const file = event.target.files[0]; // Get the selected file

        if (file) {
          const reader = new FileReader();
          reader.onload = async () => {
            // Send the base64 image back to the background script
            browser.runtime.sendMessage({
              command: "set-cover-image",
              image: reader.result, // Base64-encoded image
            });

            browser.runtime.sendMessage({ command: "epub", data: existingData });
            await browser.storage.local.clear();
            showToast("Extracting EPUB File...");
          };
          reader.readAsDataURL(file); // Convert the image file to base64
        }
      });

      // Detect when the dialog is closed without selecting a file
      input.addEventListener("cancel", () => {
        showToast("You need to upload the cover image."); // Show message if no file is selected
      });

      input.click(); // Trigger the file input
    } else {
      showToast("No data to extract.");
    }
  }
});
