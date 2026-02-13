//= require solidus_braintree/constants
/**
 * Constructor for Google Pay button object
 * @constructor
 * @param {object} element - The DOM element of your Google Pay button
 * @param {object} googlePayOptions - Configuration options for Google Pay
 */
SolidusBraintree.GooglePayButton = function(element, googlePayOptions) {
  this._element = element;
  this._googlePayOptions = googlePayOptions || {};
  this._client = null;
  this._paymentsClient = null;

  if(!this._element) {
    throw new Error("Element for the Google Pay button must be present on the page");
  }
};

/**
 * Creates the Google Pay session using the provided options and enables the button
 *
 * See {@link https://braintree.github.io/braintree-web/current/module-braintree-web_google-payment.html}
 */
SolidusBraintree.GooglePayButton.prototype.initialize = function() {
  if (typeof google === 'undefined' || typeof google.payments === 'undefined') {
    console.warn('Google Pay JS SDK not loaded');
    return;
  }

  this._client = new SolidusBraintree.createClient({
    useDataCollector: false,
    useGooglePay: true,
    googlePayMerchantId: this._googlePayOptions.googleMerchantId,
    paymentMethodId: this._googlePayOptions.paymentMethodId
  });

  return this._client.initialize().then(this.initializeCallback.bind(this));
};

SolidusBraintree.GooglePayButton.prototype.initializeCallback = function() {
  this._paymentMethodId = this._client.paymentMethodId;
  this._googlePaymentInstance = this._client.getGooglePayInstance();

  var environment = this._googlePayOptions.environment || 'TEST';
  this._paymentsClient = new google.payments.api.PaymentsClient({
    environment: environment
  });

  var paymentDataRequest = this._googlePaymentInstance.createPaymentDataRequest({
    transactionInfo: {
      currencyCode: this._googlePayOptions.currency,
      totalPriceStatus: 'FINAL',
      totalPrice: this._googlePayOptions.amount
    }
  });

  // Check if the browser and user support Google Pay
  this._paymentsClient.isReadyToPay({
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: paymentDataRequest.allowedPaymentMethods
  }).then(function(response) {
    if (response.result) {
      this._showButton();
    }
  }.bind(this)).catch(function(err) {
    console.error('Error checking Google Pay readiness:', err);
  });
};

/**
 * Shows the Google Pay button and attaches the click handler
 */
SolidusBraintree.GooglePayButton.prototype._showButton = function() {
  // Use Google's official button rendering if available
  var googleButton = this._paymentsClient.createButton({
    onClick: this._initiatePayment.bind(this),
    buttonColor: this._googlePayOptions.buttonColor || 'black',
    buttonType: this._googlePayOptions.buttonType || 'pay',
    buttonSizeMode: 'fill'
  });

  this._element.appendChild(googleButton);
  this._element.classList.add('visible');
};

/**
 * Initiates the Google Pay payment flow
 */
SolidusBraintree.GooglePayButton.prototype._initiatePayment = function() {
  var paymentDataRequest = this._googlePaymentInstance.createPaymentDataRequest({
    transactionInfo: {
      currencyCode: this._googlePayOptions.currency,
      totalPriceStatus: 'FINAL',
      totalPrice: this._googlePayOptions.amount
    }
  });

  this._paymentsClient.loadPaymentData(paymentDataRequest)
    .then(function(paymentData) {
      return this._googlePaymentInstance.parseResponse(paymentData);
    }.bind(this))
    .then(function(result) {
      this._createTransaction(result);
    }.bind(this))
    .catch(function(err) {
      // CANCELED status means user closed the dialog, not an error
      if (err.statusCode !== 'CANCELED') {
        console.error('Google Pay Error:', err);
        SolidusBraintree.config.braintreeErrorHandle(err);
      }
    });
};

/**
 * Submits the tokenized Google Pay payment to Solidus
 *
 * @param {object} payload - The payload returned by Braintree after tokenization
 */
SolidusBraintree.GooglePayButton.prototype._createTransaction = function(payload) {
  Spree.ajax({
    data: this._transactionParams(payload),
    dataType: 'json',
    type: 'POST',
    url: SolidusBraintree.config.paths.transactions,
    success: function(response) {
      window.location.replace(response.redirectUrl);
    },
    error: function(xhr) {
      var errorText = BraintreeError.DEFAULT;

      if (xhr.responseJSON && xhr.responseJSON.errors) {
        var errors = [];
        $.each(xhr.responseJSON.errors, function(key, values) {
          $.each(values, function(index, value) {
            errors.push(key + " " + value);
          });
        });

        if (errors.length > 0)
          errorText = errors.join(", ");
      }

      console.error("Error submitting Google Pay transaction: " + errorText);
      SolidusBraintree.showError(errorText);
    }
  });
};

/**
 * Builds the transaction parameters to submit to Solidus for the given
 * payload returned by Braintree
 *
 * @param {object} payload - The payload returned by Braintree after tokenization
 */
SolidusBraintree.GooglePayButton.prototype._transactionParams = function(payload) {
  return {
    payment_method_id: this._googlePayOptions.paymentMethodId,
    transaction: {
      nonce: payload.nonce,
      payment_type: payload.type,
      email: this._googlePayOptions.email
    }
  };
};
