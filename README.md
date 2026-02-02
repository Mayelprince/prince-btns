# Prince Buttons

WhatsApp Interactive Buttons for Baileys - Enables buttons, lists, and interactive messages in WhatsApp bots.

## Installation

```bash
npm install prince-buttons
```

Or install from GitHub:
```bash
npm install github:your-username/prince-buttons
```

## Usage

### Setup

```javascript
const { default: makeWASocket } = require('@whiskeysockets/baileys');
const { patchBaileysSocket, createButton, createSection } = require('prince-btns');

// Create your socket
const sock = makeWASocket({ /* your config */ });

// Patch the socket to add button methods
patchBaileysSocket(sock);
```

### Send Buttons

```javascript
// Create buttons
const buttons = [
    createButton('reply', 'Click Me', '.menu'),
    createButton('url', 'Visit Website', 'https://example.com'),
    createButton('call', 'Call Us', '+1234567890'),
    createButton('copy', 'Copy Code', 'PROMO2024')
];

// Send buttons
await sock.sendButtonMessage(jid, buttons, quotedMessage, {
    header: 'Welcome!',
    body: 'Choose an option below:',
    footer: 'Bot Name'
});
```

### Send Buttons with Image

```javascript
await sock.sendButtonMessage(jid, buttons, quotedMessage, {
    header: 'Image Header',
    body: 'Message with image',
    footer: 'Footer text',
    image: 'https://example.com/image.jpg'
});
```

### Send List Menu

```javascript
const sections = [
    createSection('Main Menu', [
        { title: 'Option 1', description: 'First option', id: '.opt1' },
        { title: 'Option 2', description: 'Second option', id: '.opt2' }
    ]),
    createSection('Settings', [
        { title: 'Help', description: 'Get help', id: '.help' },
        { title: 'About', description: 'About bot', id: '.about' }
    ])
];

await sock.sendListMessage(jid, sections, quotedMessage, {
    header: 'Menu',
    body: 'Select an option:',
    footer: 'Bot Name',
    buttonText: 'Open Menu'
});
```

## Button Types

| Type | Description | Data Parameter |
|------|-------------|----------------|
| `reply` | Quick reply button | Command ID (e.g., `.menu`) |
| `url` | Opens URL | Full URL |
| `call` | Phone call button | Phone number |
| `copy` | Copy to clipboard | Text to copy |

## API Reference

### patchBaileysSocket(sock)
Patches a Baileys socket to add button methods.

### createButton(type, text, data)
Creates a button object.
- `type`: 'reply', 'url', 'call', or 'copy'
- `text`: Button display text
- `data`: Button action data

### createSection(title, rows)
Creates a list section.
- `title`: Section title
- `rows`: Array of row objects with title, description, and id

### sock.sendButtonMessage(jid, buttons, quoted, opts)
Sends interactive buttons.
- `opts.header`: Header text
- `opts.body`: Body text
- `opts.footer`: Footer text
- `opts.image`: Image URL (optional)
- `opts.video`: Video URL (optional)

### sock.sendListMessage(jid, sections, quoted, opts)
Sends a list/menu message.
- `opts.header`: Header text
- `opts.body`: Body text
- `opts.footer`: Footer text
- `opts.buttonText`: Button text to open menu

## License

MIT
