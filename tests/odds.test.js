const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-11-03T18:00:00");
const close = (a, b, eps) => assert.ok(Math.abs(a - b) < eps, `atteso ${b}, ottenuto ${a}`);
const calc = o => app.calculateOddsEntry({ commissionPct: 4.5, ...o });

test("Over 0.5 primo tempo prepartita in Serie A: 71,7% di gol nel primo tempo", () => {
    const r = calc({ competitionId: "it.1", marketId: "o05_1t", minute: null });
    close(r.p, 71.7, 0.1);
    close(r.minOdds, 1.41, 0.01);
});

test("in live sullo 0-0 la quota minima sale col minuto", () => {
    const a = calc({ competitionId: "it.1", marketId: "o05_1t", minute: 20, goals: 0 });
    const b = calc({ competitionId: "it.1", marketId: "o05_1t", minute: 35, goals: 0 });
    assert.ok(b.minOdds > a.minOdds && a.minOdds > 1.41);
});

test("verdetto: conviene sopra la quota minima, guadagno medio ogni 100 €", () => {
    const yes = calc({ competitionId: "uefa.cl", marketId: "o05_1t", minute: null, odds: 1.6 });
    assert.equal(yes.good, true);
    assert.ok(yes.ev100 > 0);
    const no = calc({ competitionId: "uefa.cl", marketId: "o05_1t", minute: null, odds: 1.2 });
    assert.equal(no.good, false);
    assert.ok(no.ev100 < 0);
});

test("casi già decisi e primo tempo finito", () => {
    assert.ok(calc({ competitionId: "it.1", marketId: "o05_1t", minute: 60 }).error);
    assert.ok(calc({ competitionId: "it.1", marketId: "o15", minute: 30, goals: 2 }).error);
    assert.ok(calc({ competitionId: "it.1", marketId: "u25", minute: 30, goals: 3 }).error);
});

test("Under 2.5 sull'1-0 al 60': serve che arrivi al massimo un altro gol", () => {
    const r = calc({ competitionId: "it.1", marketId: "u25", minute: 60, goals: 1 });
    const lambda = 1.642 * 37 / 50;
    close(r.p, 100 * Math.exp(-lambda) * (1 + lambda), 0.01);
});
