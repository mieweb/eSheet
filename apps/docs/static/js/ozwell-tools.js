(function () {
  // Inject CSS overrides to match the eSheet docs site color scheme
  // and fix icon sizing/appearance.
  (function injectOzwellStyles() {
    // Use the Docusaurus CSS variable so it respects light/dark mode.
    const primary =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--ifm-color-primary')
        .trim() || '#2563eb';
    const style = document.createElement('style');
    style.textContent =
      /* Match docs primary color instead of default #0066ff */
      '.ozwell-chat-button{background:var(--ifm-color-primary,#2563eb)!important;box-shadow:0 4px 16px color-mix(in srgb,var(--ifm-color-primary,#2563eb) 35%,transparent)!important;}' +
      '.ozwell-chat-button:hover{box-shadow:0 6px 20px color-mix(in srgb,var(--ifm-color-primary,#2563eb) 50%,transparent)!important;}' +
      '.ozwell-chat-header{background:var(--ifm-color-primary,#2563eb)!important;}' +
      /* Replace the broken /favicon.ico img with the eSheet SVG logo */
      '.ozwell-chat-icon{display:none!important;}' +
      ".ozwell-chat-button::after{content:'';display:block;width:24px;height:24px;background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath stroke='none' d='M0 0h24v24H0z' fill='none'/%3E%3Cpath d='M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10'/%3E%3Cpath d='M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2'/%3E%3C/svg%3E\") center/contain no-repeat}";
    document.head.appendChild(style);

    // Inject brand colors into the widget iframe (Send button, user messages, input focus).
    // The iframe is same-origin (srcdoc + allow-same-origin) so we can access its document.
    document.addEventListener('ozwell-chat-ready', function () {
      const iframe = window.OzwellChat && window.OzwellChat.iframe;
      if (!iframe || !iframe.contentDocument) return;
      const s = iframe.contentDocument.createElement('style');
      s.textContent =
        '.chat-submit{background:' +
        primary +
        '!important}' +
        '.chat-submit:hover{background:color-mix(in srgb,' +
        primary +
        ' 85%,black)!important}' +
        '.message.user{background:' +
        primary +
        '!important}' +
        '.message.queued{color:' +
        primary +
        '!important;border-color:' +
        primary +
        '!important}' +
        '.chat-input:focus{border-color:' +
        primary +
        '!important;box-shadow:0 0 0 3px color-mix(in srgb,' +
        primary +
        ' 10%,transparent)!important}';
      iframe.contentDocument.head.appendChild(s);
    });
  })();

  // Load all doc content from the pre-built static bundle
  let docContentPromise = null;
  function getDocContent() {
    if (!docContentPromise) {
      docContentPromise = fetch('/doc-content.json').then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
    }
    return docContentPromise;
  }

  function sendContext() {
    if (window.OzwellChat && window.OzwellChat.updateContext) {
      window.OzwellChat.updateContext({
        page: window.location.pathname,
        title: document.title,
      });
    }
  }

  // Extract a plain string from whatever the model passes as the query arg
  function extractQueryString(val) {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      // If the object looks like a JSON schema the model accidentally sent, ignore it
      if (val.type === 'string' && val.description) return '';
      // Try common keys the model might use when it sends an object
      const attempt =
        val.query || val.text || val.search || val.keywords || val.q;
      if (attempt && typeof attempt === 'string') return attempt;
      // Last resort: first string-valued property that isn't a schema key
      const schemaKeys = {
        type: 1,
        description: 1,
        required: 1,
        properties: 1,
      };
      const keys = Object.keys(val);
      for (let i = 0; i < keys.length; i++) {
        if (!schemaKeys[keys[i]] && typeof val[keys[i]] === 'string')
          return val[keys[i]];
      }
    }
    return String(val || '');
  }

  // Score a page (path + content) against query words
  function scorePage(path, content, queryWords) {
    const pathLower = path.toLowerCase();
    const contentLower = (content || '').toLowerCase();
    let score = 0;
    for (let i = 0; i < queryWords.length; i++) {
      const word = queryWords[i];
      if (pathLower.indexOf(word) !== -1) score += 3; // path match is a strong signal
      // Count all occurrences in content (frequency beats presence)
      let pos = 0;
      while ((pos = contentLower.indexOf(word, pos)) !== -1) {
        score += 1;
        pos += word.length;
      }
    }
    // Boost intro/overview pages for general queries
    if (/\/(intro|overview|index|readme)/.test(pathLower) || path === '/docs')
      score += 5;
    return score;
  }

  // Find the top matching pages and return their content
  function searchDocs(query) {
    return getDocContent().then(function (content) {
      const queryWords = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      const pages = Object.keys(content);
      const scored = pages
        .map(function (p) {
          return { path: p, score: scorePage(p, content[p], queryWords) };
        })
        .filter(function (p) {
          return p.score > 0;
        })
        .sort(function (a, b) {
          return b.score - a.score;
        });
      if (scored.length === 0) {
        return {
          success: false,
          error: 'No matching page found for: ' + query,
          available_pages: pages,
        };
      }
      const top = scored.slice(0, 3);
      return {
        success: true,
        pages: top.map(function (p) {
          return {
            path: p.path,
            content: content[p.path].slice(0, 4000),
          };
        }),
      };
    });
  }

  // Handle tool calls from the AI
  document.addEventListener('ozwell-tool-call', function (e) {
    const name = e.detail.name;
    const args = e.detail.arguments;
    const respond = e.detail.respond;

    if (name === 'search_docs') {
      const query = extractQueryString(args && args.query);
      if (!query.trim()) {
        respond({ success: false, error: 'query parameter is required' });
        return;
      }
      searchDocs(query)
        .then(function (result) {
          respond(result);
        })
        .catch(function (err) {
          respond({ success: false, error: err.message });
        });
    } else {
      respond({ success: false, error: 'Unknown tool: ' + name });
    }
  });

  // Add tools and send page context when widget is ready
  window.addEventListener('ozwell:ready', function () {
    sendContext();
  });

  // Re-send context on Docusaurus SPA navigation
  window.addEventListener('popstate', sendContext);
  let lastPath = location.pathname;
  new MutationObserver(function () {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      sendContext();
    }
  }).observe(document.querySelector('title') || document.head, {
    subtree: true,
    characterData: true,
    childList: true,
  });

  // --- Key management ---
  const STORAGE_KEY = 'ozwell_api_key';

  function getStoredKey() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      return parsed.date === today ? parsed.key : null;
    } catch (e) {
      return null;
    }
  }

  function setStoredKey(key) {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ key: key, date: today })
    );
  }

  function clearStoredKey() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Hide the widget button until the key is validated — prevents a broken
  // button showing when the CDN loads with an empty/stale apiKey.
  const hideStyle = document.createElement('style');
  hideStyle.id = 'ozwell-hide-btn';
  hideStyle.textContent = '.ozwell-chat-button{display:none!important;}';
  document.head.appendChild(hideStyle);

  function showWidgetButton() {
    const s = document.getElementById('ozwell-hide-btn');
    if (s) s.remove();
  }

  function createSetupBubble() {
    if (document.getElementById('ozwell-setup-bubble')) return;

    // Floating bubble — sits in the same bottom-right spot Schemie would occupy.
    const bubble = document.createElement('button');
    bubble.id = 'ozwell-setup-bubble';
    bubble.title = 'Enable AI assistant';
    bubble.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:9999;width:56px;height:56px;border-radius:50%;' +
      'background:#2563eb;color:white;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.5);' +
      'display:flex;align-items:center;justify-content:center;';
    bubble.innerHTML =
      "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
      "<path stroke='none' d='M0 0h24v24H0z' fill='none'/>" +
      "<path d='M3 3l18 18'/>" +
      "<path d='M11 11a1 1 0 0 1 -1 -1m0 -3.968v-2.032a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10l-3 -3h-3'/>" +
      "<path d='M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2'/>" +
      '</svg>';

    // Setup card — hidden until bubble is clicked.
    const card = document.createElement('div');
    card.id = 'ozwell-setup-card';
    card.style.cssText =
      'display:none;position:fixed;bottom:88px;right:20px;z-index:9998;background:#fff;' +
      'border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 4px 16px rgba(0,0,0,.15);' +
      'width:280px;font-family:system-ui,sans-serif;font-size:14px;';

    bubble.onclick = function () {
      card.style.display = card.style.display === 'none' ? 'block' : 'none';
    };

    const title = document.createElement('p');
    title.style.cssText = 'margin:0 0 6px;color:#111827;font-weight:600;';
    title.textContent = '🔑 AI Assistant setup';

    const desc = document.createElement('p');
    desc.style.cssText =
      'margin:0 0 10px;color:#6b7280;font-size:12px;line-height:1.4;';
    desc.textContent =
      'Enter your Ozwell parent API key (ozw_…) to enable the AI chat widget.';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'ozw_...';
    input.style.cssText =
      'width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px;padding:6px 10px;font-size:13px;margin-bottom:8px;outline:none;font-family:inherit;';

    const errorMsg = document.createElement('p');
    errorMsg.style.cssText =
      'margin:0 0 8px;color:#ef4444;font-size:12px;display:none;';

    const btn = document.createElement('button');
    btn.textContent = 'Enable AI assistant';
    btn.style.cssText =
      'background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer;width:100%;font-family:inherit;';
    btn.onclick = function () {
      const key = input.value.trim();
      errorMsg.style.display = 'none';
      input.style.borderColor = '#d1d5db';

      if (!key.startsWith('ozw_')) {
        input.style.borderColor = '#ef4444';
        errorMsg.textContent = 'Key must start with ozw_';
        errorMsg.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Validating…';

      fetch('https://ozwellapi.os.mieweb.org/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      })
        .then(function (res) {
          if (res.status === 401 || res.status === 403)
            throw new Error('invalid');
          setStoredKey(key);
          location.reload();
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = 'Enable AI assistant';
          input.style.borderColor = '#ef4444';
          errorMsg.textContent =
            err.message === 'invalid'
              ? 'Invalid API key — not authorized.'
              : 'Could not reach Ozwell server. Check your connection.';
          errorMsg.style.display = 'block';
        });
    };

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(input);
    card.appendChild(errorMsg);
    card.appendChild(btn);
    document.body.appendChild(bubble);
    document.body.appendChild(card);
  }

  const storedKey = getStoredKey();
  if (storedKey) {
    // Validate stored key before revealing the widget button.
    fetch('https://ozwellapi.os.mieweb.org/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + storedKey,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    })
      .then(function (res) {
        if (res.status === 401 || res.status === 403)
          throw new Error('invalid');
        showWidgetButton();
      })
      .catch(function () {
        clearStoredKey();
        if (window.OzwellChatConfig) window.OzwellChatConfig.apiKey = '';
        createSetupBubble();
      });
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createSetupBubble);
    } else {
      createSetupBubble();
    }
  }

  window.ozwellResetKey = function () {
    clearStoredKey();
    location.reload();
  };
})();
