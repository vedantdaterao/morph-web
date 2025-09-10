chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed!");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'fetchHeaders' && typeof msg.url === 'string') {
        (async () => {
            try {
                const resp = await fetch(msg.url, { method: 'GET', credentials: 'omit' });

                const headers: Record<string, string> = {};
                resp.headers.forEach((value, key) => { headers[key] = value; });
                sendResponse({ ok: true, status: resp.status, headers });
            } catch (err: unknown) {
                if (err instanceof Error) {
                    sendResponse({ ok: false, error: err.message });
                } else {
                    sendResponse({ ok: false, error: String(err) });
                }
            }
        })();
        return true;
    }
});
