const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-11-03T12:00:00");

test("dailyReflection: stesso messaggio per tutto il giorno, cambia il giorno dopo", () => {
    const morning = app.dailyReflection(new Date(2026, 10, 3, 0, 5));
    const evening = app.dailyReflection(new Date(2026, 10, 3, 23, 55));
    const tomorrow = app.dailyReflection(new Date(2026, 10, 4, 0, 5));
    assert.deepEqual(morning, evening);
    assert.notEqual(morning.title, tomorrow.title);
    assert.notEqual(morning.kind, tomorrow.kind);
});

test("dailyReflection: in 30 giorni escono tutti i 30 messaggi, 10 per tipo", () => {
    const seen = new Set();
    const kinds = {};
    for (let i = 0; i < 30; i++) {
        const r = app.dailyReflection(new Date(2026, 10, 3 + i));
        seen.add(r.title);
        kinds[r.kind] = (kinds[r.kind] || 0) + 1;
    }
    assert.equal(seen.size, 30);
    assert.deepEqual(kinds, { motivazione: 10, obiettivo: 10, riflessione: 10 });
});

function stats(movements) {
    return app.calculateProject({ id: 1, name: "P", capital: 500, goal: 1000, endDate: "2026-12-31", status: "active", createdAt: "2026-10-01T00:00:00", movements });
}

test("reflectionStatus: obiettivo del giorno raggiunto invita a chiudere", () => {
    const s = stats([
        { id: 1, type: "deposit", amount: 500, date: "2026-10-01T09:00:00" },
        { id: 2, type: "day", balance: 800, deposit: 0, withdraw: 0, date: "2026-11-02T20:00:00" },
        { id: 3, type: "day", balance: 900, deposit: 0, withdraw: 0, date: "2026-11-03T10:00:00" }
    ]);
    const text = app.reflectionStatus(s);
    assert.match(text, /obiettivo del giorno raggiunto/);
});

test("reflectionStatus: sotto il piano non spinge a recuperare oggi", () => {
    const s = stats([{ id: 1, type: "deposit", amount: 500, date: "2026-10-01T09:00:00" }]);
    const text = app.reflectionStatus(s);
    assert.match(text, /non hai ancora registrato/);
    assert.match(text, /Non si recupera oggi/);
});
