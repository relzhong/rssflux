import { atom } from "nanostores";
import { stopAutoSync } from "./syncStore";

const defaultValue = {
  isAuthenticated: false,
  username: "",
  isLoading: true,
};

export const authState = atom(defaultValue);

// 检查当前 Session 状态
export async function checkSession() {
  try {
    const res = await fetch("/api/auth/session");
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) {
        authState.set({
          isAuthenticated: true,
          username: data.username,
          isLoading: false,
        });
        return true;
      }
    }
  } catch (err) {
    console.error("Session check failed:", err);
  }

  authState.set({
    isAuthenticated: false,
    username: "",
    isLoading: false,
  });
  return false;
}

// 登录方法
export async function login(username, password, captchaId, captcha) {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
        captchaId,
        captcha,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || data.error || "Invalid credentials or captcha");
    }

    authState.set({
      isAuthenticated: true,
      username: data.username || username,
      isLoading: false,
    });

    return data;
  } catch (error) {
    console.error("登录失败:", error);
    throw error;
  }
}

// 登出方法
export async function logout() {
  try {
    stopAutoSync();

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request failed:", err);
    }

    authState.set({
      isAuthenticated: false,
      username: "",
      isLoading: false,
    });

    // 异步清理 IndexedDB 缓存
    await new Promise((resolve) => {
      try {
        const request = indexedDB.deleteDatabase("minifluxReader");
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (error) {
    console.error("登出失败:", error);
  }
}

// 初始化时检查一次 Session
checkSession();
