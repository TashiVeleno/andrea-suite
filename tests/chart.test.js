const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2027-02-15T12:00:00");
const DAY = 86400000;
const START = new Date("2027-01-01T00:00:00").getTime();
const END = new Date("2027-12-31T00:00:00").getTime();
const NOW = new Date("2027-02-15T12:00:00").getTime();

test("Tutto mostra il progetto dall'inizio alla scadenza", () => {
    assert.deepEqual({ ...app.chartPresetRange("all", START, END, NOW) }, { start: START, end: END });
});

test("7g finisce oggi", () => {
    const r = app.chartPresetRange("7", START, END, NOW);
    assert.equal(r.end, NOW);
    assert.equal(r.end - r.start, 7 * DAY);
});

test("se il progetto è più giovane del periodo si parte dall'inizio e si vede quello che viene", () => {
    const r = app.chartPresetRange("90", START, END, NOW);
    assert.equal(r.start, START);
    assert.equal(r.end, START + 90 * DAY);
});

test("1a su un progetto più corto di un anno è tutto il progetto", () => {
    const r = app.chartPresetRange("365", START, END, NOW);
    assert.equal(r.start, START);
    assert.equal(r.end, END);
});

test("scorrere non esce dal progetto", () => {
    const before = app.clampChartRange(START - 5 * DAY, START + 5 * DAY, START, END);
    assert.equal(before.start, START);
    assert.equal(before.end, START + 10 * DAY);
    const after = app.clampChartRange(END - 2 * DAY, END + 8 * DAY, START, END);
    assert.equal(after.end, END);
    assert.equal(after.end - after.start, 10 * DAY);
});

test("lo zoom tiene fermo il punto sotto il dito", () => {
    const range = { start: START + 10 * DAY, end: START + 30 * DAY };
    const center = START + 15 * DAY;
    const r = app.zoomChartRange(range, center, 0.5, START, END);
    assert.equal(r.end - r.start, 10 * DAY);
    assert.equal((center - r.start) / (r.end - r.start), 0.25);
});

test("lo zoom si ferma a un giorno e a tutto il progetto", () => {
    const tight = app.zoomChartRange({ start: START + 10 * DAY, end: START + 12 * DAY }, START + 11 * DAY, 0.01, START, END);
    assert.equal(tight.end - tight.start, DAY);
    const wide = app.zoomChartRange({ start: START + 10 * DAY, end: START + 40 * DAY }, START + 20 * DAY, 100, START, END);
    assert.deepEqual({ ...wide }, { start: START, end: END });
});
