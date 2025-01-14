document.addEventListener("DOMContentLoaded", async () => {
  const novelData = (await browser.storage.local.get("novelData")).novelData || [];

  const deleteAllButton = document.getElementById("btn-delete-all");
  deleteAllButton.addEventListener("click", async () => {
    const existingStorage = await browser.storage.local.get();
    delete existingStorage.novelData;
    await browser.storage.local.set({ novelData: [], ...existingStorage });
  });

  await updateBookTable(novelData);
});

browser.storage.local.onChanged.addListener(async (changes) => {
  if (changes.novelData) {
    await updateBookTable(changes.novelData.newValue);
  }
});

async function updateBookTable(novelData) {
  const bookTableData = document.getElementById("book-table-data");
  const deleteAllButton = document.getElementById("btn-delete-all");

  bookTableData.innerHTML = "";
  novelData.forEach((book, index) => {
    bookTableData.appendChild(createBookRow(book, index + 1));
  });

  if (novelData.length === 0) {
    bookTableData.innerHTML = "<tr><td style='padding: 16px 0;' colspan='4'>No saved books</td></tr>";
    deleteAllButton.setAttribute("disabled", "disabled");
  } else {
    deleteAllButton.removeAttribute("disabled");
  }
}

function createBookRow(bookData, no) {
  const row = document.createElement("tr");
  const noCell = document.createElement("td");
  const nameCell = document.createElement("td");
  const chapterCell = document.createElement("td");
  const actionCell = document.createElement("td");

  noCell.textContent = no + ".";
  nameCell.textContent = bookData.name;
  chapterCell.textContent = formatChapters(bookData.data);
  actionCell.innerHTML = `
    <button class="btn-extract" title="Extract EPUB" data-book-name="${bookData.name}">
        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#ffffff">
            <path d="M564-578v-76q31-10 64-14.5t68-4.5q23 0 46.5 2.5T792-663v74q-30-7-53-10t-43-3q-34 0-67 6t-65 18Zm0 236v-76q28-9 60-14.5t72-5.5q27 0 50.5 3t45.5 8v74q-30-7-53-10t-43-3q-34 0-67 6t-65 18Zm0-118v-76q32-10 65.5-15t66.5-5q27 0 50.5 3t45.5 8v74q-26-7-49.5-10t-46.5-3q-32 0-64.5 6T564-460ZM264-288q47 0 92 12t88 30v-454q-42-22-87-33t-93-11q-37 0-73.5 6.5T120-716v452q35-13 71-18.5t73-5.5Zm252 42q43-20 88-31t92-11q37 0 73.5 4.5T840-264v-452q-35-13-71-20.5t-73-7.5q-48 0-93 11t-87 33v454Zm-36 102q-49-32-103-52t-113-20q-38 0-76 7.5T115-186q-24 10-45.5-3.5T48-229v-503q0-14 7.5-26T76-776q45-20 92-30t96-10q57 0 111.5 13.5T480-762q51-26 105-40t111-14q49 0 96 10t92 30q13 6 21 18t8 26v503q0 25-15.5 40t-32.5 7q-40-18-82.5-26t-86.5-8q-59 0-113 20t-103 52ZM283-495Z"/>
        </svg>
    </button>
    <button title="Delete this book" class="btn-delete" data-book-name="${bookData.name}">
        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#ffffff">
            <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
        </svg>
    </button>`;

  actionCell.querySelector(".btn-extract").addEventListener("click", async (event) => {
    const bookName = event.currentTarget.getAttribute("data-book-name");
    console.log(bookName);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", (event) => {
      const file = event.target.files[0]; // Get the selected file

      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          // Send the base64 image back to the background script
          //   browser.runtime.sendMessage({
          //     command: "set-cover-image",
          //     image: reader.result, // Base64-encoded image
          //   });
          //   browser.runtime.sendMessage({ command: "epub", data: existingData });
          //   await browser.storage.local.clear();
          //   showToast("Extracting EPUB File...");
        };
        reader.readAsDataURL(file); // Convert the image file to base64
      }
    });

    // Detect when the dialog is closed without selecting a file
    input.addEventListener("cancel", () => {
      //   showToast("You need to upload the cover image."); // Show message if no file is selected
    });

    input.click(); // Trigger the file input
  });

  actionCell.querySelector(".btn-delete").addEventListener("click", async (event) => {
    const bookName = event.currentTarget.getAttribute("data-book-name");
    await deleteBook(bookName);
  });

  row.appendChild(noCell);
  row.appendChild(nameCell);
  row.appendChild(chapterCell);
  row.appendChild(actionCell);

  return row;
}

async function deleteBook(bookName) {
  const existingStorage = await browser.storage.local.get();
  const existingData = existingStorage?.novelData || [];
  const index = existingData.findIndex((item) => item.name === bookName);
  if (index !== -1) existingData.splice(index, 1);

  await browser.storage.local.set({ novelData: existingData, ...existingStorage });
}

function formatChapters(chapterData) {
  if (!chapterData || chapterData.length === 0) return "";

  const chapterNumbers = chapterData.map((chapter) => chapter.no).sort((a, b) => a - b);

  let result = [];
  let rangeStart = chapterNumbers[0];
  let previous = chapterNumbers[0];

  for (let i = 1; i < chapterNumbers.length; i++) {
    const current = chapterNumbers[i];

    if (current !== previous + 1) {
      // If the sequence breaks, finalize the current range
      if (rangeStart === previous) {
        result.push(`${rangeStart}`);
      } else {
        result.push(`${rangeStart} - ${previous}`);
      }
      rangeStart = current; // Start a new range
    }

    previous = current;
  }

  // Finalize the last range
  if (rangeStart === previous) {
    result.push(`${rangeStart}`);
  } else {
    result.push(`${rangeStart} - ${previous}`);
  }

  return result.join(", ");
}
