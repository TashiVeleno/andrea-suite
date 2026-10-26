const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-10-26T20:00:00");

test("gruppo live: gol già segnati e fascia di minuti", () => {
    assert.equal(app.betSituation({ pl: 1 }), null);
    assert.equal(app.betSituation({ minute: 30, score: [1, 1] }).label, "dopo 2 gol · 16-45'");
    assert.equal(app.betSituation({ minute: 0, score: [0, 0] }).label, "sullo 0-0 · 0-15'");
    assert.equal(app.betSituation({ minute: 60, score: [1, 0] }).window, "46-70'");
    assert.equal(app.betSituation({ minute: 88, score: [2, 1] }).window, "71'+");
});

test("statistiche: la strategia si divide nei gruppi live, le prepartita restano solo nel totale", () => {
    const bets = [
        { id: 1, strategyId: "back_under_3_5", date: "2026-10-20T20:00:00", pl: 5, stake: 20, odds: 1.25 },
        { id: 2, strategyId: "back_under_3_5", date: "2026-10-21T20:00:00", pl: 4, stake: 10, odds: 1.4, minute: 30, score: [1, 1] },
        { id: 3, strategyId: "back_under_3_5", date: "2026-10-22T20:00:00", pl: -10, stake: 10, odds: 1.5, minute: 35, score: [2, 0] },
        { id: 4, strategyId: "back_under_3_5", date: "2026-10-23T20:00:00", pl: 3, stake: 10, odds: 1.2, minute: 65, score: [1, 1] }
    ];
    const s = app.calculateStrategyStats({ bets }).find(x => x.id === "back_under_3_5");
    assert.equal(s.n, 4);
    assert.equal(JSON.stringify(s.groups.map(g => [g.name, g.n])), JSON.stringify([["dopo 2 gol · 16-45'", 2], ["dopo 2 gol · 46-70'", 1]]));
    assert.equal(s.groups[0].total, -6);
    assert.equal(s.groups[0].oddsLimitFromRef, false);
});
