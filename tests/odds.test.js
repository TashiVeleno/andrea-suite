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

test("cronologia quote: statistiche per campionato e mercato con soldi investiti", () => {
    const a = app;
    const log = [
        { id: 1, competitionId: "it.1", competition: "Serie A", marketId: "o05_1t", market: "Over 0.5 1T", odds: 1.5, stake: 100, p: 70, commissionPct: 5, result: "win" },
        { id: 2, competitionId: "it.1", competition: "Serie A", marketId: "o05_1t", market: "Over 0.5 1T", odds: 1.5, stake: 50, p: 70, commissionPct: 5, result: "loss" },
        { id: 3, competitionId: "it.1", competition: "Serie A", marketId: "o05_1t", market: "Over 0.5 1T", odds: 1.4, stake: 20, p: 72, result: null },
        { id: 4, competitionId: "uefa.cl", competition: "Champions League", marketId: "u25", market: "Under 2.5", odds: 2, stake: 10, p: 45, commissionPct: 5, result: "win" }
    ];
    const { rows, total } = a.calculateOddsLogStats(log);
    const sa = rows.find(r => r.competitionId === "it.1");
    assert.equal(sa.count, 3);
    assert.equal(sa.settled, 2);
    assert.equal(sa.open, 1);
    assert.equal(sa.openStake, 20);
    assert.equal(sa.staked, 150);
    close(sa.profit, 100 * 0.5 * 0.95 - 50, 1e-9);
    close(sa.winPct, 50, 1e-9);
    close(sa.expectedPct, 70, 1e-9);
    close(sa.avgOdds, 1.5, 1e-9);
    assert.equal(total.settled, 3);
    assert.equal(total.staked, 160);
    close(total.profit, 47.5 - 50 + 9.5, 1e-9);
    assert.equal(a.oddsLogProfit({ odds: 2, stake: 10, result: null }), 0);
});
