/*
* This function needs to be improved, and comments to explain how to use it
* need to be added here.
*/

function glIntegratelyWebhookLogic(formID, webhookURL, debug=false){
  if (formID.length > 0){
	  if (debug) { console.log('Integrately integration active...'); };
		const formElem = document.getElementById(formID);
		if (formElem) {
		  formElem.addEventListener('submit', function(event) {
			  const formData = new FormData(formElem);
			  fetch(webhookURL, {
				  method: 'POST',
				  body: formData,
				  mode: 'no-cors'
			  })
				.then(() => console.log("Data sent to Integrately successfully."))
				.catch(error => console.error("Integrately sync failed:", error));
			});
	  }
  }
}
