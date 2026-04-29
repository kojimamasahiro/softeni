import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.APP_CONFIG ?? {};
const requiredConfigKeys = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'FUNCTIONS_BASE_URL',
];

const configErrorEl = document.getElementById('config-error');
const statusMessageEl = document.getElementById('status-message');
const loggedOutView = document.getElementById('logged-out-view');
const loggedInView = document.getElementById('logged-in-view');
const userEmailEl = document.getElementById('user-email');
const deleteCardEl = document.getElementById('delete-card');
const successCardEl = document.getElementById('success-card');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const deleteButton = document.getElementById('delete-button');
const confirmDeleteCheckbox = document.getElementById('confirm-delete');

let supabase = null;

function showElement(element, visible) {
  element.classList.toggle('hidden', !visible);
}

function setStatus(message, tone = 'success') {
  statusMessageEl.textContent = message;
  statusMessageEl.className = `notice notice-${tone}`;
  showElement(statusMessageEl, true);
}

function clearStatus() {
  statusMessageEl.textContent = '';
  statusMessageEl.className = 'notice hidden';
}

function setConfigError(message) {
  configErrorEl.textContent = message;
  showElement(configErrorEl, true);
  loginButton.disabled = true;
  deleteButton.disabled = true;
}

function hasRequiredConfig() {
  return requiredConfigKeys.every((key) => {
    const value = config[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function normalizeFunctionsBaseUrl() {
  return config.FUNCTIONS_BASE_URL.replace(/\/+$/, '');
}

async function renderSession(session) {
  clearStatus();
  showElement(successCardEl, false);

  const user = session?.user ?? null;
  const isLoggedIn = Boolean(user);

  showElement(loggedOutView, !isLoggedIn);
  showElement(loggedInView, isLoggedIn);
  showElement(deleteCardEl, isLoggedIn);

  if (!isLoggedIn) {
    userEmailEl.textContent = '';
    confirmDeleteCheckbox.checked = false;
    deleteButton.disabled = true;
    loginButton.disabled = false;
    return;
  }

  userEmailEl.textContent = user.email ?? user.id;
  deleteButton.disabled = !confirmDeleteCheckbox.checked;
}

async function bootstrap() {
  if (!hasRequiredConfig()) {
    setConfigError(
      'config.js の設定が不足しています。SUPABASE_URL、SUPABASE_ANON_KEY、FUNCTIONS_BASE_URL を設定してください。',
    );
    return;
  }

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

  loginButton.addEventListener('click', async () => {
    clearStatus();
    loginButton.disabled = true;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/account-delete`,
        },
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'ログインに失敗しました。';
      setStatus(message, 'error');
      loginButton.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    clearStatus();
    const { error } = await supabase.auth.signOut();
    if (error) {
      const message =
        error instanceof Error ? error.message : 'ログアウトに失敗しました。';
      setStatus(message, 'error');
    }
  });

  confirmDeleteCheckbox.addEventListener('change', () => {
    deleteButton.disabled = !confirmDeleteCheckbox.checked;
  });

  deleteButton.addEventListener('click', async () => {
    clearStatus();
    deleteButton.disabled = true;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setStatus('削除を実行するにはログインが必要です。', 'error');
      await renderSession(null);
      return;
    }

    try {
      const response = await fetch(
        `${normalizeFunctionsBaseUrl()}/deleteAccount`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: session.user.id,
          }),
        },
      );

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          typeof responseBody.error === 'string'
            ? responseBody.error
            : 'アカウント削除に失敗しました。';
        throw new Error(errorMessage);
      }

      await supabase.auth.signOut();
      showElement(deleteCardEl, false);
      showElement(loggedInView, false);
      showElement(loggedOutView, false);
      showElement(successCardEl, true);
      setStatus('アカウント削除が完了しました。', 'success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'アカウント削除に失敗しました。';
      setStatus(message, 'error');
      await renderSession(session);
    }
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  await renderSession(session);

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    await renderSession(nextSession);
  });
}

bootstrap();
