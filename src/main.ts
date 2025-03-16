import * as p from "jsr:@std/path@^1.0.8";
import { Command } from "jsr:@cliffy/command@1.0.0-rc.7";
import { Toggle } from "jsr:@cliffy/prompt@1.0.0-rc.7";
import $ from "jsr:@david/dax@^0.42.0";
import packageInfo from "../deno.json" with { type: "json" };

/** Entrypoint of deno-sv. */
export default async function main() {
  const { options } = await parseCommand();
  try {
    const dir = await confirmProjectRoot(options.confirm);
    console.log(`${options.vitest} ${options.tailwind} ${dir}`);
  } catch (e) {
    showError(e);
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
  if (!(await Toggle.prompt(`Setup the dir as svelte project: ${cwd}`))) throw new Error("cancelled");
  return cwd;
}
function showError(e: unknown) {
  if (e instanceof Error) {
    console.log(`error: ${e.message}`);
  } else {
    throw e;
  }
}
