const checkbox = document.getElementById('masterToggle') as HTMLInputElement;
const labelText = document.getElementById('masterLabelText') as HTMLElement;

chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
    checkbox.checked = enabled;
    labelText.textContent = enabled ? 'Extension Enabled' : 'Extension Disabled';
});

checkbox.addEventListener('change', () => {
    const isEnabled = checkbox.checked;

    labelText.textContent = isEnabled ? 'Extension Enabled' : 'Extension Disabled';

    chrome.storage.sync.set({ enabled: isEnabled });

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'toggleExtension', enabled: isEnabled });
        }
    });
});

// ----------------------------------------------------------------------------

const urlElement = document.getElementById("url");

async function displayCurrentTabUrl() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (tab?.url) {
        urlElement!.textContent = tab.url;
    } else {
        urlElement!.textContent = "Unable to get URL";
    }
}

displayCurrentTabUrl();

// ----------------------------------------------------------------------------

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-tab");

        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.toggle("active", content.id === target);
        });
    });
});

// ---------------------------------------------------------------------------- 

const input = document.getElementById("selectorInput") as HTMLInputElement;
const button = document.getElementById("hideButton") as HTMLButtonElement;
const selectorList = document.getElementById("selectorList") as HTMLUListElement;

async function getCurrentHostname(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return new URL(tab!.url!).hostname;
}

async function displaySelectors() {
    const hostname = await getCurrentHostname();
    const result = await chrome.storage.sync.get(hostname);
    const selectors: string[] = result[hostname]?.selectors || [];

    selectorList.innerHTML = "";
    selectors.forEach(sel => {
        const li = document.createElement("li");

        const delButton = document.createElement("button");
        delButton.textContent = "-";
        delButton.style.marginRight = "8px";
        delButton.addEventListener("click", async () => {
            await deleteSelector(sel);
            await displaySelectors();

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                chrome.tabs.sendMessage(tab.id, { type: "refreshSelectors" });
            }
        });

        li.appendChild(delButton);
        li.appendChild(document.createTextNode(sel));
        selectorList.appendChild(li);
    });
}

async function saveSelector(selector: string) {
    const hostname = await getCurrentHostname();
    const result = await chrome.storage.sync.get(hostname);
    const siteSelectors: string[] = result[hostname]?.selectors || [];

    if (!siteSelectors.includes(selector)) {
        siteSelectors.push(selector);
        await chrome.storage.sync.set({ [hostname]: { selectors: siteSelectors } });
    }
}

async function deleteSelector(selector: string) {
    const hostname = await getCurrentHostname();
    const result = await chrome.storage.sync.get(hostname);
    const siteSelectors: string[] = result[hostname]?.selectors || [];

    const updated = siteSelectors.filter(s => s !== selector);
    await chrome.storage.sync.set({ [hostname]: { selectors: updated } });
}

button.addEventListener("click", async () => {
    const selector = input.value.trim();
    if (!selector) return;
    await saveSelector(selector);
    await displaySelectors();
    input.value = "";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "refreshSelectors" });
    }
});

displaySelectors();

// ----------------------------------------------------------------------------

const extractBtn = document.getElementById('extractButton') as HTMLButtonElement;
const resultDiv = document.getElementById('extractResult') as HTMLElement;

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

extractBtn.addEventListener('click', async () => {
    resultDiv.innerHTML = `<p>Running detectors...</p>`;

    const tab = await getActiveTab();
    if (!tab?.id || !tab.url) {
        resultDiv.innerHTML = '<p>No active tab</p>';
        return;
    }

    // 1) Detector data
    let detectorData: any = null;
    try {
        detectorData = await chrome.tabs.sendMessage(tab.id, { type: 'runDetector' });
    } catch (e) {
        detectorData = { error: 'Content script not reachable' };
    }

    // 2) Header data
    let headerData: any = null;
    try {
        headerData = await chrome.runtime.sendMessage({ type: 'fetchHeaders', url: tab.url });
    } catch (e: unknown) {
        headerData = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    const html: string[] = [];

    // Page info
    html.push(`<h4>Page Info</h4>`);
    html.push(`<p><strong>URL:</strong> ${tab.url}</p>`);
    if (detectorData?.title) html.push(`<p><strong>Title:</strong> ${detectorData.title}</p>`);

    // Detected frameworks
    html.push(`<h4>Detected Frameworks / Libraries</h4>`);
    if (detectorData?.results?.length) {
        html.push('<ul>');
        detectorData.results.forEach((d: any) => {
            html.push(`<li><strong>${d.name}</strong> — ${d.reason}${d.version ? ` (v${d.version})` : ''}</li>`);
        });
        html.push('</ul>');
    } else if (detectorData?.error) {
        html.push(`<p style="color: red;">${detectorData.error}</p>`);
    } else {
        html.push('<p>None detected</p>');
    }

    // Important headers only
    html.push(`<h4>Important Headers</h4>`);
    if (headerData?.ok && headerData.headers) {
        const importantHeaders = ['server', 'x-powered-by', 'cf-ray', 'cf-cache-status', 'content-security-policy', 'strict-transport-security'];
        html.push('<ul>');
        importantHeaders.forEach(h => {
            if (headerData.headers[h]) {
                html.push(`<li><strong>${h}:</strong> ${headerData.headers[h]}</li>`);
            }
        });
        html.push('</ul>');
    } else if (headerData?.error) {
        html.push(`<p style="color: red;">${headerData.error}</p>`);
    }

    resultDiv.innerHTML = html.join('');
});


