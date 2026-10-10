import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const apiDirectory = path.resolve(process.cwd(), "app/api");

function listRouteFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listRouteFiles(entryPath);
    return entry.name === "route.ts" ? [entryPath] : [];
  });
}

function isExported(node: ts.Node) {
  return ts.canHaveModifiers(node)
    ? ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    : false;
}

function callsRequireAuthUser(node: ts.Node) {
  let found = false;
  function visit(child: ts.Node) {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === "requireAuthUser"
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

describe("autenticación de rutas API", () => {
  const routeFiles = listRouteFiles(apiDirectory).filter(
    (filePath) => !filePath.includes(`${path.sep}api${path.sep}auth${path.sep}`),
  );

  for (const filePath of routeFiles) {
    const relativePath = path.relative(process.cwd(), filePath);

    it(`${relativePath} protege todos sus handlers`, () => {
      const source = ts.createSourceFile(
        filePath,
        fs.readFileSync(filePath, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const handlers: Array<{ name: string; node: ts.Node }> = [];

      for (const statement of source.statements) {
        if (
          ts.isFunctionDeclaration(statement) &&
          statement.name &&
          HTTP_METHODS.has(statement.name.text) &&
          isExported(statement)
        ) {
          handlers.push({ name: statement.name.text, node: statement });
        }
        if (ts.isVariableStatement(statement) && isExported(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (
              ts.isIdentifier(declaration.name) &&
              HTTP_METHODS.has(declaration.name.text) &&
              declaration.initializer
            ) {
              handlers.push({ name: declaration.name.text, node: declaration.initializer });
            }
          }
        }
      }

      expect(handlers.length, "La ruta debe exportar al menos un handler HTTP").toBeGreaterThan(0);
      for (const handler of handlers) {
        expect(
          callsRequireAuthUser(handler.node),
          `${handler.name} debe llamar a requireAuthUser()`,
        ).toBe(true);
      }
    });
  }
});
