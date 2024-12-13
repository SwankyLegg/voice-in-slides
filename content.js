// Add this function near the top of the file
function stopSpeech() {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
};

function speak(text) {
  // If there's nothing to say, just leave the convo
  if (!text || text.length === 0) {
    return;
  }

  stopSpeech();
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  chrome.storage.local.get('speechSettings', (data) => {
    const settings = data.speechSettings || {};

    // Don't process commands if extension is explicitly disabled
    if (settings.enabled === false) {
      return;
    }

    if (request.action === "speak") {
      speak(getDelimitedText());
    } else if (request.action === "stop") {
      stopSpeech();
      sendResponse({ status: "Speech stopped" });
    }
  });
});

function getDelimitedText() {
  // Regex to match both HTML-encoded and regular angle brackets
  const DELIMITERS_REGEX = /<([^>]+)>|&lt;([^&]+)&gt;/g;

  // Get current slide ID from URL hash
  const hash = window.location.hash;
  const slideId = hash.match(/slide=id.([^&]+)/)?.[1];

  if (!slideId) {
    console.log('No slide ID found in URL');
    return;
  }

  // Get the current slide container
  const currentSlide = document.querySelector(`g[id="editor-${slideId}"]`);
  if (!currentSlide) {
    console.log('Current slide not found');
    return;
  }

  // Find all text elements within the slide
  const textElements = currentSlide.querySelectorAll('text, [font-family]');
  let textContent = Array.from(textElements)
    .map(element => element.textContent.trim())
    .filter(text => text.length > 0)
    .join(' ');

  // Process delimiters and only return text between them
  let speechText = '';
  const matches = textContent.match(DELIMITERS_REGEX);
  if (matches) {
    matches.forEach(match => {
      if (match.startsWith('&lt;')) {
        speechText += match.slice(4, -4) + ' ';
      } else {
        speechText += match.slice(1, -1) + ' ';
      }
    });
    return speechText.trim();
  }

  // If no delimiters found, return nothing
  return '';
}

function observeUrlChange() {
  let oldHref = document.location.href;
  const body = document.querySelector('body');
  const observer = new MutationObserver(mutations => {
    if (oldHref !== document.location.href) {
      oldHref = document.location.href;

      // Check if extension context is still valid
      if (chrome.runtime && chrome.runtime.id) {
        // Stop any ongoing speech first
        stopSpeech();

        chrome.storage.local.get('speechSettings', (data) => {
          const settings = data.speechSettings || {};
          if (settings.enabled !== false) {  // Default to enabled
            const text = getDelimitedText();
            if (text) {
              speak(text);
            }
          }
        });
      } else {
        // Extension context is invalid, clean up observer
        observer.disconnect();
        console.log('Extension context invalidated - observer disconnected');
      }
    }
  });
  observer.observe(body, { childList: true, subtree: true });
};

// Ensure extension context is valid before initializing
if (chrome.runtime && chrome.runtime.id) {
  window.onload = observeUrlChange();
}