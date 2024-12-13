// Utility function to stop speech synthesis
function stopSpeech() {
  if (window.speechSynthesis.speaking) {
    console.log('Stopping ongoing speech');
    window.speechSynthesis.cancel();
  } else {
    console.log('No speech to stop');
  }
}

// Initialize available voices
function initVoices() {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
    } else {
      speechSynthesis.onvoiceschanged = () => {
        resolve(speechSynthesis.getVoices());
      };
    }
  });
}

// Fix Chrome's timeout issue during long speech synthesis
function fixChromeTimeout() {
  if (speechSynthesis.speaking) {
    speechSynthesis.pause();
    speechSynthesis.resume();
    setTimeout(fixChromeTimeout, 10000);
  }
}

// Speak a given text using the SpeechSynthesis API
function speak(text) {
  if (!text || text.length === 0) {
    console.log('No text to speak, returning early');
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

    // Add event handlers for debugging
    utterance.onstart = () => console.log('Speech started:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    utterance.onend = () => {
      console.log('Speech ended successfully');
      chrome.runtime.sendMessage({ action: "speechEnd" });
    };
    utterance.onerror = (event) => {
      console.error('Speech error:', event.error);
      chrome.runtime.sendMessage({ action: "speechEnd" });
    };

    // Set the selected voice if available
    const voices = speechSynthesis.getVoices();
    if (settings.voiceURI) {
      const selectedVoice = voices.find(voice => voice.voiceURI === settings.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('Using voice:', selectedVoice.name);
      } else {
        console.warn('Selected voice not found:', settings.voiceURI);
      }
    }

    try {
      window.speechSynthesis.speak(utterance);
      console.log('Speech synthesis initiated');
      fixChromeTimeout();
    } catch (error) {
      console.error('Error initiating speech:', error);
    }
  });
}

// Handle messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  chrome.storage.local.get('speechSettings', (data) => {
    const settings = data.speechSettings || {};

    if (settings.enabled === false) return;

    if (request.action === "speak") {
      speak(getDelimitedText());
    } else if (request.action === "stop") {
      stopSpeech();
      sendResponse({ status: "Speech stopped" });
    }
  });
});

// Extract text from the current slide
function getDelimitedText() {
  const DELIMITERS_REGEX = /<([^>]+)>|&lt;([^&]+)&gt;/g;

  // Try multiple methods to find the current slide
  const hash = window.location.hash;
  const slideId = hash.match(/slide=id.([^&]+)/)?.[1];

  let currentSlide;

  if (slideId) {
    // Try finding the slide by editor ID first
    currentSlide = document.querySelector(`g[id="editor-${slideId}"]`);

    // If not found, try finding it by slide ID
    if (!currentSlide) {
      currentSlide = document.querySelector(`g[id="${slideId}"]`);
    }
  }

  // Fallback: try to find the currently visible slide
  if (!currentSlide) {
    currentSlide = document.querySelector('.punch-viewer-content:not([style*="display: none"]) g[id^="editor-"]') ||
      document.querySelector('.punch-viewer-content:not([style*="display: none"]) g[id^="slide-"]');
  }

  if (!currentSlide) {
    console.log('Current slide not found');
    return '';
  }

  const textElements = currentSlide.querySelectorAll('text, [font-family]');
  let textContent = Array.from(textElements)
    .map(element => element.textContent.trim())
    .filter(text => text.length > 0)
    .join(' ');

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

  return '';
}

// Observe URL changes to trigger speech synthesis
function observeUrlChange() {
  let oldHref = document.location.href;
  const body = document.querySelector('body');
  let lastSlideId = '';

  // Function to check for slide changes
  function checkSlideChange() {
    const hash = window.location.hash;
    const currentSlideId = hash.match(/slide=id.([^&]+)/)?.[1] || '';

    if (currentSlideId && currentSlideId !== lastSlideId) {
      lastSlideId = currentSlideId;
      handleNavigationChange();
    }
  }

  // Watch for hash changes
  window.addEventListener('hashchange', checkSlideChange);

  // Watch for DOM changes that might indicate slide changes
  const observer = new MutationObserver((mutations) => {
    if (oldHref !== document.location.href) {
      oldHref = document.location.href;
      checkSlideChange();
    }

    // Check if any mutation indicates a slide change
    const slideChanged = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => {
        return node.nodeType === 1 &&
          (node.matches?.('.punch-viewer-content') ||
            node.querySelector?.('.punch-viewer-content'));
      });
    });

    if (slideChanged) {
      checkSlideChange();
    }
  });

  observer.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  // History API interception
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function () {
    pushState.apply(history, arguments);
    checkSlideChange();
  };

  history.replaceState = function () {
    replaceState.apply(history, arguments);
    checkSlideChange();
  };

  window.addEventListener('popstate', checkSlideChange);

  // Clean up on page unload
  window.addEventListener('unload', () => {
    observer.disconnect();
    window.removeEventListener('hashchange', checkSlideChange);
  });

  // Initial check
  checkSlideChange();
}

// Handle navigation changes
function handleNavigationChange() {
  if (chrome.runtime && chrome.runtime.id) {
    stopSpeech();

    chrome.storage.local.get('speechSettings', (data) => {
      const settings = data.speechSettings || {};
      if (settings.enabled !== false) {
        const text = getDelimitedText();
        if (text) {
          speak(text);
        }
      }
    });
  }
}

// Initialize the observer on page load if extension context is valid
if (chrome.runtime && chrome.runtime.id) {
  window.onload = observeUrlChange;
}
