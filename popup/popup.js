document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-store").addEventListener("click", async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    browser.tabs.sendMessage(tab.id, {
      command: "store",
    });
    console.log(tab);
  });

  document.getElementById("btn-clear").addEventListener("click", async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    browser.tabs.sendMessage(tab.id, {
      command: "clear",
    });
  });
});
