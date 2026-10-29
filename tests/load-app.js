// Carica le funzioni di calcolo di index.html in Node, senza browser.
// Prende lo <script> classico (non il modulo Firebase), finge un DOM minimo
// e blocca la data di "oggi" così i test danno sempre lo stesso risultato.
process.env.TZ = process.env.TZ || "Europe/Rome"; // i giorni si contano in ora italiana, come nell'app
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Atteso un solo <script> classico in index.html, trovati ${scripts.length}`);

const EXPORTS = [
    "calculateProject", "todayResult", "calculateCompoundPlan", "calculateCedola", "calculateMoneyManagement",
    "calculateAlarms", "calculateStrategyStats", "breakEvenFromOdds", "oddsLimitFromWinRate",
    "netWinFromOdds", "tradeResult", "buildBackup", "parseBackup", "getToday", "daysBetween",
    "DEFAULT_RULES", "AVVISO_QUASI", "Z_SOTTO_SOGLIA", "mergeProjects", "mergeRealLife", "sameData",
    "calculateStagePlan", "stageExpected", "autoStages", "parseCSV", "betfairColumns", "parseBetfairDetails", "itDate", "itNumber", "parseMovimentiChiusi", "getStrategies", "betfairStrategyName", "betSituation", "applyMovementEdit", "parseCalcExpression", "previewMovementEdit",
    "chartPresetRange", "clampChartRange", "zoomChartRange", "chartRangeFromDates"
];

function fakeElement() {
    return new Proxy({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }, {
        get: (t, k) => (k in t ? t[k] : () => fakeElement()),
        set: (t, k, v) => { t[k] = v; return true; }
    });
}

// escapeHTML usa un <div>: textContent dentro, innerHTML fuori
function fakeDiv() {
    const el = fakeElement();
    let text = "";
    Object.defineProperty(el, "textContent", { get: () => text, set: v => { text = String(v); } });
    Object.defineProperty(el, "innerHTML", { get: () => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") });
    return el;
}

function loadApp(nowISO, { projects = [], realLife = {} } = {}) {
    const RealDate = Date;
    const fixed = new RealDate(nowISO).getTime();
    class FixedDate extends RealDate {
        constructor(...args) { if (args.length) super(...args); else super(fixed); }
        static now() { return fixed; }
    }

    const state = { projects, realLife };
    const window = {
        loadProjects: () => state.projects,
        loadRealLife: () => ({ ...state.realLife }),
        saveProjects: (p, r) => { state.projects = p; if (r) state.realLife = r; },
        addEventListener() {}
    };
    const context = {
        window, Date: FixedDate, Math, JSON, Number, String, Array, Object, Set, Map, Intl, isFinite, isNaN, Infinity, console,
        document: { getElementById: () => fakeElement(), querySelectorAll: () => [], createElement: () => fakeDiv(), body: fakeElement() },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        alert() {}, confirm: () => true
    };
    vm.createContext(context);
    vm.runInContext(scripts[0] + `\n;globalThis.__app = { ${EXPORTS.join(", ")} };`, context);
    return { ...context.__app, state };
}

module.exports = { loadApp };
