const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-10-15T12:00:00");

function project(movements) {
    return { id: 1, name: "Oggi", capital: 500, goal: 1000, endDate: "2026-12-31", status: "active", createdAt: "2026-10-01T00:00:00", movements };
}

test("todayResult: differenza del resoconto di oggi rispetto al saldo di ieri", () => {
    const s = app.calculateProject(project([
        { id: 1, type: "deposit", amount: 500, date: "2026-10-01T09:00:00" },
        { id: 2, type: "day", balance: 530, deposit: 0, withdraw: 0, date: "2026-10-14T20:00:00" },
        { id: 3, type: "day", balance: 520, deposit: 0, withdraw: 50, date: "2026-10-15T20:00:00" }
    ]));
    assert.equal(app.todayResult(s), 40); // (520 - 530) + 50 prelevati
});

test("todayResult: senza resoconto oggi restituisce null", () => {
    const s = app.calculateProject(project([
        { id: 1, type: "deposit", amount: 500, date: "2026-10-01T09:00:00" },
        { id: 2, type: "day", balance: 530, deposit: 0, withdraw: 0, date: "2026-10-14T20:00:00" }
    ]));
    assert.equal(app.todayResult(s), null);
});
