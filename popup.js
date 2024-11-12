let settings = {
  voiceURI: '',
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
  startDelimiter: '<',
  endDelimiter: '>',
};

function saveSettings() {
  chrome.storage.local.set({ speechSettings: settings });
}

// Load saved settings
chrome.storage.local.get('speechSettings', (data) => {
  if (data.speechSettings) {
    settings = { ...settings, ...data.speechSettings };
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
  document.getElementById('startDelimiter').value = settings.startDelimiter;
  document.getElementById('endDelimiter').value = settings.endDelimiter;
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

document.getElementById('startDelimiter').addEventListener('change', (e) => {
  settings.startDelimiter = e.target.value || '<';
  saveSettings();
});

document.getElementById('endDelimiter').addEventListener('change', (e) => {
  settings.endDelimiter = e.target.value || '>';
  saveSettings();
});