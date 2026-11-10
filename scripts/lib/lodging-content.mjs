import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { SafeError } from "./site-data-errors.mjs";

// Read the existing authored page content rather than inventing new policies.
function initializer(source, name) {
  const tree = ts.createSourceFile(
    "content.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
      found = node.initializer?.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (!found) throw new SafeError("PUBLIC_CONTENT_NOT_FOUND");
  return found;
}
export async function readLodgingContent(root = process.cwd()) {
  const [es, en, policySource, roomsSource] = await Promise.all([
    fs
      .readFile(path.join(root, "src/i18n/dictionaries/es.json"), "utf8")
      .then(JSON.parse),
    fs
      .readFile(path.join(root, "src/i18n/dictionaries/en.json"), "utf8")
      .then(JSON.parse),
    fs.readFile(path.join(root, "src/app/[lang]/politicas/page.tsx"), "utf8"),
    fs.readFile(
      path.join(root, "src/app/[lang]/rooms/RoomsClient.tsx"),
      "utf8",
    ),
  ]);
  const policyExpression = initializer(policySource, "texts");
  const legacy = vm.runInNewContext(
    "(" + initializer(roomsSource, "legacyRooms") + ")",
    { getPrimaryImage: () => "" },
    { timeout: 1000 },
  );
  const policy = {};
  for (const lang of ["es", "en"]) {
    const t = vm.runInNewContext(
      "(" + policyExpression + ")",
      { isEn: lang === "en" },
      { timeout: 1000 },
    );
    policy[lang] = [
      t.reservationTitle,
      t.reservationText,
      t.cancellationTitle + t.cancellationHighlight,
      t.cancellationText1 + t.cancellationStrong1 + ".",
      t.cancellationText2,
      ...t.bullets.map((b) => "• " + b),
      t.modTitle,
      t.modText1 + t.modStrong + t.modText2,
      t.stayTitle,
      t.stayText,
    ].join("\n\n");
  }
  const rooms = {};
  for (let i = 1; i <= 6; i++) {
    const a = es.roomsData[String(i)],
      b = en.roomsData[String(i)];
    if (!a || !b) throw new SafeError("PUBLIC_ROOM_CONTENT_INCOMPLETE");
    rooms[i] = {
      name: { es: a.name, en: b.name },
      description: {
        es: [a.description, legacy[i - 1]?.desc].filter(Boolean).join("\n\n"),
        en: b.description,
      },
      beds: { es: a.beds, en: b.beds },
    };
  }
  return {
    policy,
    rooms,
    house: {
      name: {
        es: "Casa Caballo Soñador · Casa completa",
        en: "Casa Caballo Soñador · Entire house",
      },
      description: { es: es.about.p1, en: en.about.p1 },
      beds: { es: "6 habitaciones privadas", en: "6 private rooms" },
    },
  };
}
