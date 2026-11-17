// index.ts - the public face of @tygig/auth.

export type { Credentials, ChatGPTAccount } from "./credentials.js";
export { readCredentials, updateCredentials, withLock, writeFileAtomic } from "./credentials.js";
export type { SignInResult } from "./chatgpt-oauth.js";
export { signInWithChatGPT, markWelcomed } from "./chatgpt-oauth.js";
export { getChatGPTAccessToken, refreshChatGPTToken, signOutChatGPT, hasChatGPTSignIn } from "./chatgpt-session.js";
export { openBrowser } from "./browser.js";
