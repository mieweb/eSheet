(function () {
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
})();
