import "./popup.css";

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
        delButton.style = "margin-right: 8px; align-item: center; aspect-ratio: 1 / 1; height: 21px; padding: 0";
        delButton.addEventListener("click", async () => {
            await deleteSelector(sel);
            await displaySelectors();

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                chrome.tabs.sendMessage(tab.id, { type: "refreshSelectors" });
            }
        });

        li.appendChild(delButton);
        const text = document.createElement("pre")
        text.textContent = sel
        li.appendChild(text);
        li.style = "display: flex; align-items: center;"
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

async function getCurrentTabUrl(): Promise<string | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.url ?? null;
}

function createLabeledField(labelText: string, element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): HTMLDivElement {
    const container = document.createElement("div");

    const label = document.createElement("label");
    label.textContent = labelText;

    container.appendChild(label);
    container.appendChild(element);
    return container;
}

async function showCookies() {
    const cookieList = document.getElementById("cookieList")!;
    cookieList.innerHTML = "";

    const url = await getCurrentTabUrl();
    if (!url) {
        cookieList.innerHTML = "<li>Cannot get current tab URL</li>";
        return;
    }

    chrome.cookies.getAll({ url }, (cookies) => {
        if (!cookies || cookies.length === 0) {
            cookieList.innerHTML = "<li>No cookies found for this page</li>";
            return;
        }

        cookies.forEach((cookie) => {
            const li = document.createElement("li");
            li.addEventListener("click", (e) => {
                if (e.target === li) {
                    li.classList.toggle("expanded");
                }
            });

            // cookie name
            const nameDiv = document.createElement("div");
            nameDiv.textContent = "⌄ \u0020" + cookie.name // "⯆" + cookie.name;
            li.appendChild(nameDiv);

            // Editor drop-down 
            const editor = document.createElement("div");
            editor.addEventListener("click", (e) => e.stopPropagation());
            editor.className = "editor";

            const valueInput = document.createElement("textarea");
            valueInput.value = cookie.value;
            valueInput.placeholder = "Value";
            valueInput.rows = 3;
            const valueField = createLabeledField("Value", valueInput);

            const pathInput = document.createElement("input");
            pathInput.value = cookie.path;
            const pathField = createLabeledField("Path", pathInput);

            const expInput = document.createElement("input");
            if (cookie.expirationDate) {
                const date = new Date(cookie.expirationDate * 1000);
                expInput.type = "datetime-local";
                expInput.value = date.toISOString().slice(0, 16);
            } else {
                expInput.type = "text";
                expInput.placeholder = "Session cookie";
            }
            const expField = createLabeledField("Expiration", expInput);

            const secureSelect = document.createElement("select");
            ["true", "false"].forEach(v => {
                const option = document.createElement("option");
                option.value = v;
                option.textContent = v;
                if ((cookie.secure && v === "true") || (!cookie.secure && v === "false")) option.selected = true;
                secureSelect.appendChild(option);
            });
            const secureField = createLabeledField("Secure", secureSelect);

            const httpOnlySelect = document.createElement("select");
            ["true", "false"].forEach(v => {
                const option = document.createElement("option");
                option.value = v;
                option.textContent = v;
                if ((cookie.httpOnly && v === "true") || (!cookie.httpOnly && v === "false")) option.selected = true;
                httpOnlySelect.appendChild(option);
            });
            const httpOnlyField = createLabeledField("HttpOnly", httpOnlySelect);


            const saveBtn = document.createElement("button");
            saveBtn.textContent = "Save";
            saveBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const scheme = cookie.secure ? "https://" : "http://";
                const host = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
                const cookieUrl = scheme + host + pathInput.value;

                let newExp: number | undefined = undefined;
                if (expInput.value) newExp = Math.floor(new Date(expInput.value).getTime() / 1000);

                chrome.cookies.set({
                    url: cookieUrl,
                    name: cookie.name,
                    value: valueInput.value,
                    domain: cookie.domain,
                    path: pathInput.value,
                    secure: secureSelect.value === "true",
                    httpOnly: httpOnlySelect.value === "true",
                    expirationDate: newExp,
                }, () => {
                    let msg = editor.querySelector(".save-message") as HTMLDivElement;
                    if (!msg) {
                        msg = document.createElement("div");
                        msg.className = "save-message";
                        msg.style.color = "green";
                        msg.style.fontSize = "12px";
                        msg.style.marginTop = "4px";
                        msg.style.marginRight = "4px";
                        editor.appendChild(msg);
                    }
                    msg.textContent = "Cookie updated!";

                    setTimeout(() => {
                        msg.textContent = "";
                    }, 2000);
                });
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.style.marginLeft = "6px";
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();

                const scheme = cookie.secure ? "https://" : "http://";
                const host = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
                const cookieUrl = scheme + host + pathInput.value;

                chrome.cookies.remove({ url: cookieUrl, name: cookie.name }, (details) => {
                    let msg = editor.querySelector(".save-message") as HTMLDivElement;
                    if (!msg) {
                        msg = document.createElement("div");
                        msg.className = "save-message";
                        msg.style.color = "red";
                        msg.style.fontSize = "12px";
                        msg.style.marginTop = "4px";
                        editor.appendChild(msg);
                    }
                    msg.textContent = "Cookie deleted!";
                    setTimeout(() => { msg.textContent = ""; }, 2000);

                    // Remove the li from the list
                    li.remove();
                });
            });

            editor.appendChild(valueField);
            editor.appendChild(pathField);
            editor.appendChild(expField);
            editor.appendChild(secureField);
            editor.appendChild(httpOnlyField);
            editor.appendChild(saveBtn);
            editor.appendChild(deleteBtn);

            li.appendChild(editor);

            li.addEventListener("click", () => li.classList.toggle("expanded"));

            cookieList.appendChild(li);
        });
    });


}

showCookies();

async function addCookie() {
    const url = await getCurrentTabUrl();
    if (!url) return;

    const formContainer = document.getElementById("addCookieForm")!;
    const addBtn = document.getElementById("addCookie")!;

    let msg = document.querySelector(".save-message") as HTMLDivElement;
    if (!msg) {
        msg = document.createElement("div");
        msg.className = "save-message";
        addBtn.insertAdjacentElement("afterend", msg);
    }

    formContainer.innerHTML = "";

    if (formContainer.dataset.open === "true") {
        formContainer.dataset.open = "false";
        formContainer.style.display = "none";
        return;
    }
    formContainer.dataset.open = "true";
    formContainer.style.display = "block";

    const nameInput = document.createElement("input");
    nameInput.placeholder = "Name";

    const valueInput = document.createElement("textarea");
    valueInput.placeholder = "Value";
    valueInput.rows = 3;        // optional, controls height
    valueInput.style.width = "100%";

    const pathInput = document.createElement("input");
    pathInput.placeholder = "Path";
    pathInput.value = "/";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.marginRight = "6px";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";

    const wrapper = document.createElement("div");
    wrapper.appendChild(createLabeledField("Name", nameInput));
    wrapper.appendChild(createLabeledField("Value", valueInput));
    wrapper.appendChild(createLabeledField("Path", pathInput));
    wrapper.appendChild(saveBtn);
    wrapper.appendChild(cancelBtn);

    formContainer.appendChild(wrapper);

    nameInput.focus();

    cancelBtn.onclick = () => {
        formContainer.innerHTML = "";
        formContainer.dataset.open = "false";
        formContainer.style.display = "none";
    };

    saveBtn.onclick = async () => {
        const name = nameInput.value.trim();
        const value = valueInput.value.trim();
        const path = pathInput.value.trim() || "/";

        if (!name) {
            msg.style.color = "red";
            msg.textContent = "enter cookie name";
            setTimeout(() => (msg.textContent = ""), 2000);
            return;
        }

        try {
            await chrome.cookies.set(
                { url, name, value, path },
                () => {
                    msg.style.color = "green";
                    msg.textContent = "Cookie added!";
                    setTimeout(() => (msg.textContent = ""), 2000);
                }
            );
            await showCookies();
            cancelBtn.click();
        } catch (err) {
            msg.style.color = "red";
            msg.textContent = "Failed to add cookie";
            console.error(err);
            setTimeout(() => (msg.textContent = ""), 2000);
        }
    };
}

document.getElementById("addCookie")?.addEventListener("click", addCookie);

// ----------------------------------------------------------------------------

type ProxyMode = "system" | "fixed_servers" | "pac_script";
type ProxyScheme = "http" | "https" | "socks4" | "socks5" | "quic";

interface ProxyProfile {
    id: string;
    name: string;
    mode: ProxyMode;
    host?: string;
    port?: string;
    scheme?: ProxyScheme;
    bypass?: string;
    pacScript?: string;
}

const $ = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Element #${id} not found`);
    return el as T;
};

function showMessage(text: string, type: "success" | "error" = "success") {
    const msg = $("message");
    msg.textContent = text;
    msg.className = `message ${type}`;
    msg.style.display = "block";
    setTimeout(() => (msg.style.display = "none"), 3000);
}

async function load(): Promise<void> {
    const kv = await chrome.storage.sync.get(["profiles", "activeProfileId"]);
    const profiles: ProxyProfile[] = kv.profiles || [];
    const active: string | null = kv.activeProfileId || null;
    const list = $("list");
    const status = $("status");
    list.innerHTML = "";

    // Update active status
    if (!active) {
        status.textContent = "System proxy is currently active.";
        status.className = "status system";
    } else {
        const p = profiles.find(p => p.id === active);
        status.textContent = p
            ? `Active proxy: ${p.name} (${p.mode})`
            : "Unknown active proxy";
        status.className = "status active";
    }

    for (const p of profiles) {
        const div = document.createElement("div");
        div.className = "profile" + (active === p.id ? " active" : "");
        const display =
            p.mode === "fixed_servers"
                ? `${p.scheme}://${p.host}:${p.port}`
                : p.mode === "pac_script"
                    ? "PAC script"
                    : "System";

        div.innerHTML = `
            <div class="profile-info">
                <strong>${p.name}</strong>
                <small>${display}</small>
            </div>
            <div class="profile-buttons">
                <button data-id="${p.id}" class="apply small-btn ${active === p.id ? "active" : ""}">
                    ${active === p.id ? "Active" : "Apply"}
                </button>
                <button data-id="${p.id}" class="del small-btn">Del</button>
            </div>
        `;
        list.appendChild(div);
    }

    for (const btn of list.querySelectorAll<HTMLButtonElement>(".apply")) {
        btn.addEventListener("click", async e => {
            const id = (e.currentTarget as HTMLButtonElement).dataset.id!;
            await chrome.runtime.sendMessage({ type: "applyProfile", id });
            await load();
            showMessage("Proxy applied successfully!");
        });
    }

    for (const btn of list.querySelectorAll<HTMLButtonElement>(".del")) {
        btn.addEventListener("click", async e => {
            const id = (e.currentTarget as HTMLButtonElement).dataset.id!;
            const kv = await chrome.storage.sync.get(["profiles"]);
            const newProfiles: ProxyProfile[] = (kv.profiles || []).filter((p: any) => p.id !== id);
            await chrome.storage.sync.set({ profiles: newProfiles });

            const activeId = (await chrome.storage.sync.get("activeProfileId")).activeProfileId;
            if (activeId === id) {
                await chrome.runtime.sendMessage({ type: "applySystem" });
            }

            await load();
            showMessage("Profile deleted", "success");
        });
    }
}

function updateFieldVisibility(): void {
    const mode = ($("p-mode") as HTMLSelectElement).value as ProxyMode;
    $("fixed-fields").style.display = mode === "fixed_servers" ? "" : "none";
    $("pac-field").style.display = mode === "pac_script" ? "" : "none";
}

document.addEventListener("DOMContentLoaded", async () => {
    const toggleBtn = $("toggle-form");
    const proxyForm = $("proxy-form");
    const cancelBtn = $("cancel");
    const modeSelect = $("p-mode") as HTMLSelectElement;

    toggleBtn.addEventListener("click", () => {
        proxyForm.style.display = proxyForm.style.display === "none" ? "block" : "none";
        $("message").style.display = "none";
    });

    cancelBtn.addEventListener("click", () => {
        proxyForm.style.display = "none";
    });

    modeSelect.addEventListener("change", updateFieldVisibility);
    updateFieldVisibility();

    const saveBtn = $("save") as HTMLButtonElement;
    saveBtn.addEventListener("click", async () => {
        const name = ($("p-name") as HTMLInputElement).value.trim() || "Untitled";
        const mode = (modeSelect.value as ProxyMode) || "system";

        const profile: ProxyProfile = {
            id: Date.now().toString(36),
            name,
            mode,
        };

        if (mode === "fixed_servers") {
            profile.scheme = ($("p-scheme") as HTMLSelectElement).value as ProxyScheme;
            profile.host = ($("p-host") as HTMLInputElement).value.trim();
            profile.port = ($("p-port") as HTMLInputElement).value.trim();
            profile.bypass = ($("p-bypass") as HTMLInputElement).value.trim();

            if (!profile.host || !profile.port) {
                showMessage("Please enter host and port.", "error");
                return;
            }
        } else if (mode === "pac_script") {
            profile.pacScript = ($("p-pac") as HTMLTextAreaElement).value.trim();
            if (!profile.pacScript) {
                showMessage("Please enter PAC script.", "error");
                return;
            }
        }

        const kv = await chrome.storage.sync.get(["profiles"]);
        const profiles: ProxyProfile[] = kv.profiles || [];
        profiles.push(profile);
        await chrome.storage.sync.set({ profiles });

        await chrome.runtime.sendMessage({ type: "applyProfile", id: profile.id });
        await load();

        proxyForm.style.display = "none";
        showMessage("Profile saved and applied!");
    });

    $("apply-system").addEventListener("click", async () => {
        await chrome.runtime.sendMessage({ type: "applySystem" });
        await load();
        showMessage("System proxy restored!");
    });

    await load();
});

// ----------------------------------------------------------------------------

import { renderPayloadRows, payloadBuilder, copyBuild, clearSyncStorage, writeStorageDataToDiv } from "./blind_xss_manager";

document.addEventListener("DOMContentLoaded", () => renderPayloadRows(9));

const mainSection = document.getElementById("main-section")!;
const historySection = document.getElementById("history-section")!;
const showHistoryBtn = document.getElementById("showHistory")!;
const backButton = document.getElementById("backButton")!;

showHistoryBtn.addEventListener("click", () => {
    mainSection.classList.add("hidden");
    historySection.classList.remove("hidden");
    writeStorageDataToDiv("textArea");
});

// Go back to main view
backButton.addEventListener("click", () => {
    historySection.classList.add("hidden");
    mainSection.classList.remove("hidden");
});


document.addEventListener("DOMContentLoaded", () => {
    const buildBtn = document.getElementById("buildBtn");
    if (buildBtn) buildBtn.addEventListener("click", payloadBuilder);

    const copyAllBtn = document.getElementById("copyAllBtn");
    if (copyAllBtn) copyAllBtn.addEventListener("click", copyBuild);
});

window.addEventListener("DOMContentLoaded", () => {
    writeStorageDataToDiv("textArea");

    const clearBtn = document.getElementById("clear") as HTMLButtonElement | null;
    if (clearBtn) {
        clearBtn.onclick = () => {
            clearSyncStorage();
            location.reload();
        };
    }
});