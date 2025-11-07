chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed!");
});

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

interface StorageData {
    mode: ProxyMode;
    activeProfileId: string | null;
    profiles: ProxyProfile[];
    _initialized?: boolean;
}

const DEFAULTS: StorageData = {
    mode: "system",
    activeProfileId: null,
    profiles: [],
};

// util: generate unique id
const genId = (): string =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// load defaults into storage if empty
chrome.runtime.onInstalled.addListener(async () => {
    const kv = await chrome.storage.sync.get();
    if (!kv._initialized) {
        await chrome.storage.sync.set({ ...DEFAULTS, _initialized: true });
    }
});

// set proxy settings given a profile object (or mode "system")
async function applyProfile(profile: ProxyProfile | { mode: "system" } | null): Promise<void> {
    if (!profile || profile.mode === "system") {
        await chrome.proxy.settings.set({
            value: { mode: "system" },
            scope: "regular",
        });
        console.log("Proxy: set to system");
        return;
    }

    if (profile.mode === "fixed_servers") {
        const scheme: ProxyScheme = profile.scheme || "http";
        const proxyStr = `${scheme}://${profile.host}:${profile.port}`;

        const config: chrome.types.ChromeSettingSetDetails<chrome.proxy.ProxyConfig> = {
            value: {
                mode: "fixed_servers",
                rules: {
                    singleProxy: {
                        scheme,
                        host: profile.host!,
                        port: parseInt(profile.port || "80", 10),
                    },
                    bypassList: profile.bypass
                        ? profile.bypass.split(",").map((s) => s.trim())
                        : [],
                },
            },
            scope: "regular",
        };

        await chrome.proxy.settings.set(config);
        console.log("Proxy: fixed_servers applied:", proxyStr);
        return;
    }

    if (profile.mode === "pac_script") {
        const config: chrome.types.ChromeSettingSetDetails<chrome.proxy.ProxyConfig> = {
            value: {
                mode: "pac_script",
                pacScript: {
                    data: profile.pacScript || "",
                },
            },
            scope: "regular",
        };

        await chrome.proxy.settings.set(config);
        console.log("Proxy: pac_script applied");
        return;
    }

    console.warn("Unknown profile mode:", (profile as any).mode);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        if (msg.type === "applyProfile") {
            const id: string = msg.id;
            const kv = await chrome.storage.sync.get(["profiles"]);
            const profiles: ProxyProfile[] = kv.profiles || [];
            const profile = profiles.find((p) => p.id === id) || null;
            await applyProfile(profile);
            await chrome.storage.sync.set({ activeProfileId: profile ? profile.id : null });
            sendResponse({ ok: true });
            return;
        }

        if (msg.type === "applySystem") {
            await applyProfile({ mode: "system" });
            await chrome.storage.sync.set({ activeProfileId: null });
            sendResponse({ ok: true });
            return;
        }

        if (msg.type === "testConnection") {
            sendResponse({ ok: true });
            return;
        }

        sendResponse({ ok: false, reason: "unknown" });
    })();

    return true;
});
