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
    if (!chrome.runtime?.id) return; // prevent invalid context
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


// ----------------------------------------------------------------------------

// --- Types ---
type Detection = {
    name: string;
    reason: string;
    version?: string | null;
};

// --- Helper functions ---
function getScripts(): string[] {
    return Array.from(document.scripts)
        .map(s => s.src)
        .filter((s): s is string => !!s);
}

function getLinks(): string[] {
    return Array.from(document.querySelectorAll('link[href]'))
        .map(l => (l as HTMLLinkElement).href)
        .filter((h): h is string => !!h);
}

function getMeta(name: string): string | null {
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || null;
}

function hostIncludes(needle: string): boolean {
    return Array.from(document.querySelectorAll('link[href],script[src],img[src]'))
        .map((el: any) => el.src || el.href || '')
        .some(u => u.includes(needle));
}

// --- Detector definitions ---
interface Detector {
    name: string;
    test: () => boolean;
    reason: string;
}

const detectors: Detector[] = [
    {
        name: 'React',
        test: () => !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ || getScripts().some(s => /react(\.|-|\d)/i.test(s)),
        reason: 'React global hook or script URL'
    },
    {
        name: 'Next.js',
        test: () => !!(window as any).__NEXT_DATA__ || getScripts().some(s => /_next\/static/i.test(s)),
        reason: 'Next.js __NEXT_DATA__ or _next/static scripts'
    },
    {
        name: 'WordPress',
        test: () =>
            getScripts().some(s => /wp-content|wp-includes|\/wp-/.test(s)) ||
            (getMeta('generator') || '').toLowerCase().includes('wordpress'),
        reason: 'WP resource paths or meta generator'
    },
    {
        name: 'Vue.js',
        test: () => !!(window as any).Vue || getScripts().some(s => /vue(\.|-|\d)/i.test(s)),
        reason: 'window.Vue or script URL'
    },
    {
        name: 'Angular',
        test: () => !!(window as any).ng || getScripts().some(s => /angular(\.|-|\d)/i.test(s)),
        reason: 'window.ng or script URL'
    },
    {
        name: 'jQuery',
        test: () => !!(window as any).jQuery || getScripts().some(s => /jquery(\.|-|\d)/i.test(s)),
        reason: 'window.jQuery or script URL'
    },
    {
        name: 'Shopify',
        test: () => hostIncludes('cdn.shopify.com') || getScripts().some(s => /shopify/i.test(s)),
        reason: 'Shopify CDN or assets'
    },
    {
        name: 'Google Analytics',
        test: () =>
            getScripts().some(s => /google-analytics|analytics.js|gtag\/js|ga\.js|googletagmanager\.com\/gtm/i.test(s)) ||
            !!(window as any).ga,
        reason: 'Analytics script or ga()'
    },
    {
        name: 'Google Tag Manager',
        test: () => getScripts().some(s => /googletagmanager\.com\/gtm/i.test(s)),
        reason: 'GTM script URL'
    },
    {
        name: 'Cloudflare',
        test: () => hostIncludes('cloudflare') || getMeta('cf-ray') !== null,
        reason: 'Cloudflare hostname or meta header'
    },
    {
        name: 'Nginx',
        test: () => /nginx/i.test(document.documentElement.innerHTML),
        reason: 'Page content hint'
    },
    {
        name: 'Apache',
        test: () => /apache/i.test(document.documentElement.innerHTML),
        reason: 'Page content hint'
    },
    {
        name: 'Bootstrap',
        test: () =>
            getLinks().some(h => /bootstrap(\.|\/|-\d)/i.test(h)) ||
            getScripts().some(s => /bootstrap(\.|\/|-\d)/i.test(s)) ||
            Array.from(document.styleSheets).some(ss => (ss.href || '').includes('bootstrap')),
        reason: 'Bootstrap CSS/JS'
    },
    {
        name: 'Tailwind',
        test: () =>
            Array.from(document.styleSheets).some(ss => (ss.href || '').includes('tailwind')) ||
            document.documentElement.classList.contains('tw'),
        reason: 'Tailwind presence'
    }
    // add more detectors here...
];

// --- Run detectors safely ---
function runDetectors(): Detection[] {
    const results: Detection[] = [];
    for (const d of detectors) {
        try {
            if (d.test()) results.push({ name: d.name, reason: d.reason });
        } catch (err) {
            console.warn(`Detector ${d.name} failed:`, err);
        }
    }
    return results;
}

// --- Example usage ---
console.log('Detectors active for:', window.location.href);
const detected = runDetectors();
console.log('Detected frameworks:', detected);

// --- Respond to popup messages ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'runDetector') {
        const results = runDetectors();
        sendResponse({
            url: location.href,
            title: document.title,
            metaGenerator: getMeta('generator'),
            scripts: getScripts().slice(0, 50), // limit for performance
            results
        });
        return true; // keep channel open for async
    }
});


// const detectors: Array<{ name: string; test: () => boolean; reason: string }> = [
//     { name: 'React', test: () => !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ || getScripts().some(s => /react(\.|-|\d)/i.test(s)), reason: 'react global or script URL' },
//     { name: 'WordPress', test: () => getScripts().some(s => /wp-content|wp-includes|\/wp-/.test(s)) || (getMeta('generator') || '').toLowerCase().includes('wordpress'), reason: 'wp resource or meta generator' },
//     { name: 'Next.js', test: () => !!(window as any).__NEXT_DATA__ || getScripts().some(s => /_next\/static/i.test(s)), reason: 'next data or _next static' },
//     { name: 'Vue.js', test: () => !!(window as any).Vue || getScripts().some(s => /vue(\.|-|\d)/i.test(s)), reason: 'window.Vue or script url' },
//     { name: 'Angular', test: () => !!(window as any).ng || getScripts().some(s => /angular(\.|-|\d)/i.test(s)), reason: 'window.ng or angular script' },
//     { name: 'jQuery', test: () => !!(window as any).jQuery || getScripts().some(s => /jquery(\.|-|\d)/i.test(s)), reason: 'window.jQuery or jquery script' },
//     { name: 'WordPress', test: () => getScripts().some(s => /wp-content|wp-includes|\/wp-/.test(s)) || getMeta('generator').toLowerCase().includes('wordpress'), reason: 'wp resource paths or meta generator' },
//     { name: 'Shopify', test: () => hostIncludes('cdn.shopify.com') || getScripts().some(s => /shopify/i.test(s)), reason: 'shopify CDN or assets' },
//     { name: 'Google Analytics', test: () => getScripts().some(s => /google-analytics|analytics.js|gtag\/js|ga\.js|googletagmanager\.com\/gtm/i.test(s)) || !!(window as any).ga, reason: 'analytics script or ga()' },
//     { name: 'Google Tag Manager', test: () => getScripts().some(s => /googletagmanager\.com\/gtm/i.test(s)), reason: 'GTM script URL' },
//     { name: 'Cloudflare', test: () => hostIncludes('cloudflare') || getMeta('cf-ray') !== null, reason: 'resource hostname or cf headers/meta' },
//     { name: 'Nginx', test: () => !!document.documentElement.innerHTML.match(/nginx/i) || false, reason: 'page content hints (heuristic)' },
//     { name: 'Apache', test: () => !!document.documentElement.innerHTML.match(/Apache/i) || false, reason: 'page content hints (heuristic)' },
//     { name: 'Bootstrap', test: () => getLinks().some(h => /bootstrap(\.|\/|-\d)/i.test(h)) || getScripts().some(s => /bootstrap(\.|\/|-\d)/i.test(s)) || Array.from(document.styleSheets).some(ss => (ss.href || '').includes('bootstrap')), reason: 'bootstrap css/js' },
//     { name: 'Tailwind', test: () => Array.from(document.styleSheets).some(ss => (ss.href || '').includes('tailwind')) || document.documentElement.classList.contains('tw'), reason: 'tailwind presence' },
//     // add more detectors here...
// ];

