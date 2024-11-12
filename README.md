# Voice in Slides

A Chrome extension that adds text-to-speech functionality to Google Slides, allowing you to mark and read specific text using angle brackets.

## Features

- 🎯 Works directly in Google Slides
- 🗣️ Text-to-speech for bracketed content
- ⚡ Automatic speech when changing slides
- ⏱️ Adjustable speech rate (0.5x to 2x)
- 🎙️ Multiple voice options
- 💾 Persistent settings

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Open any Google Slides presentation
2. Add text you want to be read aloud between angle brackets:
   - Example: `<This text will be read aloud>`
3. Click the extension icon to:
   - Select your preferred voice
   - Adjust the speech rate
   - Use "Speak Slide" to read the current slide
   - Use "Stop Speaking" to halt speech

The extension will automatically read marked text when you change slides.

## How It Works

The extension uses the following components:

- **Content Script**: Monitors slide changes and extracts bracketed text
- **Popup Interface**: Provides user controls for voice settings
- **Settings Management**: Handles voice preferences and persistence

## Permissions

The extension requires:

- `activeTab`: To access the current slide content
- `storage`: To save user preferences
- Access to `https://docs.google.com/*` to function with Google Slides

## Technical Details

- Built using Manifest V3
- Uses the Web Speech API for text-to-speech functionality
- Supports both HTML-encoded (`&lt;`, `&gt;`) and regular angle brackets (`<`, `>`)
- Settings persist across browser sessions

## Contributing

Feel free to submit issues and pull requests to help improve the extension.

## License

Available under MIT License.
