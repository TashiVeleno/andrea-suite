const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const NOW = "2027-02-15T12:00:00";
const app = loadApp(NOW);
const close = (actual, expected, eps = 1e-6) =>
    assert.ok(Math.abs(actual - expected) < eps, `atteso ${expected}, ottenuto ${actual}`);

// 1 gen 2027 → 31 dic 2027 (365 giorni): Costruzione 150 €/mese per 3 mesi, Crescita 300 €/mese per 6 mesi, il resto Regime
const STAGES = [{ monthly: 150, months: 3 }, { monthly: 300, months: 6 }];
function stagedProject(movements = []) {
    return {
        id: 1, name: "Tappe", capital: 1000, goal: 6000, endDate: "2027-12-31",
        status: "active", createdAt: "2027-01-01T00:00:00", stages: STAGES,
        movements: [{ id: 10, type: "deposit", amount: 1000, date: "2027-01-01T09:00:00" }, ...movements]
    };
}

test("tappe: confini in mesi di calendario e ultima tappa calcolata", () => {
    const plan = app.calculateStagePlan(STAGES, 6000, "2027-01-01T00:00:00", "2027-12-31T00:00:00");
    assert.equal(plan.totalDays, 365);
    assert.deepEqual(JSON.parse(JSON.stringify(plan.stages.map(s => [s.startDay, s.endDay]))), [[0, 90], [90, 273], [273, 365]]); // 1 apr, 1 ott
    assert.deepEqual([...plan.stages.map(s => s.endTarget)], [450, 2250, 6000]);
    close(plan.stages[2].amount, 3750);
    close(plan.stages[2].monthly, 3750 / (92 / 30.44));
    assert.equal(plan.stages[0].endDate.getDate(), 31);   // Facile finisce il 31 marzo
    assert.equal(plan.stages[1].startDate.getMonth(), 3); // Medio parte il 1 aprile
});

test("tappe: traguardo previsto a gradini", () => {
    const plan = app.calculateStagePlan(STAGES, 6000, "2027-01-01T00:00:00", "2027-12-31T00:00:00");
    close(app.stageExpected(plan, 45), 450 * 45 / 90);
    close(app.stageExpected(plan, 90), 450);
    close(app.stageExpected(plan, 91), 450 + 1800 / 183);
    close(app.stageExpected(plan, 365), 6000);
    close(app.stageExpected(plan, 400), 6000);
});

test("tappe: errori se superano obiettivo o durata, null se vuote", () => {
    assert.equal(app.calculateStagePlan([{ monthly: 0, months: 3 }], 6000, "2027-01-01", "2027-12-31"), null);
    assert.equal(app.calculateStagePlan(null, 6000, "2027-01-01", "2027-12-31"), null);
    assert.ok(app.calculateStagePlan([{ monthly: 1000, months: 6 }], 6000, "2027-01-01T00:00:00", "2027-12-31T00:00:00").error);
    assert.ok(app.calculateStagePlan([{ monthly: 100, months: 12 }], 6000, "2027-01-01T00:00:00", "2027-12-31T00:00:00").error);
});

test("calculateProject con tappe: piano, ritmo della tappa e scostamento", () => {
    // 15 feb = giorno 46, tappa Facile; risultato +100
    const s = app.calculateProject(stagedProject([{ id: 11, type: "day", balance: 1100, deposit: 0, withdraw: 0, date: "2027-02-10T20:00:00" }]));
    assert.equal(s.elapsedDays, 46);
    assert.equal(s.currentStage, 0);
    close(s.expectedToday, 450 * 46 / 90);
    close(s.dailyNeeded, (450 - 100) / (90 - 46 + 1));       // per chiudere la tappa entro il 31 marzo
    close(s.monthlyNeeded, s.dailyNeeded * 30.44);
    close(s.daysDifference, (100 - 230) / (450 / 90));
    assert.equal(s.stageBehind, null);
});

test("calculateProject con tappe: tappa precedente chiusa sotto traguardo", () => {
    const app2 = loadApp("2027-04-10T12:00:00");
    const s = app2.calculateProject(stagedProject([{ id: 11, type: "day", balance: 1300, deposit: 0, withdraw: 0, date: "2027-03-30T20:00:00" }]));
    assert.equal(s.currentStage, 1);
    assert.equal(s.stageBehind.result, 300);
    assert.equal(s.stageBehind.target, 450);
    assert.equal(s.stageBehind.monthly, 150);
});

test("calculateProject con tappa già raggiunta: ritmo normale della tappa", () => {
    const s = app.calculateProject(stagedProject([{ id: 11, type: "day", balance: 1500, deposit: 0, withdraw: 0, date: "2027-02-10T20:00:00" }]));
    close(s.dailyNeeded, 450 / 90);
});

test("tappe: avviso se l'ultima tappa chiede più del doppio della precedente", () => {
    const steep = app.calculateStagePlan(STAGES, 6000, "2027-01-01T00:00:00", "2027-12-31T00:00:00").steep;
    assert.ok(steep);
    close(steep.ratio, (3750 / (92 / 30.44)) / 300);
    const ok = app.calculateStagePlan([{ monthly: 400, months: 4 }, { monthly: 500, months: 4 }], 6000, "2027-01-01T00:00:00", "2027-12-31T00:00:00");
    assert.equal(ok.steep, null);
});

test("tappe: compila in automatico (25% / 35% in tre parti)", () => {
    const auto = app.autoStages(12000, 24);
    assert.deepEqual(JSON.parse(JSON.stringify(auto)), [{ monthly: 380, months: 8 }, { monthly: 530, months: 8 }]);
    assert.equal(app.autoStages(12000, 2), null);
    assert.equal(app.autoStages(0, 12), null);
    // le tappe generate non fanno scattare l'avviso
    const plan = app.calculateStagePlan(auto, 12000, "2027-01-01T00:00:00", "2028-12-31T00:00:00");
    assert.equal(plan.error, undefined);
    assert.equal(plan.steep, null);
});

test("allarme: tappa precedente chiusa sotto traguardo", () => {
    const app2 = loadApp("2027-04-10T12:00:00");
    const p = stagedProject([{ id: 11, type: "day", balance: 1300, deposit: 0, withdraw: 0, date: "2027-03-30T20:00:00" }]);
    const alarms = app2.calculateAlarms(p, app2.calculateProject(p));
    assert.ok(alarms.some(a => a.icon === "🪜" && a.level === "yellow"));
});
