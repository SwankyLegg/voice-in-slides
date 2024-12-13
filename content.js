// Utility function to stop speech synthesis
function stopSpeech() {
  return new Promise((resolve) => {
    if (window.speechSynthesis.speaking) {
      console.log('Stopping ongoing speech');
      window.speechSynthesis.cancel();
      // Small delay to ensure speech is fully stopped
      setTimeout(() => {
        resolve();
      }, 50);
    } else {
      console.log('No speech to stop');
      resolve();
    }
  });
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
    setTimeout(fixChromeTimeout, 5000);
  }
}

// Speak a given text using the SpeechSynthesis API
async function speak(text) {
  console.log('speak(', text, ')');
  if (!text || text.length === 0) {
    console.log('No text to speak, returning early');
    return;
  }

  // Wait for previous speech to stop completely
  await stopSpeech();

  chrome.storage.local.get('speechSettings', (data) => {
    const settings = data.speechSettings || {};
    const utterance = new SpeechSynthesisUtterance(text);

    // Apply settings
    utterance.rate = settings.rate || 1.0;
    utterance.pitch = settings.pitch || 1.0;
    utterance.volume = settings.volume || 1.0;

    // Add event handlers for debugging
    utterance.onstart = () => console.log('Speech started:', text.substring(0, 50) + (text.length > 49 ? '...' : ''));
    utterance.onend = () => {
      console.log('Speech ended successfully');
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ action: "speechEnd" }).catch(error => {
          console.log('Error sending speechEnd message:', error);
        });
      } else {
        console.log('No extension context, skipping speechEnd message');
      }
    };
    utterance.onerror = (event) => {
      console.error('Speech error:', event.error);
      // Only send speechEnd if it's not an interrupted error (as that means new speech is starting)
      if (event.error !== 'interrupted' && chrome.runtime?.id) {
        chrome.runtime.sendMessage({ action: "speechEnd" }).catch(error => {
          console.log('Error sending speechEnd message:', error);
        });
      } else {
        console.log('No extension context, skipping interrupted message');
      }
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

  const hash = window.location.hash;
  const slideId = hash.match(/slide=id.([^&]+)/)?.[1];

  if (!slideId) {
    console.log('No slide ID found in URL');
    return;
  }

  const currentSlide = document.querySelector(`g[id="editor-${slideId}"]`);
  if (!currentSlide) {
    console.log('Current slide not found');
    return;
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
  console.log('observeUrlChange(', oldHref, ')');

  const checkUrlChange = () => {
    if (oldHref !== document.location.href) {
      console.log('checkUrlChange(', oldHref, ')');
      oldHref = document.location.href;

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
      } else {
        console.log('Extension context invalidated - observer disconnected');
      }
    }
  };

  // Handle direct URL changes
  window.addEventListener('hashchange', checkUrlChange);
  window.addEventListener('popstate', checkUrlChange);

  // Observe dynamic DOM changes
  const body = document.querySelector('body');
  const observer = new MutationObserver(() => {
    console.log('MutationObserver triggered');
    checkUrlChange();
  });
  observer.observe(body, { childList: true, subtree: true });

  // Cleanup on page unload
  window.addEventListener('unload', () => {
    observer.disconnect();
    window.removeEventListener('hashchange', checkUrlChange);
    window.removeEventListener('popstate', checkUrlChange);
  });
}

// Initialize the observer on page load if extension context is valid
if (chrome.runtime && chrome.runtime.id) {
  window.onload = observeUrlChange;
}