const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-11-01T10:00:00");
const ids = list => list.map(s => s.id);

test("nuovi progetti: niente Goal/No Goal, sì Over/Under 1.5 primo tempo", () => {
    const list = ids(app.getStrategies({}));
    assert.ok(!list.includes("back_goal_btts_si") && !list.includes("back_no_goal_btts_no"));
    assert.ok(list.includes("back_over_1_5_primo_tempo") && list.includes("back_under_1_5_primo_tempo"));
});

test("progetti salvati: Goal/No Goal spariscono solo se non hanno operazioni", () => {
    const saved = [
        { id: "back_goal_btts_si", name: "Punta Goal (BTTS sì)", side: "back" },
        { id: "back_no_goal_btts_no", name: "Punta No Goal (BTTS no)", side: "back" },
        { id: "back_over_1_5", name: "Punta Over 1.5", side: "back" }
    ];
    const empty = ids(app.getStrategies({ strategies: saved, strategiesVersion: 2 }));
    assert.ok(!empty.includes("back_goal_btts_si") && !empty.includes("back_no_goal_btts_no"));
    assert.ok(empty.includes("back_over_1_5") && empty.includes("back_over_1_5_primo_tempo"));

    const withBets = ids(app.getStrategies({ strategies: saved, strategiesVersion: 2, bets: [{ id: 1, strategyId: "back_goal_btts_si", pl: 5 }] }));
    assert.ok(withBets.includes("back_goal_btts_si") && !withBets.includes("back_no_goal_btts_no"));

    // Già aggiornato: se Andrea le ha rimesse a mano restano
    assert.ok(ids(app.getStrategies({ strategies: saved, strategiesVersion: 3 })).includes("back_goal_btts_si"));
});
