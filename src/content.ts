console.log("Content script active:", window.location.href);

async function applySelectors() {
    try {
        const hostname = window.location.hostname;
        const { enabled = true } = await chrome.storage.sync.get({ enabled: true });
        if (!enabled) return;

        const result = await chrome.storage.sync.get(hostname);
        const selectors = result[hostname]?.selectors || [];

        selectors.forEach((sel: string) => {
            try {
                document.querySelectorAll(sel).forEach(el => el.remove());
            } catch (err) {
                console.error(`Invalid selector: ${sel}`, err);
            }
        });
    } catch (err: any) {
        if (err.message?.includes("Extension context invalidated")) {
            console.warn("Extension reloaded — ignoring cleanup.");
            return;
        }
        console.error("Unexpected error in runHider:", err);
    }
}

applySelectors();


chrome.runtime.onMessage.addListener((msg) => {
    if (!chrome.runtime?.id) return;
    if (msg.type === "toggleExtension" || msg.type === "refreshSelectors") {
        applySelectors();
    }
});


const observer = new MutationObserver(() => {
    applySelectors();
});

if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
}


