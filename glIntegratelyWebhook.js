/*
 * Attach Integrately webhook forwarding to a form submit event.
 *
 * @param {string} formID - The HTML id attribute of the form element.
 * @param {string} webhookURL - Integrately webhook endpoint URL.
 * @param {boolean|string} debug - false: silent, true: key logs, 'verbose': detailed logs.
 */
function glIntegratelyWebhookLogic(formID, webhookURL, debug = false) {
  const LOG_PREFIX = '[IntegratelyWebhook]';
  const debugEnabled = Boolean(debug);
  const verboseDebug = debug === 'verbose';
  const debugLog = (...args) => {
    if (debugEnabled) {
      console.log(LOG_PREFIX, ...args);
    }
  };
  const debugWarn = (...args) => {
    if (debugEnabled) {
      console.warn(LOG_PREFIX, ...args);
    }
  };
  const debugError = (...args) => {
    if (debugEnabled) {
      console.error(LOG_PREFIX, ...args);
    }
  };
  const debugVerbose = (...args) => {
    if (debugEnabled && verboseDebug) {
      console.log(LOG_PREFIX, ...args);
    }
  };

  debugLog('Initialization started.');
  debugVerbose('Initialization details:', {
    formID,
    webhookConfigured: typeof webhookURL === 'string' && webhookURL.trim() !== ''
  });

  if (typeof formID !== 'string' || formID.trim() === '') {
    debugWarn('Setup skipped: invalid formID.');
    return;
  }

  if (typeof webhookURL !== 'string' || webhookURL.trim() === '') {
    debugWarn('Setup skipped: invalid webhookURL.');
    return;
  }

  const formElem = document.getElementById(formID);
  if (!formElem) {
    debugWarn('Setup skipped: form not found for id:', formID);
    return;
  }

  debugLog('Form element found.');
  debugVerbose('Form details:', {
    tagName: formElem.tagName,
    method: formElem.method,
    action: formElem.action,
    submitButtons: formElem.querySelectorAll('button[type="submit"], input[type="submit"]').length
  });

  if (formElem.dataset.integratelyWebhookAttached === 'true') {
    debugLog('Listener already attached for form:', formID);
    return;
  }

  const sendViaFetch = (formData) => {
    debugVerbose('Dispatching webhook via fetch fallback.');
    return fetch(webhookURL, {
      method: 'POST',
      body: formData,
      mode: 'no-cors',
      keepalive: true
    });
  };

  const buildWebhookPayload = (sourceFormData) => {
    const webhookFormData = new FormData();
    const skippedFields = [];
    const skippedUploadDetails = [];
    const hasFileCtor = typeof File !== 'undefined';
    const hasBlobCtor = typeof Blob !== 'undefined';
    let sourceFieldCount = 0;

    for (const [key, value] of sourceFormData.entries()) {
      sourceFieldCount += 1;
      const isFile = hasFileCtor && value instanceof File;
      const isBlob = hasBlobCtor && value instanceof Blob;

      if (isFile || isBlob) {
        skippedFields.push(key);
        skippedUploadDetails.push({
          field: key,
          fileName: isFile ? value.name : '(blob)',
          size: typeof value.size === 'number' ? value.size : null,
          type: value.type || '(unknown)'
        });
        continue;
      }

      webhookFormData.append(key, value);
    }

    let webhookFieldCount = 0;
    for (const _entry of webhookFormData.entries()) {
      webhookFieldCount += 1;
    }

    return {
      webhookFormData,
      skippedFields,
      skippedUploadDetails,
      sourceFieldCount,
      webhookFieldCount
    };
  };

  let lastSubmitIntentTs = 0;
  let lastSubmitHandledTs = 0;
  let lastWebhookDispatchTs = 0;
  const SUBMIT_FLOW_TIMEOUT_MS = 2500;
  const WEBHOOK_DEDUP_WINDOW_MS = 1200;

  const trackSubmitIntent = (meta) => {
    lastSubmitIntentTs = Date.now();
    const currentIntentTs = lastSubmitIntentTs;
    debugLog('Submit intent detected.');
    debugVerbose('Submit intent details:', meta);

    setTimeout(() => {
      if (lastSubmitHandledTs < currentIntentTs) {
        debugWarn(
          'Submit intent was detected, but no submit event fired shortly after. ' +
          'Possible causes: blocked HTML validation, custom AJAX handler, or programmatic form.submit().'
        );
      }
    }, SUBMIT_FLOW_TIMEOUT_MS);
  };

  const dispatchWebhookFromForm = (triggerMeta) => {
    const now = Date.now();
    if (now - lastWebhookDispatchTs < WEBHOOK_DEDUP_WINDOW_MS) {
      debugVerbose('Skipping duplicate webhook dispatch.', {
        triggerMeta,
        dedupWindowMs: WEBHOOK_DEDUP_WINDOW_MS
      });
      return;
    }
    lastWebhookDispatchTs = now;

    debugLog('Starting webhook dispatch.');
    debugVerbose('Webhook trigger details:', triggerMeta);

    try {
      const sourceFormData = new FormData(formElem);
      const {
        webhookFormData,
        skippedFields,
        skippedUploadDetails,
        sourceFieldCount,
        webhookFieldCount
      } = buildWebhookPayload(sourceFormData);

      debugLog('Payload prepared.');
      debugVerbose('Payload details:', {
        sourceFieldCount,
        webhookFieldCount,
        skippedUploadFieldCount: skippedFields.length
      });

      if (debugEnabled && skippedFields.length > 0) {
        debugLog('Skipped upload fields:', Array.from(new Set(skippedFields)));
        debugVerbose('Skipped upload details:', skippedUploadDetails);
      }

      if (webhookFieldCount === 0) {
        debugWarn('Webhook payload has no non-file fields. Skipping webhook dispatch.');
        return;
      }

      // sendBeacon is more likely to complete during page unload/navigation.
      if (typeof navigator.sendBeacon === 'function') {
        const beaconSent = navigator.sendBeacon(webhookURL, webhookFormData);
        debugLog(beaconSent
          ? 'Webhook queued with sendBeacon (delivery not directly confirmable).'
          : 'sendBeacon queue failed; falling back to fetch.');

        if (!beaconSent) {
          sendViaFetch(webhookFormData)
            .then(() => {
              debugLog('Fetch fallback request completed (no-cors response is opaque).');
            })
            .catch((error) => {
              debugError('Webhook dispatch failed:', error);
            });
        }
        return;
      }

      debugLog('sendBeacon is unavailable in this browser; using fetch fallback.');
      sendViaFetch(webhookFormData)
        .then(() => {
          debugLog('Fetch request completed (no-cors response is opaque).');
        })
        .catch((error) => {
          debugError('Webhook dispatch failed:', error);
        });
    } catch (error) {
      debugError('Unexpected error during webhook dispatch:', error);
    }
  };

  const nativeSubmit = typeof formElem.submit === 'function' ? formElem.submit.bind(formElem) : null;
  if (nativeSubmit) {
    try {
      formElem.submit = function patchedSubmit() {
        debugLog('Programmatic form.submit() detected.');
        dispatchWebhookFromForm({ via: 'programmatic-submit' });
        nativeSubmit();
      };
      debugVerbose('Programmatic submit hook attached.');
    } catch (error) {
      debugWarn('Unable to attach programmatic submit hook:', error);
    }
  }

  const nativeRequestSubmit = typeof formElem.requestSubmit === 'function'
    ? formElem.requestSubmit.bind(formElem)
    : null;
  if (nativeRequestSubmit) {
    try {
      formElem.requestSubmit = function patchedRequestSubmit(submitter) {
        debugLog('Programmatic form.requestSubmit() detected.');
        dispatchWebhookFromForm({ via: 'programmatic-requestSubmit' });
        nativeRequestSubmit(submitter);
      };
      debugVerbose('Programmatic requestSubmit hook attached.');
    } catch (error) {
      debugWarn('Unable to attach programmatic requestSubmit hook:', error);
    }
  }

  formElem.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const control = target.closest('button, input');
    if (!(control instanceof Element)) {
      return;
    }

    const isButton = control.tagName === 'BUTTON';
    const typeAttr = (control.getAttribute('type') || (isButton ? 'submit' : '')).toLowerCase();
    const isSubmitControl = (isButton && (typeAttr === '' || typeAttr === 'submit')) ||
      (control.tagName === 'INPUT' && typeAttr === 'submit');

    if (!isSubmitControl) {
      return;
    }

    trackSubmitIntent({
      via: 'click',
      controlTag: control.tagName,
      controlType: typeAttr || '(default)',
      controlId: control.id || null,
      controlName: control.getAttribute('name') || null
    });
  }, true);

  formElem.addEventListener('invalid', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    debugWarn('Field failed HTML validation.', {
      fieldName: target.getAttribute('name') || null,
      fieldId: target.id || null,
      validationMessage: typeof target.validationMessage === 'string'
        ? target.validationMessage
        : '(no message)'
    });
  }, true);

  formElem.addEventListener('submit', (event) => {
    lastSubmitHandledTs = Date.now();

    const submitter = event.submitter instanceof Element ? event.submitter : null;
    debugLog('Submit event captured.');
    debugVerbose('Submit event details:', {
      defaultPrevented: event.defaultPrevented,
      submitterTag: submitter ? submitter.tagName : null,
      submitterId: submitter && 'id' in submitter ? submitter.id || null : null,
      submitterName: submitter ? submitter.getAttribute('name') || null : null
    });

    dispatchWebhookFromForm({ via: 'submit-event' });
  }, true);

  formElem.dataset.integratelyWebhookAttached = 'true';

  debugLog('Integration active for form:', formID);
  debugLog('Submit listener attached and ready.');
  if (debugEnabled && !verboseDebug) {
    debugLog('Tip: use debug = "verbose" for detailed diagnostics.');
  }
}
