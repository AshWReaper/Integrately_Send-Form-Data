/*
 * Attach Integrately webhook forwarding to a form submit event.
 *
 * @param {string} formID - The HTML id attribute of the form element.
 * @param {string} webhookURL - Integrately webhook endpoint URL.
 * @param {boolean|string} debug - false: silent, true: key logs, 'verbose': detailed logs.
 * @param {Object} options - Optional webhook-only field injection settings.
 * @param {boolean|string} options.injectTimestampField - true for default field name, or a custom field name.
 * @param {boolean|string} options.injectPageSourceField - true for default field name, or a custom field name.
 * @param {string} options.timestampFormat - Optional timestamp format: 'iso' (default) or 'human'.
 * @param {string} options.timestampLocale - Optional locale for human timestamp formatting (for example, 'en-ZA').
 * @param {boolean} options.preferPlaceholderFieldNames - Prefer placeholder-derived webhook field names for generic inputs.
 */
function glIntegratelyWebhookLogic(formID, webhookURL, debug = false, options = {}) {
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
  const normalizedOptions = options && typeof options === 'object' ? options : {};
  const resolveInjectedFieldName = (optionValue, defaultFieldName) => {
    if (optionValue === true) {
      return defaultFieldName;
    }
    if (typeof optionValue === 'string' && optionValue.trim() !== '') {
      return optionValue.trim();
    }
    return null;
  };
  const timestampFieldName = resolveInjectedFieldName(
    normalizedOptions.injectTimestampField,
    'integrately_timestamp'
  );
  const pageSourceFieldName = resolveInjectedFieldName(
    normalizedOptions.injectPageSourceField,
    'integrately_page_source'
  );
  const timestampFormat = normalizedOptions.timestampFormat === 'human' ? 'human' : 'iso';
  const timestampLocale = typeof normalizedOptions.timestampLocale === 'string' &&
    normalizedOptions.timestampLocale.trim() !== ''
    ? normalizedOptions.timestampLocale.trim()
    : undefined;
  const preferPlaceholderFieldNames = normalizedOptions.preferPlaceholderFieldNames === true;

  debugLog('Initialization started.');
  debugVerbose('Initialization details:', {
    formID,
    webhookConfigured: typeof webhookURL === 'string' && webhookURL.trim() !== '',
    timestampFieldName,
    pageSourceFieldName,
    timestampFormat,
    timestampLocale,
    preferPlaceholderFieldNames
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

  const cleanFieldKey = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  };

  const fieldKeyLooksGeneric = (value) => {
    if (!value) {
      return true;
    }
    return /^item\s+\d+$/i.test(value) ||
      /^item\[\d+\](?:\[\])?$/i.test(value) ||
      /^item(?:\[\d+\])+(?:\[\])?$/i.test(value) ||
      /^field(?:s)?\[\d+\](?:\[[^\]]*\])*$/i.test(value) ||
      /^field[_-]?\d+$/i.test(value) ||
      /^input[_-]?\d+$/i.test(value) ||
      /^\d+$/.test(value);
  };

  const sanitizeDerivedFieldKey = (value, separator = '_') => {
    const cleaned = cleanFieldKey(value)
      .replace(/\s+/g, ' ')
      .replace(/[^a-zA-Z0-9]+/g, separator)
      .replace(new RegExp(separator + '+', 'g'), separator)
      .replace(new RegExp('^' + separator + '+|' + separator + '+$', 'g'), '')
      .toLowerCase();
    return cleaned;
  };

  const getAssociatedLabelText = (control) => {
    if (!(control instanceof Element)) {
      return '';
    }

    if (control.id) {
      const explicitLabel = formElem.querySelector('label[for="' + control.id + '"]');
      if (explicitLabel) {
        return explicitLabel.textContent || '';
      }
    }

    const wrappedLabel = control.closest('label');
    if (wrappedLabel) {
      return wrappedLabel.textContent || '';
    }

    const nearbyLabel = control.closest('.form-group, .field, .form-field, .form-row');
    if (nearbyLabel) {
      const labelElem = nearbyLabel.querySelector('label');
      if (labelElem) {
        return labelElem.textContent || '';
      }
    }

    return '';
  };

  const deriveControlFieldKey = (control) => {
    if (!(control instanceof Element)) {
      return '';
    }

    const placeholder = sanitizeDerivedFieldKey(control.getAttribute('placeholder') || '', '-');
    if (preferPlaceholderFieldNames && placeholder) {
      return placeholder;
    }

    const labelText = sanitizeDerivedFieldKey(getAssociatedLabelText(control));
    if (labelText) {
      return labelText;
    }

    const ariaLabel = sanitizeDerivedFieldKey(control.getAttribute('aria-label') || '');
    if (ariaLabel) {
      return ariaLabel;
    }

    if (placeholder) {
      return preferPlaceholderFieldNames ? placeholder : sanitizeDerivedFieldKey(
        control.getAttribute('placeholder') || ''
      );
    }

    const nameAttr = sanitizeDerivedFieldKey(control.getAttribute('name') || '');
    if (nameAttr) {
      return nameAttr;
    }

    return sanitizeDerivedFieldKey(control.id || '');
  };

  const getDomDerivedEntries = () => {
    const entries = [];
    const controls = formElem.querySelectorAll('input, select, textarea');

    controls.forEach((control) => {
      if (!(control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement)) {
        return;
      }

      const tagName = control.tagName.toLowerCase();
      const inputType = tagName === 'input' ? (control.type || 'text').toLowerCase() : '';
      if (inputType === 'submit' ||
        inputType === 'button' ||
        inputType === 'reset' ||
        inputType === 'file' ||
        inputType === 'image') {
        return;
      }

      if ((inputType === 'checkbox' || inputType === 'radio') && !control.checked) {
        return;
      }

      const derivedKey = deriveControlFieldKey(control);
      if (!derivedKey) {
        return;
      }

      if (control instanceof HTMLSelectElement && control.multiple) {
        Array.from(control.selectedOptions).forEach((option) => {
          entries.push({
            key: derivedKey,
            value: option.value
          });
        });
        return;
      }

      entries.push({
        key: derivedKey,
        value: control.value
      });
    });

    return entries;
  };

  const cloneFormData = (sourceFormData) => {
    const clonedFormData = new FormData();
    for (const [key, value] of sourceFormData.entries()) {
      clonedFormData.append(key, value);
    }
    return clonedFormData;
  };

  const buildWebhookPayload = (sourceFormData, domDerivedEntries = getDomDerivedEntries()) => {
    const webhookFormData = new FormData();
    const skippedFields = [];
    const skippedUploadDetails = [];
    const injectedFields = [];
    const recoveredFieldMappings = [];
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

      const cleanedKey = cleanFieldKey(key);
      const fallbackEntry = domDerivedEntries[sourceFieldCount - 1];
      const resolvedKey = fieldKeyLooksGeneric(cleanedKey) && fallbackEntry && fallbackEntry.key
        ? fallbackEntry.key
        : cleanedKey;

      if (resolvedKey && resolvedKey !== cleanedKey) {
        recoveredFieldMappings.push({
          originalKey: cleanedKey || '(blank)',
          recoveredKey: resolvedKey
        });
      }

      if (!resolvedKey) {
        debugVerbose('Skipping field because no usable webhook key could be derived.', {
          originalKey: key,
          fieldIndex: sourceFieldCount
        });
        continue;
      }

      webhookFormData.append(resolvedKey, value);
    }

    if (timestampFieldName) {
      const now = new Date();
      const timestampValue = timestampFormat === 'human'
        ? now.toLocaleString(timestampLocale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZoneName: 'short'
        })
        : now.toISOString();
      webhookFormData.set(timestampFieldName, timestampValue);
      injectedFields.push(timestampFieldName);
      debugVerbose('Injected timestamp field.', {
        field: timestampFieldName,
        value: timestampValue,
        format: timestampFormat,
        locale: timestampLocale || '(browser default)'
      });
    }

    if (pageSourceFieldName) {
      const pageSourceValue = typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.href === 'string'
        ? window.location.href
        : '';
      webhookFormData.set(pageSourceFieldName, pageSourceValue);
      injectedFields.push(pageSourceFieldName);
      debugVerbose('Injected page source field.', {
        field: pageSourceFieldName,
        value: pageSourceValue
      });
    }

    let webhookFieldCount = 0;
    for (const _entry of webhookFormData.entries()) {
      webhookFieldCount += 1;
    }

    return {
      webhookFormData,
      skippedFields,
      skippedUploadDetails,
      injectedFields,
      recoveredFieldMappings,
      sourceFieldCount,
      webhookFieldCount
    };
  };

  let lastSubmitIntentTs = 0;
  let lastSubmitHandledTs = 0;
  let lastWebhookDispatchTs = 0;
  let lastIntentFormDataSnapshot = null;
  let lastIntentDomDerivedEntries = [];
  const SUBMIT_FLOW_TIMEOUT_MS = 2500;
  const WEBHOOK_DEDUP_WINDOW_MS = 1200;

  const trackSubmitIntent = (meta) => {
    lastSubmitIntentTs = Date.now();
    const currentIntentTs = lastSubmitIntentTs;
    lastIntentFormDataSnapshot = cloneFormData(new FormData(formElem));
    lastIntentDomDerivedEntries = getDomDerivedEntries();

    debugLog('Submit intent detected.');
    debugVerbose('Submit intent details:', meta);
    debugVerbose('Captured form snapshot for submit intent.', {
      capturedFieldCount: Array.from(lastIntentFormDataSnapshot.entries()).length
    });

    setTimeout(() => {
      const submitWasHandled = lastSubmitHandledTs >= currentIntentTs;
      const webhookAlreadyDispatched = lastWebhookDispatchTs >= currentIntentTs;
      if (submitWasHandled || webhookAlreadyDispatched) {
        return;
      }

      debugWarn(
        'Submit intent was detected, but no submit event fired shortly after. ' +
        'Applying AJAX compatibility fallback dispatch.'
      );

      if (typeof formElem.checkValidity === 'function' && !formElem.checkValidity()) {
        debugWarn('Fallback dispatch skipped because form is currently invalid.');
        return;
      }

      dispatchWebhookFromForm(
        { via: 'submit-intent-timeout-fallback', usesIntentSnapshot: true },
        lastIntentFormDataSnapshot,
        lastIntentDomDerivedEntries
      );
    }, SUBMIT_FLOW_TIMEOUT_MS);
  };

  const dispatchWebhookFromForm = (
    triggerMeta,
    sourceFormDataOverride = null,
    domDerivedEntriesOverride = null
  ) => {
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
      const sourceFormData = sourceFormDataOverride
        ? cloneFormData(sourceFormDataOverride)
        : new FormData(formElem);
      const domDerivedEntries = Array.isArray(domDerivedEntriesOverride)
        ? domDerivedEntriesOverride
        : getDomDerivedEntries();
      const {
        webhookFormData,
        skippedFields,
        skippedUploadDetails,
        injectedFields,
        recoveredFieldMappings,
        sourceFieldCount,
        webhookFieldCount
      } = buildWebhookPayload(sourceFormData, domDerivedEntries);

      debugLog('Payload prepared.');
      debugVerbose('Payload details:', {
        sourceFieldCount,
        webhookFieldCount,
        skippedUploadFieldCount: skippedFields.length
      });
      if (sourceFormDataOverride) {
        debugVerbose('Webhook payload used captured submit-intent snapshot.');
      }

      if (debugEnabled && skippedFields.length > 0) {
        debugLog('Skipped upload fields:', Array.from(new Set(skippedFields)));
        debugVerbose('Skipped upload details:', skippedUploadDetails);
      }
      if (debugEnabled && injectedFields.length > 0) {
        debugLog('Injected webhook-only fields:', injectedFields);
      }
      if (debugEnabled && recoveredFieldMappings.length > 0) {
        debugLog('Recovered readable field names for generic inputs.');
        debugVerbose('Recovered field mappings:', recoveredFieldMappings);
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
