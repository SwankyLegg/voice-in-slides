chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "speak") {
    const text = getAllText();
    if (text) {
      speak(text);
    }
  } else if (request.action === "stop") {
    stop();
  }
});

function speak(text) {
  stop();
  chrome.storage.local.get('speechSettings', (data) => {
    const settings = data.speechSettings || {};
    const utterance = new SpeechSynthesisUtterance(text);

    // Apply settings
    utterance.rate = settings.rate || 1.0;
    utterance.pitch = settings.pitch || 1.0;
    utterance.volume = settings.volume || 1.0;

    // Set the selected voice if available
    if (settings.voiceURI) {
      const voices = speechSynthesis.getVoices();
      const selectedVoice = voices.find(voice => voice.voiceURI === settings.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onend = () => {
      chrome.runtime.sendMessage({ action: "speechEnd" });
    };

    window.speechSynthesis.speak(utterance);
  });
};

function stop() {
  window.speechSynthesis.cancel();
};

function getChildText(element) {
  let text = '';

  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent + ' ';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Recursively gather text for any nested elements, including <g>
      text += getChildText(node);
    }
  });

  return text;
}

function getAllText() {
  // Regex to match both HTML-encoded and regular angle brackets
  const DELIMITERS_REGEX = /<([^>]+)>|&lt;([^&]+)&gt;/g;
  let speechText = '';

  // Get current slide ID from URL hash
  const hash = window.location.hash;
  const slideId = hash.match(/slide=id.([^&]+)/)?.[1];

  if (!slideId) {
    console.log('No slide ID found in URL');
    return;
  }

  // Get text content from current slide
  const currentSlide = document.querySelector(`g[id="editor-${slideId}"]`);
  const textContent = currentSlide ? getChildText(currentSlide) : '';

  // Find all matches using the regex
  const matches = textContent.match(DELIMITERS_REGEX);
  if (matches) {
    matches.forEach(match => {
      // If it's HTML-encoded (&lt; &gt;)
      if (match.startsWith('&lt;')) {
        speechText += match.slice(4, -4) + ' ';
      }
      // If it's regular brackets (< >)
      else {
        speechText += match.slice(1, -1) + ' ';
      }
    });
  }

  return speechText.trim();
}

function observeUrlChange() {
  let oldHref = document.location.href;
  const body = document.querySelector('body');
  const observer = new MutationObserver(mutations => {
    if (oldHref !== document.location.href) {
      oldHref = document.location.href;
      speak(getAllText());
    }
  });
  observer.observe(body, { childList: true, subtree: true });
};

window.onload = observeUrlChange();