# Integrately_Send-Form-Data

Lightweight browser JavaScript for forwarding HTML form submissions to an [Integrately](https://integrately.com/) webhook.

## What This Does
`glIntegratelyWebhookLogic(formID, webhookURL, debug)` attaches a submit handler to your form and sends submitted form data to Integrately.

It is designed to be simple to drop into existing websites where you can add a JavaScript file and a small init snippet.

## Files
- `glIntegratelyWebhook.js`: integration logic.
- `README.md`: usage and testing guide.

## Quick Start
### 1. Add the script file
Upload `glIntegratelyWebhook.js` to your site (for example, `inc/js/glIntegratelyWebhook.js`).

### 2. Include it in your page
```html
<script src="/inc/js/glIntegratelyWebhook.js"></script>
```

### 3. Initialize it
```html
<script>
  glIntegratelyWebhookLogic(
    'contact-form',
    'https://webhooks.integrately.com/a/webhooks/123456',
    true
  );
</script>
```

## Parameters
- `formID` (string): the `id` of the target `<form>` element.
- `webhookURL` (string): your Integrately webhook URL.
- `debug` (boolean, optional): prints diagnostics to console. Default is `false`.

## Behavior Notes
- The script does not block normal form submission.
- It prefers `navigator.sendBeacon(...)` for better reliability during page navigation.
- If `sendBeacon` cannot queue the request, it falls back to `fetch(..., { keepalive: true, mode: 'no-cors' })`.
- In `no-cors` mode, browser responses are opaque, so delivery cannot be confirmed from JavaScript.
- Duplicate listeners are prevented if initialization runs multiple times.

## Local Development
Check syntax:
```bash
node --check glIntegratelyWebhook.js
```

Serve a local test page:
```bash
python3 -m http.server 8080
```

## Manual Testing Checklist
1. Create a form with `id="contact-form"` and initialize using that same ID.
2. Submit test data and verify it appears in Integrately.
3. Test with `debug=true` and confirm console messages.
4. Test invalid inputs (wrong form ID, empty webhook URL) and confirm warnings.

## Troubleshooting
- No data in Integrately: confirm webhook URL is correct and active.
- No console output: set `debug` to `true`.
- Script not running: verify the JS file path and that the form exists when init runs.

## License
See [LICENSE](LICENSE).
