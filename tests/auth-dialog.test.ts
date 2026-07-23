import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AuthDialog from "../src/components/AuthDialog.vue";
import type { AuthMode } from "../src/lib/auth";

const { signOutMock, clearSessionMock, signInWithPasswordMock } = vi.hoisted(
  () => ({
    signOutMock: vi.fn(async (): Promise<void> => {}),
    clearSessionMock: vi.fn(async (): Promise<void> => {}),
    signInWithPasswordMock: vi.fn(async (username: string): Promise<void> => {
      if (username === "bad") throw new Error("用户名或密码错误");
    }),
  }),
);

vi.mock("../src/lib/auth", () => ({
  signInWithPassword: signInWithPasswordMock,
  signOut: signOutMock,
  clearSession: clearSessionMock,
}));

function mountDialog(props: {
  open: boolean;
  mode: AuthMode;
  username: string;
}) {
  return mount(AuthDialog, { props, attachTo: document.body });
}

async function fillAndSubmit(
  wrapper: ReturnType<typeof mountDialog>,
  username: string,
  password: string,
) {
  const userInput = wrapper.find<HTMLInputElement>("input");
  const passInput = wrapper.findAll<HTMLInputElement>("input").at(1);
  expect(userInput.exists()).toBe(true);
  expect(passInput).toBeDefined();
  await userInput.setValue(username);
  await passInput!.setValue(password);
  await wrapper.find("form").trigger("submit");
  await flushPromises();
  await flushPromises();
  await flushPromises();
}

describe("AuthDialog submit (real component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockReset();
    clearSessionMock.mockReset();
    signInWithPasswordMock.mockReset();
  });

  it("calls clearSession before signInWithPassword, in order", async () => {
    clearSessionMock.mockResolvedValueOnce(undefined);
    signInWithPasswordMock.mockResolvedValueOnce(undefined);

    const wrapper = mountDialog({
      open: true,
      mode: "anonymous",
      username: "",
    });
    await fillAndSubmit(wrapper, "admin", "secret");

    expect(clearSessionMock).toHaveBeenCalledTimes(1);
    expect(signInWithPasswordMock).toHaveBeenCalledTimes(1);

    const clearOrder = clearSessionMock.mock.invocationCallOrder[0] ?? 0;
    const signInOrder = signInWithPasswordMock.mock.invocationCallOrder[0] ?? 0;
    expect(signInOrder).toBeGreaterThan(clearOrder);

    expect(signInWithPasswordMock).toHaveBeenCalledWith("admin", "secret");
    expect(wrapper.find(".auth-error").exists()).toBe(false);
    expect(wrapper.find(".auth-status").text()).toBe("登录成功");
    expect(wrapper.emitted("changed")).toBeTruthy();
  });

  it("does not call signOut during login submit (signed-out is handled by clearSession)", async () => {
    clearSessionMock.mockResolvedValueOnce(undefined);
    signInWithPasswordMock.mockResolvedValueOnce(undefined);

    const wrapper = mountDialog({
      open: true,
      mode: "anonymous",
      username: "",
    });
    await fillAndSubmit(wrapper, "admin", "secret");

    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("blocks submission when clearSession throws and surfaces error message", async () => {
    clearSessionMock.mockRejectedValueOnce(
      new Error("退出登录失败：旧会话仍驻留，请重试"),
    );

    const wrapper = mountDialog({
      open: true,
      mode: "anonymous",
      username: "",
    });
    await fillAndSubmit(wrapper, "admin", "secret");

    const error = wrapper.find(".auth-error");
    const status = wrapper.find(".auth-status");
    expect(error.exists()).toBe(true);
    expect(error.text()).toBe("退出登录失败：旧会话仍驻留，请重试");
    expect(status.exists()).toBe(false);
  });

  it("surfaces signInWithPassword failure message", async () => {
    clearSessionMock.mockResolvedValueOnce(undefined);
    signInWithPasswordMock.mockRejectedValueOnce(new Error("用户名或密码错误"));

    const wrapper = mountDialog({
      open: true,
      mode: "anonymous",
      username: "",
    });
    await fillAndSubmit(wrapper, "bad", "secret");

    const error = wrapper.find(".auth-error");
    const status = wrapper.find(".auth-status");
    expect(error.exists()).toBe(true);
    expect(error.text()).toBe("用户名或密码错误");
    expect(status.exists()).toBe(false);
  });

  it("validates empty username/password without calling clearSession", async () => {
    const wrapper = mountDialog({
      open: true,
      mode: "anonymous",
      username: "",
    });
    const userInput = wrapper.find<HTMLInputElement>("input");
    const passInput = wrapper.findAll<HTMLInputElement>("input").at(1);
    expect(userInput.exists()).toBe(true);
    expect(passInput).toBeDefined();
    await userInput.setValue("   ");
    await passInput!.setValue("");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(clearSessionMock).not.toHaveBeenCalled();
    expect(wrapper.find(".auth-error").text()).toBe("请输入用户名和密码");
  });

  it("uses signOut for logout when already authenticated", async () => {
    signOutMock.mockResolvedValueOnce(undefined);

    const wrapper = mountDialog({
      open: true,
      mode: "authenticated",
      username: "admin",
    });
    await wrapper.find(".ghost-button").trigger("click");
    await flushPromises();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(clearSessionMock).not.toHaveBeenCalled();
    expect(wrapper.emitted("changed")).toBeTruthy();
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
