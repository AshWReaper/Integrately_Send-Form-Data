# Integrately_Send-Form-Data

Lightweight browser JavaScript for forwarding HTML form submissions to an [Integrately](https://integrately.com/) webhook.

## What This Does
`glIntegratelyWebhookLogic(formID, webhookURL, debug, options)` attaches a submit handler to your form and sends submitted form data to Integrately.

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
  document.addEventListener('DOMContentLoaded', function() {
    glIntegratelyWebhookLogic(
      'contact-form',
      'https://webhooks.integrately.com/a/webhooks/123456',
      false,
      {
        injectTimestampField: 'submitted_at', // or true for default field name
        injectPageSourceField: 'page_source_url', // or true for default field name
        timestampFormat: 'human', // 'iso' (default) or 'human'
        timestampLocale: 'en-ZA', // optional; used when timestampFormat is 'human'
        preferPlaceholderFieldNames: true
      }
    );
  });
</script>
```

## Parameters
- `formID` (string): the `id` of the target `<form>` element.
- `webhookURL` (string): your Integrately webhook URL.
- `debug` (boolean|string, optional): `false` = no logs (recommended for production), `true` = key lifecycle logs, `'verbose'` = detailed diagnostic logs.
- `options` (object, optional): webhook-only field injection settings.
- `options.injectTimestampField` (boolean|string, optional): injects submit timestamp. Use `true` for default field name `integrately_timestamp`, or pass a custom field name string.
- `options.injectPageSourceField` (boolean|string, optional): injects current page URL. Use `true` for default field name `integrately_page_source`, or pass a custom field name string.
- `options.timestampFormat` (string, optional): `'iso'` (default) or `'human'` for a human-readable timestamp string.
- `options.timestampLocale` (string, optional): locale used when `timestampFormat` is `'human'` (for example, `'en-ZA'`).
- `options.preferPlaceholderFieldNames` (boolean, optional): for generic inputs like `item[1]`, prefer placeholder text as the recovered webhook field name, converted to lowercase hyphenated format.

## Behavior Notes
- The script does not block normal form submission.
- Compatible with flows that call `event.preventDefault()` and then submit programmatically via `form.submit()` or `form.requestSubmit()`.
- Compatible with AJAX themes that intercept submit-button clicks and never fire a native `submit` event (intent-timeout fallback).
- For AJAX themes that clear or reset the form immediately after submit, the script snapshots entered values at click time and can use that snapshot for webhook dispatch.
- When a theme emits blank or generic field names, the script attempts to recover readable webhook field names from labels, placeholders, IDs, or control names.
- For array-style field names such as `item[1]`, enable `preferPlaceholderFieldNames: true` if you want webhook keys like `your-name` and `contact-number`.
- File upload fields (`<input type="file">`) are intentionally excluded from the Integrately webhook payload.
- Optional injected fields (timestamp/page URL) are added to the Integrately webhook payload only, not the normal email/server form flow.
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
3. Test with `debug=true` for concise logs, then `debug='verbose'` for deep diagnostics.
4. Test invalid inputs (wrong form ID, empty webhook URL) and confirm warnings.

## Troubleshooting
- No data in Integrately: confirm webhook URL is correct and active.
- No console output: set `debug` to `true` (or `'verbose'` for deep diagnostics).
- Script not running: verify the JS file path and that the form exists when init runs.

## License
See [LICENSE](LICENSE).
