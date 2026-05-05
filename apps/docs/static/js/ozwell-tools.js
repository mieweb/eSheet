(function () {
  // Inject CSS overrides to match the eSheet docs site color scheme
  // and fix icon sizing/appearance.
  (function injectOzwellStyles() {
    var style = document.createElement('style');
    style.textContent =
      /* Match docs primary blue (#2563eb) instead of default #0066ff */
      '.ozwell-chat-button{background:#2563eb!important;box-shadow:0 4px 16px rgba(37,99,235,.35)!important;}' +
      '.ozwell-chat-button:hover{box-shadow:0 6px 20px rgba(37,99,235,.5)!important;}' +
      '.ozwell-chat-header{background:#2563eb!important;}' +
      /* Replace the broken /favicon.ico img with the eSheet SVG logo */
      '.ozwell-chat-icon{display:none!important;}' +
      '.ozwell-chat-button::after{content:"";display:block;width:32px;height:32px;background:url("/img/esheet-logo.svg") center/contain no-repeat;filter:brightness(0) invert(1);}';
    document.head.appendChild(style);
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
