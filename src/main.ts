import * as p from "jsr:@std/path@^1.0.8";
import { UntarStream } from "jsr:@std/tar@^0.1.6";
import { Command } from "jsr:@cliffy/command@1.0.0-rc.7";
import { Toggle } from "jsr:@cliffy/prompt@1.0.0-rc.7";
import $ from "jsr:@david/dax@^0.42.0";
import { JSRPackage } from "./package_downloader.ts";
import packageInfo from "../deno.json" with { type: "json" };

/** Entrypoint of deno-sv. */
export default async function main() {
  const { options } = await parseCommand();
  const root = await confirmProjectRoot(options.confirm);
  if (!root) return console.error(`cancelled`);

  const tmp = Deno.makeTempDirSync();
  try {
    const source = await prepareSetup(tmp);
    setupTemplateFiles(source, root, options.vitest, options.tailwind);
    await setupPackages(options.vitest, options.tailwind);
    finalizeSetup(root, options.vitest, options.tailwind);
  } catch (e) {
    showError(e);
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
}

async function parseCommand() {
  return await new Command()
    .name("deno-sv")
    .version(packageInfo.version)
    .description("A CLI tool to setup Svelte/SvelteKit on Deno until official support.")
    .option("--vitest", "Enable vitest setup.")
    .option("--tailwind", "Enable tailwindcss setup.")
    .option("--no-confirm", "Skip interactions")
    .parse(Deno.args);
}

async function confirmProjectRoot(confirm?: boolean): Promise<string> {
  const cwd = p.resolve(".");
  if (!confirm) return cwd;
  if (!(await Toggle.prompt(`Setup the dir as svelte project: ${cwd}`))) return "";
  return cwd;
}

async function prepareSetup(tmp: string): Promise<string> {
  const pkg = p.join(tmp, "pkg.tgz");
  await new JSRPackage("scirexs", "sv").downloadPackage(pkg);
  await decompressTgz(pkg);
  return p.join(tmp, "package", "templates");
}
async function decompressTgz(path: string) {
  const dir = p.dirname(path);
  for await (
    const entry of (await Deno.open(path)).readable
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeThrough(new UntarStream())
  ) {
    const target = p.normalize(p.join(dir, entry.path));
    Deno.mkdirSync(p.dirname(target), { recursive: true });
    await entry.readable?.pipeTo((await Deno.create(target)).writable);
  }
}

function setupTemplateFiles(source: string, root: string, vitest?: boolean, tailwind?: boolean) {
  setupBaseFiles(source, root);
  if (vitest) setupVitestFiles(source, root);
  if (tailwind) setupTailwindFiles(source, root);
}
function setupBaseFiles(source: string, root: string) {
  const BASE_ROOT = ["deno.json", "tsconfig.json", "vite.config.ts", "svelte.config.mjs", "gitignore.txt"];
  const BASE_SRC = ["app.html"];
  const BASE_ROUTES = ["+page.svelte", "+layout.server.ts", "+error.svelte"];
  const BASE_STATIC = ["favicon.svg", "favicon.ico", "apple-touch-icon.png"];

  const src = p.join(root, "src");
  Deno.mkdirSync(p.join(src, "lib"), { recursive: true });
  copyFilesWithMakeDir(source, root, BASE_ROOT);
  copyFilesWithMakeDir(source, src, BASE_SRC);
  copyFilesWithMakeDir(source, p.join(src, "routes"), BASE_ROUTES);
  copyFilesWithMakeDir(source, p.join(root, "static"), BASE_STATIC);
}
function setupVitestFiles(source: string, root: string) {
  const VITEST_TESTS = ["setup.ts", "unit.test.ts"];
  copyFilesWithMakeDir(source, p.join(root, "tests"), VITEST_TESTS);
}
function setupTailwindFiles(source: string, root: string) {
  const TAIL_SRC = ["app.css"];
  const TAIL_ROUTES = ["+layout.svelte"];
  copyFilesWithMakeDir(source, p.join(root, "src"), TAIL_SRC);
  copyFilesWithMakeDir(source, p.join(root, "src", "routes"), TAIL_ROUTES);
}
function copyFilesWithMakeDir(from: string, to: string, files: string[]) {
  Deno.mkdirSync(to, { recursive: true });
  files.forEach((file) => copy(from, to, file));
}
function copy(from: string, to: string, file: string) {
  Deno.copyFileSync(p.join(from, file), p.join(to, file));
}

async function setupPackages(vitest?: boolean, tailwind?: boolean) {
  await setupBasePackages();
  if (vitest) await setupVitestPackages();
  if (tailwind) await setupTailwindPackages();
}
async function setupBasePackages() {
  const PACKAGES = [
    "vite",
    "svelte",
    "svelte-check",
    "@sveltejs/kit",
    "@sveltejs/vite-plugin-svelte",
    "@deno/vite-plugin",
    "@sveltejs/adapter-static",
  ];
  await addNpmPackage(PACKAGES);
}
async function setupVitestPackages() {
  const PACKAGES = ["@testing-library/svelte", "vitest", "jsdom", "@testing-library/jest-dom", "@testing-library/user-event"];
  await addNpmPackage(PACKAGES);
}
async function setupTailwindPackages() {
  const PACKAGES = ["tailwindcss", "@tailwindcss/vite"];
  await addNpmPackage(PACKAGES);
}
async function addNpmPackage(packages: string[]) {
  for (const name of packages) {
    await $`deno add npm:${name}`;
  }
}

function finalizeSetup(root: string, vitest?: boolean, tailwind?: boolean) {
  renameGitignore(root);
  adjustViteConfig(p.join(root, "vite.config.ts"), vitest, tailwind);
  fixSvelteConfig(p.join(root, "svelte.config.mjs"));
  if (vitest) {
    fixTestSetup(p.join(root, "tests", "setup.ts"));
    fixUnitTest(p.join(root, "tests", "unit.test.ts"));
  }
  if (tailwind) {
    switchTailwindViteLink(root);
    removeDupVitePackage(root);
  }
}
function renameGitignore(root: string) {
  const from = p.join(root, "gitignore.txt");
  const to = p.join(root, ".gitignore");
  Deno.renameSync(from, to);
}
function adjustViteConfig(path: string, vitest?: boolean, tailwind?: boolean) {
  let config = Deno.readTextFileSync(path);
  config = toggleComments(config, "//V", vitest);
  config = toggleComments(config, "//T", tailwind);
  Deno.writeTextFileSync(path, config.replaceAll(`from "./`, `from "`));
}
function toggleComments(text: string, word: string, bool?: boolean): string {
  if (bool) {
    return text.replaceAll(word, "");
  } else {
    return text.split("\n").filter((x) => !x.startsWith(word)).join("\n");
  }
}
function fixSvelteConfig(path: string) {
  Deno.writeTextFileSync(path, Deno.readTextFileSync(path).replaceAll(`from "./`, `from "`));
}
function fixTestSetup(path: string) {
  Deno.writeTextFileSync(path, Deno.readTextFileSync(path).replaceAll(`from "./`, `from "`).replaceAll(`import "./`, `import "`));
}
function fixUnitTest(path: string) {
  Deno.writeTextFileSync(path, Deno.readTextFileSync(path).replaceAll(`from "./`, `from "`));
}
async function switchTailwindViteLink(root: string) {
  const dir = seekTailwindViteDir(root);
  if (!dir) return;
  const link = p.join(dir, "node_modules", "vite");
  const tobe = (await $`readlink ${link}`.text()).replace("_1", "");
  await $`ln -nfs ${tobe} ${link}`;
}
function seekTailwindViteDir(root: string): string {
  const deno = p.join(root, "node_modules", ".deno");
  for (const entry of Deno.readDirSync(deno)) {
    if (entry.name.startsWith("@tailwindcss+vite")) return p.join(deno, entry.name);
  }
  return "";
}
function removeDupVitePackage(root: string) {
  const dir = p.join(root, "node_modules", ".deno");
  for (const entry of Deno.readDirSync(dir)) {
    if (entry.name.startsWith("vite@") && entry.name.endsWith("_1") && entry.isDirectory) {
      Deno.removeSync(p.join(dir, entry.name), { recursive: true });
    }
  }
}

function showError(e: unknown) {
  if (e instanceof Error) {
    console.error(`error: ${e.message}`);
  } else {
    throw e;
  }
}
