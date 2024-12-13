let settings = {
  voiceURI: '',
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
  startDelimiter: '<',
  endDelimiter: '>',
  enabled: true,
};

function saveSettings() {
  chrome.storage.local.set({ speechSettings: settings });
}

// Load saved settings
chrome.storage.local.get('speechSettings', (data) => {
  if (data.speechSettings) {
    settings = {
      ...settings,
      ...data.speechSettings,
      enabled: data.speechSettings.enabled ?? true
    };
  }
  initializeControls();
});

function initializeControls() {
  // Initialize voice selector
  const voiceSelect = document.getElementById('voice');
  function loadVoices() {
    voiceSelect.innerHTML = '';
    speechSynthesis.getVoices().forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} (${voice.lang})`;
      option.selected = voice.voiceURI === settings.voiceURI;
      voiceSelect.appendChild(option);
    });
  }
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;

  // Initialize rate slider
  const rateInput = document.getElementById('rate');
  const rateValue = document.getElementById('rateValue');
  rateInput.value = settings.rate;
  rateValue.textContent = settings.rate + 'x';

  // Initialize delimiters
  // document.getElementById('startDelimiter').value = settings.startDelimiter;
  // document.getElementById('endDelimiter').value = settings.endDelimiter;

  // Initialize enabled switch
  document.getElementById('enabled').checked = settings.enabled;
}

// Event Listeners
document.getElementById('voice').addEventListener('change', (e) => {
  settings.voiceURI = e.target.value;
  saveSettings();
});

document.getElementById('rate').addEventListener('input', (e) => {
  settings.rate = parseFloat(e.target.value);
  document.getElementById('rateValue').textContent = settings.rate + 'x';
  saveSettings();
});

// document.getElementById('startDelimiter').addEventListener('change', (e) => {
//   settings.startDelimiter = e.target.value || '<';
//   saveSettings();
// });

// document.getElementById('endDelimiter').addEventListener('change', (e) => {
//   settings.endDelimiter = e.target.value || '>';
//   saveSettings();
// });

let isPlaying = false;

function resetButton() {
  const button = document.getElementById('speech-toggle');
  button.textContent = "Speak";
  button.style.backgroundColor = "#4285f4";
  isPlaying = false;
}

// Add message listener to handle speech end
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "speechEnd") {
    resetButton();
  }
});

document.getElementById('speech-toggle').addEventListener('click', async () => {
  const button = document.getElementById('speech-toggle');

  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!isPlaying) {
    // Start speaking
    chrome.tabs.sendMessage(tab.id, { action: "speak" });
    button.textContent = "Stop";
    button.style.backgroundColor = "#db4437";
    isPlaying = true;
  } else {
    // Stop speaking
    chrome.tabs.sendMessage(tab.id, { action: "stop" });
    resetButton();
  }
});

document.getElementById('enabled').addEventListener('change', saveSettings);