let isRecording = false;
let coverImage;

// Create a context menu
browser.contextMenus.create({
  id: "save",
  title: "Start Saving",
  icons: {
    16: "/icons/screen_record.svg",
    32: "/icons/screen_record.svg",
  },
  contexts: ["page"],
});

browser.contextMenus.create({
  id: "separator-1",
  type: "separator",
  contexts: ["page"],
});

// browser.contextMenus.create({
//   id: "extract-epub",
//   title: "Extract EPUB",
//   icons: {
//     16: "/icons/menu_book.svg",
//     32: "/icons/menu_book.svg",
//   },
//   contexts: ["page"],
// });

browser.contextMenus.create({
  id: "clear-current",
  title: "Clear Current Book",
  icons: {
    16: "/icons/delete.svg",
    32: "/icons/delete.svg",
  },
  contexts: ["page"],
});

browser.contextMenus.create({
  id: "separator-2",
  type: "separator",
  contexts: ["page"],
});

browser.contextMenus.create({
  id: "clear-all",
  title: "Clear All",
  icons: {
    16: "/icons/delete_forever.svg",
    32: "/icons/delete_forever.svg",
  },
  contexts: ["page"],
});

browser.contextMenus.create({
  id: "separator-3",
  type: "separator",
  contexts: ["page"],
});

browser.contextMenus.create({
  id: "saved-items",
  title: "Show Saved Items",
  icons: {
    16: "/icons/description.svg",
    32: "/icons/description.svg",
  },
  contexts: ["page"],
});

// Add a listener for when the menu item is clicked
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save") {
    // Send a message to the content script
    if (isRecording) browser.tabs.sendMessage(tab.id, { command: "stop-saving" });
    else browser.tabs.sendMessage(tab.id, { command: "start-saving" });
  } else if (info.menuItemId === "clear-current") {
    browser.tabs.sendMessage(tab.id, { command: "clear-current" });
  } else if (info.menuItemId === "clear-all") {
    browser.tabs.sendMessage(tab.id, { command: "clear-all" });
  } else if (info.menuItemId === "extract-epub") {
    browser.tabs.sendMessage(tab.id, { command: "extract-epub" });
  } else if (info.menuItemId === "saved-items") {
    browser.tabs.create({ url: browser.runtime.getURL("html/saved_item.html") });
  }
});

function updateRecordingSubmenu(isRecording) {
  browser.contextMenus.update("save", {
    title: isRecording ? "Stop Saving" : "Start Saving",
    icons: {
      16: isRecording ? "/icons/radio_button_checked.svg" : "/icons/screen_record.svg",
      32: isRecording ? "/icons/radio_button_checked.svg" : "/icons/screen_record.svg",
    },
  });
}

async function generateEPUB(data) {
  const bookName = data[0].name.replace(/[\\/:?"<>|]/g, "");
  const startChapter = data[0].no;
  const endChapter = data[data.length - 1].no;
  const uuid = crypto.randomUUID();
  const fileName = startChapter === endChapter ? `${bookName} (chapter - ${startChapter}).epub` : `${bookName} (${startChapter}-${endChapter}).epub`;
  const epubBookName = startChapter === endChapter ? `${bookName} (chapter - ${startChapter})` : `${bookName} (${startChapter}-${endChapter})`;

  const zip = new JSZip();

  // Add EPUB structure
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  const imageData = coverImage.split(",")[1]; // Extract base64 data
  const imageType = coverImage.match(/^data:(image\/[a-z]+);base64/)[1]; // Extract MIME type
  const imageExtension = imageType.split("/")[1]; // Extract extension (e.g., jpg, png)
  zip.file(`OEBPS/Images/cover.${imageExtension}`, imageData, { base64: true });

  // Add META-INF/container.xml
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
              <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`
  );

  // Add OEBPS/content.opf
  const manifest = data
    .map(
      (_, index) => `
      <item id="chapter${index + 1}.xhtml" href="Text/chapter${index + 1}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join("\n");

  const spine = data.map((_, index) => `<itemref idref="chapter${index + 1}.xhtml"/>`).join("\n");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf" xml:lang="en">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="book-id">${uuid}</dc:identifier>
        <dc:title>${epubBookName}</dc:title>
        <dc:creator>Generated EPUB</dc:creator>
        <dc:language>en</dc:language>
        <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
        <meta name="cover" content="cover"/>
      </metadata>
      <manifest>
        <item id="titlepage.xhtml" href="Text/titlepage.xhtml" media-type="application/xhtml+xml"/>
        <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="nav.xhtml" href="Text/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        ${manifest}
      </manifest>
      <spine page-progression-direction="ltr" toc="toc">
        <itemref idref="titlepage.xhtml"/>
        <itemref idref="nav.xhtml" />
        ${spine}
      </spine>
      <guide>
        <reference type="toc" title="Table of Contents" href="Text/nav.xhtml"/>
        <reference type="cover" href="Text/titlepage.xhtml" title="Cover"/>
      </guide>
    </package>`
  );

  // Add OEBPS/toc.ncx
  const navPoints = data
    .map(
      (item, index) => `
      <navPoint id="navPoint${index + 1}">
        <navLabel><text>Chapter ${item.no}${item.chapter ? `: ${item.chapter}` : ""}</text></navLabel>
        <content src="Text/chapter${index + 1}.xhtml"/>
      </navPoint>`
    )
    .join("\n");

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
    <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
      <head>
        <meta name="dtb:uid" content="${uuid}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
      </head>
      <docTitle>
        <text>${epubBookName}</text>
      </docTitle>
      <navMap>
        ${navPoints}
      </navMap>
    </ncx>`
  );

  zip.file(
    "OEBPS/Text/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
      <head>
        <title>Navigation</title>
      </head>
      <body>
        <nav epub:type="toc" style="padding: 0 8px;">
          <h2>Table of Contents</h2>
          <ul style="list-style-type: none; padding: 0;">
            ${data.map((item, index) => `<li><a href="chapter${index + 1}.xhtml" style="text-decoration: none; color: black; line-height: 30px;">Chapter ${item.no}${item.chapter ? `: ${item.chapter}` : ""}</a></li>`).join("\n")}
          </ul>
        </nav>
      </body>
    </html>`
  );

  zip.file(
    `OEBPS/Text/titlepage.xhtml`,
    `<?xml version='1.0' encoding='utf-8'?>
      <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
          <head>
              <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
              <meta name="calibre:cover" content="true"/>
              <title>Cover</title>
              <style type="text/css" title="override_css">
                  @page {padding: 0pt; margin:0pt}
                  body { text-align: center; padding:0pt; margin: 0pt; }
              </style>
          </head>
          <body>
              <div>
                  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 267 400" preserveAspectRatio="none">
                    <image width="267" height="400" xlink:href="../Images/cover.${imageExtension}"/>  
                  </svg>
              </div>
          </body>
      </html>
      `
  );

  // Add chapter files
  data.forEach((item, index) => {
    const detailContent = item.content.split("\n");
    const contentElement = detailContent.map((item) => `<p style="text-align: justify;">${item}</p>`).join("");

    zip.file(
      `OEBPS/Text/chapter${index + 1}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
        <head>
          <meta content="text/html; charset=UTF-8" http-equiv="default-style"/>
          <title>Chapter ${item.no}: ${item.chapter}</title>
        </head>
        <body>
          <section epub:type="bodymatter chapter" id="chapter${index + 1}">
            <h2 style="text-align: center;">Chapter ${item.no}${item.chapter ? `: ${item.chapter}` : ""}</h2>
            ${contentElement}
          </section>
        </body>
      </html>`
    );
  });

  // Generate a downloadable EPUB file from the ZIP file
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  // Trigger download
  await browser.downloads.download({
    url: url,
    filename: fileName,
    saveAs: true,
  });
}

browser.runtime.onMessage.addListener(async (message) => {
  if (message.command === "result") {
    const data = message.data;
    isRecording = data.recording;
    updateRecordingSubmenu(isRecording);
  } else if (message.command === "epub") {
    if (!coverImage) {
      console.error("Cover image not available");
      return;
    }
    isRecording = false;
    updateRecordingSubmenu(isRecording);
    const data = message.data;
    await generateEPUB(data);
  } else if (message.command === "set-cover-image") {
    coverImage = message.image;
  }
});
