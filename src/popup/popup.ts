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
        // li.appendChild(document.createTextNode(sel));
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