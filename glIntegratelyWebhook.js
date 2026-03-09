/*
 * Attach Integrately webhook forwarding to a form submit event.
 *
 * @param {string} formID - The HTML id attribute of the form element.
 * @param {string} webhookURL - Integrately webhook endpoint URL.
 * @param {boolean} debug - Enable console logging for diagnostics.
 */
function glIntegratelyWebhookLogic(formID, webhookURL, debug = false) {
  if (typeof formID !== 'string' || formID.trim() === '') {
    if (debug) {
      console.warn('Integrately setup skipped: invalid formID.');
    }
    return;
  }

  if (typeof webhookURL !== 'string' || webhookURL.trim() === '') {
    if (debug) {
      console.warn('Integrately setup skipped: invalid webhookURL.');
    }
    return;
  }

  const formElem = document.getElementById(formID);
  if (!formElem) {
    if (debug) {
      console.warn('Integrately setup skipped: form not found for id:', formID);
    }
    return;
  }

  if (formElem.dataset.integratelyWebhookAttached === 'true') {
    if (debug) {
      console.log('Integrately listener already attached for form:', formID);
    }
    return;
  }

  const sendViaFetch = (formData) => {
    return fetch(webhookURL, {
      method: 'POST',
      body: formData,
      mode: 'no-cors',
      keepalive: true
    });
  };

  formElem.addEventListener('submit', () => {
    const formData = new FormData(formElem);

    // sendBeacon is more likely to complete during page unload/navigation.
    if (typeof navigator.sendBeacon === 'function') {
      const beaconSent = navigator.sendBeacon(webhookURL, formData);
      if (debug) {
        console.log(beaconSent
          ? 'Integrately webhook queued with sendBeacon.'
          : 'Integrately sendBeacon queue failed; falling back to fetch.');
      }

      if (!beaconSent) {
        sendViaFetch(formData).catch((error) => {
          if (debug) {
            console.error('Integrately webhook dispatch failed:', error);
          }
        });
      }
      return;
    }

    sendViaFetch(formData).catch((error) => {
      if (debug) {
        console.error('Integrately webhook dispatch failed:', error);
      }
    });
  });

  formElem.dataset.integratelyWebhookAttached = 'true';

  if (debug) {
    console.log('Integrately integration active for form:', formID);
  }
}
