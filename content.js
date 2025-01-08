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
  console.log(title);

  if (title.toLowerCase().startsWith("just a moment...")) return;

  const extractedTitle = title.split("|")[0].trim();
  const extractedTitleParts = extractedTitle.split("-");

  // Extract the novel name and full chapter name
  let novelName = extractedTitleParts[0].trim(); // Default to the first part
  let fullChapterName = extractedTitleParts[1]?.trim() || ""; // Default to empty if undefined

  // Check if the first part contains "Book" and adjust the novel name accordingly
  if (novelName.toLowerCase().includes("book")) {
    // Merge the book title with the novel name
    novelName = `${extractedTitleParts[0].trim()} ${extractedTitleParts[1]?.trim() || ""}`.replace(/\s+/, " ");
    fullChapterName = extractedTitleParts[2]?.trim() || ""; // Move to the next part for chapter name
  }

  // Extract chapter number and name from the full chapter name
  let chapterName = "";
  let chapterNo = 0;

  console.log("Full Chapter Name:", fullChapterName);
  if (fullChapterName) {
    const chapterNameParts = fullChapterName.match(/Chapter\s*(\d+):?\s*(.*)?/i); // Use regex for better matching

    console.log(chapterNameParts);
    if (chapterNameParts) {
      chapterNo = parseInt(chapterNameParts[1], 10) || 0; // Extract chapter number
      chapterName = chapterNameParts[2]?.trim() || ""; // Extract chapter name
    } else {
      console.error("The chapter number cannot be extracted");
      return;
    }
  }

  console.log("Novel Name:", novelName);
  console.log("Chapter Number:", chapterNo);
  console.log("Chapter Name:", chapterName);

  const contentDiv = document.getElementById("chapter-container");
  if (!contentDiv) {
    console.error("The content cannot be extracted");
    return;
  }

  const paragraphs = contentDiv.querySelectorAll("p");
  const content = Array.from(paragraphs)
    .map((p) => p.textContent.trim())
    .join("\n");

  // Retrieve existing data
  const existingData = (await browser.storage.local.get("novelData")).novelData ?? [];
  let addNew = true;
  for (let i = 0; i < existingData.length; i++) {
    if (existingData[i].chapter === chapterName && existingData[i].name === novelName) {
      addNew = false;
      break;
    }
  }
  if (addNew) existingData.push({ name: novelName, no: chapterNo, chapter: chapterName, content: content });

  existingData.sort((a, b) => a.no - b.no);
  console.log(existingData);
  await browser.storage.local.set({ novelData: existingData, recording: isRecording });

  const no = existingData.map((item) => item.no);
  browser.runtime.sendMessage({ command: "result", data: { recording: isRecording, no: no } });
}

async function initialize() {
  isRecording = (await browser.storage.local.get("recording")).recording ?? false;
  if (isRecording) await extractContent();
}

initialize();

browser.runtime.onMessage.addListener(async (message) => {
  if (message.command === "clear-all") {
    await browser.storage.local.set({ recording: isRecording, novelData: [] });
    const existingData = (await browser.storage.local.get("novelData")).novelData ?? [];
    console.log(existingData);
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
