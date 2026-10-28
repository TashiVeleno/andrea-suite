const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const NOW = "2026-10-15T12:00:00";
const projects = [
    {
        id: 1, name: "Betfair 2026", capital: 1000, goal: 3650, endDate: "2026-12-31", status: "active",
        createdAt: "2026-01-01T00:00:00",
        rules: { stakePct: 1.5 },
        strategies: [{ id: "s1", name: "Prova", side: "back", breakEven: 50 }],
        movements: [
            { id: 11, type: "deposit", amount: 1000, date: "2026-01-01T09:00:00" },
            { id: 12, type: "day", balance: 1600, deposit: 0, withdraw: 100, date: "2026-10-10T20:00:00" }
        ],
        bets: [{ id: 101, strategyId: "s1", pl: 4.2, stake: 10, odds: 1.5, date: "2026-10-10T15:00:00", source: "betfair" }]
    },
    {
        id: 2, name: "Vecchio", capital: 500, goal: 200, endDate: "2025-12-31", status: "completed",
        createdAt: "2025-01-01T00:00:00", closedAt: "2025-12-20T00:00:00",
        movements: [
            { id: 21, type: "deposit", amount: 500, date: "2025-01-02T09:00:00" },
            { id: 22, type: "withdraw", amount: 720, date: "2025-12-20T09:00:00" }
        ]
    }
];
const realLife = { manualDeposits: 300, manualWithdrawals: 50, deletedDeposits: 120.5, deletedWithdrawals: 0 };

test("il backup contiene tutto e si ripristina identico", () => {
    const source = loadApp(NOW, { projects, realLife });
    const file = JSON.stringify(source.buildBackup(source.state.projects, source.state.realLife));

    const target = loadApp(NOW, { projects: [{ id: 9, name: "Da sostituire", movements: [] }], realLife: {} });
    const restored = target.parseBackup(file);
    target.state.projects = restored.projects;
    target.state.realLife = restored.realLife;

    assert.deepEqual(JSON.parse(JSON.stringify(target.state.projects)), projects);
    assert.deepEqual({ ...target.state.realLife }, realLife);
    assert.equal(restored.exportedAt, new Date(NOW).toISOString());

    // Stessi numeri prima e dopo il ripristino
    projects.forEach((p, i) => {
        const before = source.calculateProject(source.state.projects[i]);
        const after = target.calculateProject(target.state.projects[i]);
        assert.equal(after.result, before.result);
        assert.equal(after.balance, before.balance);
    });
});

test("il backup è una copia: modificare i dati dopo non cambia il file", () => {
    const copy = JSON.parse(JSON.stringify(projects));
    const backup = app().buildBackup(copy, realLife);
    copy[0].movements.push({ id: 99, type: "deposit", amount: 1, date: NOW });
    assert.equal(backup.projects[0].movements.length, 2);
});

test("backup senza Bilancio Vita Reale o senza movimenti", () => {
    const r = app().parseBackup(JSON.stringify({ app: "andrea-suite", version: 1, projects: [{ id: 1, name: "X" }] }));
    assert.deepEqual({ ...r.realLife }, { manualDeposits: 0, manualWithdrawals: 0, deletedDeposits: 0, deletedWithdrawals: 0 });
    assert.deepEqual([...r.projects[0].movements], []);
});

test("file non validi vengono rifiutati con un messaggio chiaro", () => {
    const parse = text => app().parseBackup(text);
    assert.throws(() => parse("non è json"), /JSON valido/);
    assert.throws(() => parse(JSON.stringify(projects)), /non è un backup di SERENITÀ/);
    assert.throws(() => parse(JSON.stringify({ app: "altro", version: 1, projects: [] })), /non è un backup/);
    assert.throws(() => parse(JSON.stringify({ app: "andrea-suite", version: 2, projects: [] })), /versione più nuova/);
    assert.throws(() => parse(JSON.stringify({ app: "andrea-suite", version: 1, projects: [{ name: "Senza id" }] })), /progetto n° 1/);
    assert.throws(() => parse(JSON.stringify({ app: "andrea-suite", version: 1, projects: [{ id: 1, name: "X", movements: "no" }] })), /movimenti/);
    assert.throws(() => parse(JSON.stringify({ app: "andrea-suite", version: 1, projects: [], realLife: { manualDeposits: "abc" } })), /Bilancio Vita Reale/);
});

function app() { return loadApp(NOW); }
