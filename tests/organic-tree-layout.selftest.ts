import assert from "node:assert/strict";

import {
  buildOrganicTreeGraph,
  resolveOrganicLayoutSpacing,
} from "../src/lib/organic-tree-layout";
import {
  validateOrganicNodePositions,
} from "../src/lib/organic-tree-collision";
import type { ParentKind, Person, SpouseStatus } from "../src/types/family";

function person(
  id: string,
  patch: Partial<Person> = {},
): Person {
  return {
    id,
    firstName: `P${id}`,
    lastName: "Test",
    relationshipLabel: "",
    parentIds: [],
    childIds: [],
    ...patch,
  };
}

function spouseLink(
  left: Person,
  right: Person,
  status: SpouseStatus = "current",
): void {
  left.spouseIds = [...new Set([...(left.spouseIds ?? []), right.id])];
  right.spouseIds = [...new Set([...(right.spouseIds ?? []), left.id])];
  left.spouseLinks = [
    ...(left.spouseLinks ?? []),
    { spouseId: right.id, status, confidence: "confirmed" },
  ];
  right.spouseLinks = [
    ...(right.spouseLinks ?? []),
    { spouseId: left.id, status, confidence: "confirmed" },
  ];
}

function parentLink(
  parent: Person,
  child: Person,
  kind: ParentKind = "biological",
): void {
  parent.childIds = [...new Set([...(parent.childIds ?? []), child.id])];
  child.parentIds = [...new Set([...(child.parentIds ?? []), parent.id])];
  child.parentLinks = [
    ...(child.parentLinks ?? []),
    { parentId: parent.id, kind, confidence: "confirmed" },
  ];
}

function layoutOf(people: Person[]) {
  return buildOrganicTreeGraph(people, {
    spacing: resolveOrganicLayoutSpacing("all"),
  });
}

function nodeY(layout: ReturnType<typeof layoutOf>, id: string) {
  const node = layout.nodes.find((item) => item.id === id);
  assert.ok(node, `node ${id} exists`);
  return node.position.y;
}

function nodeX(layout: ReturnType<typeof layoutOf>, id: string) {
  const node = layout.nodes.find((item) => item.id === id);
  assert.ok(node, `node ${id} exists`);
  return node.position.x;
}

function run() {
  // 1. Один человек
  {
    const a = person("a");
    const layout = layoutOf([a]);
    assert.equal(layout.nodes.length, 1);
  }

  // 2. Супруги без детей; 7. супруги на одной высоте
  {
    const a = person("a");
    const b = person("b");
    spouseLink(a, b);
    const layout = layoutOf([a, b]);
    assert.equal(nodeY(layout, "a"), nodeY(layout, "b"));
  }

  // 3-5. Родители, несколько детей, три поколения; 6. старшие ниже младших; 8. дети выше union
  {
    const gp = person("gp");
    const gm = person("gm");
    const p1 = person("p1");
    const p2 = person("p2");
    const c1 = person("c1");
    const c2 = person("c2");
    spouseLink(gp, gm);
    spouseLink(p1, p2);
    parentLink(gp, p1);
    parentLink(gm, p1);
    parentLink(p1, c1);
    parentLink(p2, c1);
    parentLink(p1, c2);
    parentLink(p2, c2);
    const layout = layoutOf([gp, gm, p1, p2, c1, c2]);
    assert.ok(nodeY(layout, "gp") > nodeY(layout, "p1"));
    assert.ok(nodeY(layout, "p1") > nodeY(layout, "c1"));
  }

  // 9-10. Несколько браков и дети от разных союзов
  {
    const a = person("a");
    const b = person("b");
    const c = person("c");
    const ch1 = person("ch1");
    const ch2 = person("ch2");
    spouseLink(a, b);
    spouseLink(a, c, "former");
    parentLink(a, ch1);
    parentLink(b, ch1);
    parentLink(a, ch2);
    parentLink(c, ch2);
    const layout = layoutOf([a, b, c, ch1, ch2]);
    assert.ok(nodeY(layout, "a") === nodeY(layout, "b"));
    assert.ok(nodeY(layout, "a") === nodeY(layout, "c"));
    assert.ok(nodeY(layout, "ch1") < nodeY(layout, "a"));
    assert.ok(nodeY(layout, "ch2") < nodeY(layout, "a"));
  }

  // 11-14. Усыновление, отчим, опекун, бывший супруг
  {
    const a = person("a");
    const b = person("b");
    const c = person("c");
    const d = person("d");
    const child = person("child");
    spouseLink(a, b, "former");
    spouseLink(c, d);
    parentLink(a, child, "adoptive");
    parentLink(b, child, "step");
    parentLink(c, child, "guardian");
    const layout = layoutOf([a, b, c, d, child]);
    assert.ok(layout.edges.some((edge) => edge.data && "parentKind" in edge.data));
  }

  // 15-17. Несвязанные компоненты, без даты, цикл
  {
    const a = person("a");
    const b = person("b");
    const c = person("c");
    const d = person("d", { birthDate: undefined });
    parentLink(a, b);
    parentLink(b, c);
    parentLink(c, a);
    const layout = layoutOf([a, b, c, d]);
    assert.equal(layout.nodes.length, 4);
  }

  // 18-21. Collisions, undefined, NaN/Infinity
  {
    const people = Array.from({ length: 8 }, (_, index) =>
      person(`n${index}`, {
        parentIds: index > 0 ? [`n${index - 1}`] : [],
        childIds: index < 7 ? [`n${index + 1}`] : [],
      }),
    );
    const layout = layoutOf(people);
    const validation = validateOrganicNodePositions(layout.nodes);
    assert.ok(validation.valid, validation.collisions.join(", "));
    assert.ok(
      layout.nodes.every(
        (node) =>
          Number.isFinite(node.position.x) && Number.isFinite(node.position.y),
      ),
    );
  }

  // 22-23. Стабильность focused branch / повторный расчёт
  {
    const a = person("a");
    const b = person("b");
    const c = person("c");
    spouseLink(a, b);
    parentLink(a, c);
    parentLink(b, c);
    const first = layoutOf([a, b, c]);
    const second = layoutOf([a, b, c]);
    assert.equal(nodeX(first, "a"), nodeX(second, "a"));
    assert.equal(nodeY(first, "c"), nodeY(second, "c"));
  }

  // 24-25. Текущий объём и синтетическое дерево 300+
  {
    const synthetic: Person[] = [];
    for (let i = 0; i < 320; i += 1) {
      synthetic.push(
        person(`s${i}`, {
          parentIds: i >= 2 ? [`s${Math.floor((i - 2) / 2)}`] : [],
          childIds: [],
        }),
      );
    }
    for (let i = 0; i < synthetic.length; i += 1) {
      const current = synthetic[i];
      for (const parentId of current.parentIds) {
        const parent = synthetic.find((item) => item.id === parentId);
        if (parent) {
          parent.childIds = [...new Set([...(parent.childIds ?? []), current.id])];
        }
      }
    }
    const layout = layoutOf(synthetic);
    assert.equal(layout.nodes.length, synthetic.length);
    assert.ok(validateOrganicNodePositions(layout.nodes).valid);
  }

  console.log("organic-tree-layout self-test: ok");
}

run();
