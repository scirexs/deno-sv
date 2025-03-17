import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import deno from "@deno/vite-plugin";
//Vimport { svelteTesting } from "@testing-library/svelte/vite";
//Timport tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    deno(),
    sveltekit(),
//T    tailwindcss(),
  ],
//V  test: {
//V    workspace: [{
//V      extends: "./vite.config.ts",
//V      plugins: [svelteTesting()],
//V      test: {
//V        name: "client",
//V        environment: "jsdom",
//V        clearMocks: true,
//V        include: [
//V          "tests/**/*.svelte.test.ts",
//V          "tests/**/*.test.ts",
//V        ],
//V        setupFiles: ["./tests/setup.ts"],
//V      },
//V    }],
//V  },
});
