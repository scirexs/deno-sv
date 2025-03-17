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
    await setupSvelte(source, root);
    if (options.vitest) await setupVitest(source, root);
    if (options.tailwind) await setupTailwind(source, root);
    await finalizeSetup(root, options.vitest, options.tailwind);
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

async function setupSvelte(source: string, root: string) {
  const ROOT_FILES = ["deno.json", "tsconfig.json", "vite.config.ts", "svelte.config.mjs", "gitignore.txt"];
  const SRC_FILES = ["app.html"];
  const ROUTES_FILES = ["+page.svelte", "+layout.server.ts", "+error.svelte"];
  const STATIC_FILES = ["favicon.svg", "favicon.ico", "apple-touch-icon.png"];
  const PACKAGES = [
    "vite",
    "svelte",
    "svelte-check",
    "@sveltejs/kit",
    "@sveltejs/vite-plugin-svelte",
    "@deno/vite-plugin",
    "@sveltejs/adapter-static",
  ];

  const src = p.join(root, "src");
  Deno.mkdirSync(p.join(src, "lib"), { recursive: true });
  copyFilesWithMakeDir(source, root, ROOT_FILES);
  copyFilesWithMakeDir(source, src, SRC_FILES);
  copyFilesWithMakeDir(source, p.join(src, "routes"), ROUTES_FILES);
  copyFilesWithMakeDir(source, p.join(root, "static"), STATIC_FILES);
  await addNpmPackage(PACKAGES);
}
async function setupVitest(source: string, root: string) {
  const TESTS_FILES = ["setup.ts", "unit.test.ts"];
  const PACKAGES = ["vitest", "jsdom", "@testing-library/jest-dom", "@testing-library/svelte", "@testing-library/user-event"];

  copyFilesWithMakeDir(source, p.join(root, "tests"), TESTS_FILES);
  await addNpmPackage(PACKAGES);
}
async function setupTailwind(source: string, root: string) {
  const SRC_FILES = ["app.css"];
  const ROUTES_FILES = ["+layout.svelte"];
  const PACKAGES = ["tailwindcss", "@tailwindcss/vite"];

  copyFilesWithMakeDir(source, p.join(root, "src"), SRC_FILES);
  copyFilesWithMakeDir(source, p.join(root, "src", "routes"), ROUTES_FILES);
  await addNpmPackage(PACKAGES);
}
async function addNpmPackage(packages: string[]) {
  for (const name of packages) {
    await $`deno add npm:${name}`;
  }
}
function copyFilesWithMakeDir(from: string, to: string, files: string[]) {
  Deno.mkdirSync(to, { recursive: true });
  files.forEach((file) => copy(from, to, file));
}
function copy(from: string, to: string, file: string) {
  Deno.copyFileSync(p.join(from, file), p.join(to, file));
}

async function finalizeSetup(root: string, vitest?: boolean, tailwind?: boolean) {
  const vite = p.join(root, "vite.config.ts");
  const svelte = p.join(root, "svelte.config.mjs");

  renameGitignore(root);
  await adjustViteConfig(vite, vitest, tailwind);
  await fixSvelteConfig(svelte);
}
function renameGitignore(root: string) {
  const from = p.join(root, "gitignore.txt");
  const to = p.join(root, ".gitignore");
  Deno.renameSync(from, to);
}
async function adjustViteConfig(path: string, vitest?: boolean, tailwind?: boolean) {
  const forVitest = vitest ? `sed -i 's:// ::' ${path}` : `sed -i '/^\\s*\\/\\/ / d' ${path}`;
  const forTailwind = tailwind ? `sed -i 's:///::' ${path}` : `sed -i '/^\\s*\\/\\/\\// d' ${path}`;

  await $`sed '/^import/ s:./::' ${path}`;
  await $`${forVitest}`;
  await $`${forTailwind}`;
}
async function fixSvelteConfig(path: string) {
  await $`sed '/^import/ s:./::' ${path}`;
}

function showError(e: unknown) {
  if (e instanceof Error) {
    console.error(`error: ${e.message}`);
  } else {
    throw e;
  }
}
