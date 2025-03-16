import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

// reference: https://testing-library.com/docs/
// expect methods: https://vitest.dev/api/expect.html, https://github.com/testing-library/jest-dom?tab=readme-ov-file
// describe("unit_testing", () => {
//   test("test1", async () => {
    // const user = userEvent.setup();
    // const action = vi.fn();
    // let props = $state({ title: "Test", value: "default", action });
    // const { getByRole } = render(Foo, props);

    // const textbox = getByRole("textbox") as HTMLInputElement;

    // expect(action).toHaveBeenCalledTimes(1);
    // expect(textbox.textContent).toHaveValue("default");
    // await user.click(textbox);
    // await user.type(textbox, "test");
    // await user.clear();
    // await user.tab();
//   });
// });
