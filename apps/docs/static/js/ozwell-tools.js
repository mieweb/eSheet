(function () {
  // Inject CSS overrides to match the eSheet docs site color scheme
  // and fix icon sizing/appearance.
  (function injectOzwellStyles() {
    // Use the Docusaurus CSS variable so it respects light/dark mode.
    var primary = getComputedStyle(document.documentElement).getPropertyValue('--ifm-color-primary').trim() || '#2563eb';
    var style = document.createElement('style');
    style.textContent =
      /* Match docs primary color instead of default #0066ff */
      '.ozwell-chat-button{background:var(--ifm-color-primary,#2563eb)!important;box-shadow:0 4px 16px color-mix(in srgb,var(--ifm-color-primary,#2563eb) 35%,transparent)!important;}' +
      '.ozwell-chat-button:hover{box-shadow:0 6px 20px color-mix(in srgb,var(--ifm-color-primary,#2563eb) 50%,transparent)!important;}' +
      '.ozwell-chat-header{background:var(--ifm-color-primary,#2563eb)!important;}' +
      /* Replace the broken /favicon.ico img with the eSheet SVG logo */
      '.ozwell-chat-icon{display:none!important;}' +
      ".ozwell-chat-button::after{content:'';display:block;width:32px;height:32px;background:url(\"data:image/svg+xml,%3Csvg width='512' height='512' viewBox='0 0 128 128' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='20' y='16' width='88' height='96' rx='14' stroke='white' stroke-width='8'/%3E%3Crect x='34' y='34' width='56' height='12' rx='6' fill='white'/%3E%3Crect x='34' y='58' width='40' height='12' rx='6' fill='white'/%3E%3Crect x='34' y='82' width='56' height='12' rx='6' fill='white'/%3E%3C/svg%3E\") center/contain no-repeat}";
    document.head.appendChild(style);

    // Inject brand colors into the widget iframe (Send button, user messages, input focus).
    // The iframe is same-origin (srcdoc + allow-same-origin) so we can access its document.
    document.addEventListener('ozwell-chat-ready', function () {
      var iframe = window.OzwellChat && window.OzwellChat.iframe;
      if (!iframe || !iframe.contentDocument) return;
      var s = iframe.contentDocument.createElement('style');
      s.textContent =
        '.chat-submit{background:' + primary + '!important}' +
        '.chat-submit:hover{background:color-mix(in srgb,' + primary + ' 85%,black)!important}' +
        '.message.user{background:' + primary + '!important}' +
        '.message.queued{color:' + primary + '!important;border-color:' + primary + '!important}' +
        '.chat-input:focus{border-color:' + primary + '!important;box-shadow:0 0 0 3px color-mix(in srgb,' + primary + ' 10%,transparent)!important}';
      iframe.contentDocument.head.appendChild(s);
    });
  })();

  // Load all doc content from the pre-built static bundle
  var docContentPromise = null;
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
      var attempt = val.query || val.text || val.search || val.keywords || val.q;
      if (attempt && typeof attempt === 'string') return attempt;
      // Last resort: first string-valued property that isn't a schema key
      var schemaKeys = { type: 1, description: 1, required: 1, properties: 1 };
      var keys = Object.keys(val);
      for (var i = 0; i < keys.length; i++) {
        if (!schemaKeys[keys[i]] && typeof val[keys[i]] === 'string') return val[keys[i]];
      }
    }
    return String(val || '');
  }

  // Score a page (path + content) against query words
  function scorePage(path, content, queryWords) {
    var pathLower = path.toLowerCase();
    var contentLower = (content || '').toLowerCase();
    var score = 0;
    for (var i = 0; i < queryWords.length; i++) {
      var word = queryWords[i];
      if (pathLower.indexOf(word) !== -1) score += 3; // path match is a strong signal
      if (contentLower.indexOf(word) !== -1) score += 1;
    }
    return score;
  }

  // Find the best matching page and return its content in one shot
  function searchDocs(query) {
    return getDocContent().then(function (content) {
      var queryWords = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      var pages = Object.keys(content);
      var bestPath = null;
      var bestScore = -1;
      for (var i = 0; i < pages.length; i++) {
        var s = scorePage(pages[i], content[pages[i]], queryWords);
        if (s > bestScore) { bestScore = s; bestPath = pages[i]; }
      }
      if (!bestPath || bestScore === 0) {
        return { success: false, error: 'No matching page found for: ' + query, available_pages: pages };
      }
      return { success: true, path: bestPath, content: content[bestPath].slice(0, 8000) };
    });
  }

  // Handle tool calls from the AI
  document.addEventListener('ozwell-tool-call', function (e) {
    var name = e.detail.name;
    var args = e.detail.arguments;
    var respond = e.detail.respond;

    if (name === 'search_docs') {
      var query = extractQueryString(args && args.query);
      if (!query.trim()) {
        respond({ success: false, error: 'query parameter is required' });
        return;
      }
      searchDocs(query)
        .then(function (result) { respond(result); })
        .catch(function (err) { respond({ success: false, error: err.message }); });
    } else {
      respond({ success: false, error: 'Unknown tool: ' + name });
    }
  });

  // Send page context when widget is ready
  window.addEventListener('ozwell:ready', sendContext);

  // Re-send context on Docusaurus SPA navigation
  window.addEventListener('popstate', sendContext);
  var lastPath = location.pathname;
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
})();
