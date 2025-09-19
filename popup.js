const outputEl = document.getElementById('output');
const btn = document.getElementById('summarizeBtn');

btn.addEventListener('click', async () => {
  outputEl.textContent = 'Summarizing...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab found.');

    // Inject a small script into the page to extract readable text
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // prefer selected text, then article tag, then body
        const sel = window.getSelection().toString();
        if (sel && sel.trim().length > 20) return sel;
        const article = document.querySelector('article');
        const text = (article ? article.innerText : document.body.innerText) || '';
        return text.slice(0, 300000); // limit
      }
    });

    const pageText = results?.[0]?.result || '';
    if (!pageText || pageText.trim().length < 20) {
      outputEl.textContent = 'No readable text found on this page.';
      return;
    }

    let summary = '';

    // Try built-in Chrome AI (if available). If not, fallback to a simple local summary.
    try {
      if (chrome.ai && typeof chrome.ai.summarize === 'function') {
        const resp = await chrome.ai.summarize({ text: pageText });
        summary = resp?.summary || resp?.result || '';
      }
    } catch (e) {
      console.warn('Built-in AI call failed or not available:', e);
    }

    // Fallback: very simple extractive summary (first few sentences)
    if (!summary) {
      const sentences = pageText.match(/[^\.!\?]+[\.!\?]+/g) || [];
      summary = sentences.slice(0, 3).join(' ').trim();
      if (!summary) summary = pageText.slice(0, 600) + (pageText.length > 600 ? '...' : '');
    }

    outputEl.textContent = summary;
  } catch (err) {
    console.error(err);
    outputEl.textContent = 'Error: ' + (err.message || err);
  }
});
