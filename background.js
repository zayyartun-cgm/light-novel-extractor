let isRecording = false;

// Create a context menu
browser.contextMenus.create({
  id: "record",
  title: "Start Recording",
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

browser.contextMenus.create({
  id: "extract-epub",
  title: "Extract EPUB",
  icons: {
    16: "/icons/menu_book.svg",
    32: "/icons/menu_book.svg",
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

// Add a listener for when the menu item is clicked
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "record") {
    // Send a message to the content script
    if (isRecording) browser.tabs.sendMessage(tab.id, { command: "stop-recording" });
    else browser.tabs.sendMessage(tab.id, { command: "start-recording" });
  } else if (info.menuItemId === "clear-all") {
    browser.tabs.sendMessage(tab.id, { command: "clear-all" });
  } else if (info.menuItemId === "extract-epub") {
    browser.tabs.sendMessage(tab.id, { command: "extract-epub" });
  }
});

function updateRecordingSubmenu(isRecording) {
  browser.contextMenus.update("record", {
    title: isRecording ? "Stop Recording" : "Start Recording",
    icons: {
      16: isRecording ? "/icons/radio_button_checked.svg" : "/icons/screen_record.svg",
      32: isRecording ? "/icons/radio_button_checked.svg" : "/icons/screen_record.svg",
    },
  });
}

async function generateEPUB(data) {
  const bookName = data[0].name;
  const startChapter = data[0].no;
  const endChapter = data[data.length - 1].no;
  const uuid = crypto.randomUUID();
  const fileName = startChapter === endChapter ? `${bookName} (chapter - ${startChapter}).epub` : `${bookName} (${startChapter}-${endChapter}).epub`;
  const epubBookName = startChapter === endChapter ? `${bookName} (chapter - ${startChapter})` : `${bookName} (${startChapter}-${endChapter})`;

  const zip = new JSZip();

  // Add EPUB structure
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

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
      </metadata>
      <manifest>
        <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="nav.xhtml" href="Text/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        ${manifest}
      </manifest>
      <spine page-progression-direction="ltr" toc="toc">
        <itemref idref="nav.xhtml" />
        ${spine}
      </spine>
      <guide>
        <reference type="toc" title="Table of Contents" href="Text/nav.xhtml"/>
      </guide>
    </package>`
  );

  // Add OEBPS/toc.ncx
  const navPoints = data
    .map(
      (item, index) => `
      <navPoint id="navPoint${index + 1}">
        <navLabel><text>Chapter ${item.no}: ${item.chapter}</text></navLabel>
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
            ${data.map((item, index) => `<li><a href="chapter${index + 1}.xhtml" style="text-decoration: none; color: black; line-height: 30px;">Chapter ${item.no}: ${item.chapter}</a></li>`).join("\n")}
          </ul>
        </nav>
      </body>
    </html>`
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
            <h2 style="text-align: center;">Chapter ${item.no}: ${item.chapter}</h2>
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
    isRecording = false;
    updateRecordingSubmenu(isRecording);
    const data = message.data;
    await generateEPUB(data);
  }
});
