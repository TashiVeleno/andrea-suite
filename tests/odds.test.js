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

test("statistiche per campionato dalle tue operazioni", () => {
    const bets = [
        { id: 1, strategyId: "back_over_0_5_primo_tempo", competition: "uefa.cl", pl: 4, stake: 10, odds: 1.4 },
        { id: 2, strategyId: "back_over_0_5_primo_tempo", competition: "uefa.cl", pl: -10, stake: 10, odds: 1.5 },
        { id: 3, strategyId: "back_under_2_5", competition: "it.1", pl: 5, stake: 20, odds: 1.25 },
        { id: 4, strategyId: "back_under_2_5", pl: 5, stake: 20 }
    ];
    const all = app.calculateCompetitionStats({ bets });
    assert.equal(all.length, 2);
    const cl = all.find(g => g.id === "uefa.cl");
    assert.equal(cl.n, 2); assert.equal(cl.winRate, 50); assert.equal(cl.total, -6);
    close(cl.roi, -30, 1e-9); close(cl.avgOdds, 1.45, 1e-9);
    assert.equal(app.calculateCompetitionStats({ bets }, "back_under_2_5").length, 1);
});
