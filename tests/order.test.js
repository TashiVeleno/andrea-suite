const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-11-02T12:00:00");
const plain = v => JSON.parse(JSON.stringify(v));
const ids = list => plain(list).map(p => p.id);

const sample = () => [
    { id: 1, name: "A", status: "active" },
    { id: 2, name: "B", status: "completed" },
    { id: 3, name: "C" },
    { id: 4, name: "D", status: "active" }
];

test("senza ordine salvato: i progetti aperti restano nell'ordine di sempre, i chiusi esclusi", () => {
    assert.deepEqual(ids(app.sortActiveProjects(sample())), [1, 3, 4]);
});

test("sposta in alto e in basso, rinumerando solo i progetti aperti", () => {
    const list = sample();
    assert.equal(app.moveProjectInList(list, 4, -1), true);
    assert.deepEqual(ids(app.sortActiveProjects(list)), [1, 4, 3]);
    assert.equal(app.moveProjectInList(list, 1, 1), true);
    assert.deepEqual(ids(app.sortActiveProjects(list)), [4, 1, 3]);
    assert.equal(list[1].order, undefined); // progetto chiuso non toccato
});

test("il primo non sale e l'ultimo non scende", () => {
    const list = sample();
    assert.equal(app.moveProjectInList(list, 1, -1), false);
    assert.equal(app.moveProjectInList(list, 4, 1), false);
    assert.equal(app.moveProjectInList(list, 2, 1), false); // chiuso: non si sposta
    assert.ok(list.every(p => p.order === undefined));
});

test("un progetto nuovo (senza ordine) va in fondo", () => {
    const list = sample();
    app.moveProjectInList(list, 4, -1);
    list.push({ id: 5, name: "E", status: "active" });
    assert.deepEqual(ids(app.sortActiveProjects(list)), [1, 4, 3, 5]);
});

test("l'ordine cambiato su un dispositivo arriva anche sull'altro", () => {
    const base = sample();
    const pc = plain(base);
    app.moveProjectInList(pc, 4, -1);
    const phone = plain(base); // il telefono non ha cambiato niente
    const merged = app.mergeProjects(base, phone, pc);
    assert.deepEqual(ids(app.sortActiveProjects(merged)), [1, 4, 3]);
});
