import fs from "node:fs";
import postcss from "postcss";
const root = postcss.root();
for (const file of ["tokens", "globals", "workspace-extensions", "mobile"]) {
  const ast = postcss.parse(
    fs.readFileSync(`src/cala/styles/${file}.css`, "utf8"),
  );
  ast.walkAtRules("import", (rule) => rule.remove());
  ast.walkRules((rule) => {
    let ancestor = rule.parent;
    while (ancestor) {
      if (ancestor.type === "atrule" && ancestor.name.endsWith("keyframes"))
        return;
      ancestor = ancestor.parent;
    }
    rule.selectors = rule.selectors.map((selector) => {
      if (selector.includes(":root"))
        return selector.replaceAll(":root", ".cala-admin");
      if (/^html\b/.test(selector))
        return selector
          .replace(/^html((?:\[[^\]]+\])*)\s*/, (_, attributes) =>
            attributes ? `html${attributes} .cala-admin ` : ".cala-admin ",
          )
          .trim();
      if (/^body\b/.test(selector))
        return selector.replace(/^body/, ".cala-admin");
      if (/^\[data-(theme|density)/.test(selector))
        return `html${selector.replace(/^(\[data-(?:theme|density)[^\]]+\])/, "$1 .cala-admin")}`;
      return `.cala-admin ${selector}`;
    });
  });
  root.append(ast.nodes);
}
fs.writeFileSync(
  "src/cala/styles/cala.css",
  root.toString().replaceAll("/assets/", "/cala/assets/") +
    `\n.cala-admin h1,.cala-admin h2,.cala-admin h3,.cala-admin h4,.cala-admin h5,.cala-admin h6{font-family:inherit}.cala-admin .setup-card{max-width:680px;margin:8dvh auto;padding:32px 24px}.cala-admin .setup-card h1{margin-top:24px}.cala-admin .setup-card details{margin:24px 0}.cala-admin .setup-card ul{padding-left:24px}.cala-admin .site-module{min-width:0;overflow-wrap:anywhere}.cala-admin .site-module h1{font-family:inherit}.cala-admin .site-module .min-h-screen{min-height:initial}.cala-admin .site-module>div{padding:16px!important}.cala-admin .auth-panel label{display:grid;gap:8px;margin:18px 0}.cala-admin .auth-panel input{width:100%}.cala-admin .auth-panel .helper{margin-top:24px}@media(max-width:767px){.cala-admin .site-module{overflow-x:auto;max-width:100%}}\n`,
);
