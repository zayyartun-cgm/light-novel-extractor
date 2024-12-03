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

  const zip = new JSZip();
  // Add EPUB structure
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `
    <?xml version="1.0" encoding="UTF-8"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>
    `
  );

  var metadata = `<?xml version="1.0"?>
    <package version="3.0" xml:lang="en" xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:identifier id="book-id">urn:uuid:B9B412F2-CAAD-4A44-B91F-A375068478A0</dc:identifier>
            <meta refines="#book-id" property="identifier-type" scheme="xsd:string">uuid</meta>
            <meta property="dcterms:modified">${new Date().toISOString()}</meta>
            <dc:language>en</dc:language>
            <dc:title>${bookName}</dc:title>
            <dc:creator>Zay Yar Tun</dc:creator>
        </metadata>
        <manifest>
            <item id="text" href="text.xhtml" media-type="application/xhtml+xml"/>
            <item id="toc" href="../OEBPS/toc.ncx" media-type="application/x-dtbncx+xml"/>
        </manifest>
        <spine toc="toc">
            <itemref idref="text"/>
        </spine>
    </package>
  `;
  zip.file("OEBPS/content.opf", metadata);

  let navMap = ``;

  data.forEach((item, index) => {
    navMap += `<navPoint id="navpoint-${index}" playOrder="${index}">
  <navLabel><text>Chapter ${item.no}: ${item.chapter}</text></navLabel><content src="text.xhtml#xpointer(/html/body/section[${index}])"/>`;
  });

  // Set the table of contents for the book
  var toc = `<?xml version="1.0"?>
    <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
        <head>
            <meta name="dtb:uid" content="urn:uuid:B9B412F2-CAAD-4A44-B91F-A375068478A0"/>
            <meta name="dtb:depth" content="1"/>
            <meta name="dtb:totalPageCount" content="0"/>
            <meta name="dtb:maxPageNumber" content="0"/>
        </head>
        <docTitle>
            <text>${bookName}</text>
        </docTitle>
        <navMap>
            ${navMap}
        </navMap>
    </ncx>`;
  zip.file("OEBPS/toc.ncx", toc);

  let content = ``;

  data.forEach((item) => {
    // console.log(item.content);
    const detailContent = item.content.split("\n");
    const contentElement = detailContent.map((item) => `<p>${item}</p>`).join("");
    content += `<section><h1 style="text-align: center;">Chapter ${item.no}</h1>${contentElement}</section>`;
  });

  // Add the text of the book to the ZIP file
  var text = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
        <head>
            <title>${bookName}</title>
        </head>
        <body>
           ${content}
        </body>
    </html>`;
  zip.file("OEBPS/text.xhtml", text);

  // Generate a downloadable EPUB file from the ZIP file
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  const name = startChapter === endChapter ? `${bookName} (chapter - ${startChapter}).epub` : `${bookName} (${startChapter}-${endChapter}).epub`;

  // Trigger download
  await browser.downloads.download({
    url: url,
    filename: name,
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
