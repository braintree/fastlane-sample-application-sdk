fetch('client-token')
  .then(async (resp) => {
    /**
     * ######################################################################
     * Initialize Fastlane components
     * ######################################################################
     */

    const { clientToken, error } = await resp.json();
    if (error) {
      throw new Error(error);
    }

    const braintree = window.braintree;
    if (
      !braintree ||
      !braintree.client ||
      !braintree.dataCollector ||
      !braintree.fastlane
    ) {
      throw new Error('Failed to load all necessary Braintree scripts');
    }

    const clientInstance = await braintree.client.create({
      authorization: clientToken,
    });
    const dataCollectorInstance = await braintree.dataCollector.create({
      client: clientInstance,
    });
    const deviceData = dataCollectorInstance.deviceData;

    const {
      identity,
      profile,
      FastlaneCardComponent,
      FastlaneWatermarkComponent,
    } = await braintree.fastlane.create({
      authorization: clientToken,
      client: clientInstance,
      // shippingAddressOptions: {
      //   allowedLocations: [],
      // },
      // cardOptions: {
      //   allowedBrands: [],
      // },
      styles: {
        root: {
          backgroundColor: '#faf8f5',
          // errorColor: '',
          // fontFamily: '',
          // textColorBase: '',
          // fontSizeBase: '',
          // padding: '',
          // primaryColor: '',
        },
        // input: {
        //   backgroundColor: '',
        //   borderRadius: '',
        //   borderColor: '',
        //   borderWidth: '',
        //   textColorBase: '',
        //   focusBorderColor: '',
        // },
      },
    });

    const cardComponent = await FastlaneCardComponent();
    const paymentWatermark = await FastlaneWatermarkComponent();

    (
      await FastlaneWatermarkComponent({
        includeAdditionalInfo: true,
      })
    ).render('#watermark-container');

    /**
     * ######################################################################
     * State & data required for Fastlane
     * ######################################################################
     */

    let memberAuthenticatedSuccessfully;
    let memberHasSavedPaymentMethods;
    let email;
    let name;
    let shippingAddress;
    let billingAddress;
    let paymentToken;

    /**
     * ######################################################################
     * Checkout form helpers
     * (this will be different for individual websites and will depend on how
     * your own checkout flow functions)
     * ######################################################################
     */

    const form = document.querySelector('form');
    const customerSection = document.getElementById('customer');
    const emailSubmitButton = document.getElementById('email-submit-button');
    const shippingSection = document.getElementById('shipping');
    const billingSection = document.getElementById('billing');
    const paymentSection = document.getElementById('payment');
    const paymentEditButton = document.getElementById('payment-edit-button');
    const checkoutButton = document.getElementById('checkout-button');
    let activeSection = customerSection;

    const setActiveSection = (section) => {
      activeSection.classList.remove('active');
      section.classList.add('active', 'visited');
      activeSection = section;
    };

    const getAddressSummary = ({
      firstName,
      lastName,
      streetAddress,
      extendedAddress,
      locality,
      region,
      postalCode,
      countryCodeAlpha2,
      phoneNumber,
    }) => {
      const isNotEmpty = (field) => !!field;
      const summary = [
        [firstName, lastName].filter(isNotEmpty).join(' '),
        [streetAddress, extendedAddress].filter(isNotEmpty).join(', '),
        [
          locality,
          [region, postalCode].filter(isNotEmpty).join(' '),
          countryCodeAlpha2,
        ]
          .filter(isNotEmpty)
          .join(', '),
        phoneNumber,
      ];
      return summary.filter(isNotEmpty).join('\n');
    };

    const setShippingSummary = (address) => {
      shippingSection.querySelector('.summary').innerText =
        getAddressSummary(address);
    };

    const setBillingSummary = (address) => {
      billingSection.querySelector('.summary').innerText =
        getAddressSummary(address);
    };

    const setPaymentSummary = (paymentToken) => {
      document.getElementById('selected-card').innerText = paymentToken
        ? `💳 •••• ${paymentToken.paymentSource.card.lastDigits}`
        : '';
    };

    /**
     * ######################################################################
     * Checkout form interactable elements
     * (this will be different for individual websites and will depend on how
     * your own checkout flow functions)
     * ######################################################################
     */

    emailSubmitButton.addEventListener('click', async () => {
      // disable button until authentication succeeds or fails
      emailSubmitButton.setAttribute('disabled', '');

      // reset form & state
      email = form.elements['email'].value;
      form.reset();
      document.getElementById('email-input').value = email;
      shippingSection.classList.remove('visited');
      setShippingSummary({});
      billingSection.classList.remove('visited');
      billingSection.removeAttribute('hidden');
      setBillingSummary({});
      paymentSection.classList.remove('visited', 'pinned');
      setPaymentSummary();
      document.getElementById('payment-watermark').replaceChildren();
      document.getElementById('card-component').replaceChildren();

      memberAuthenticatedSuccessfully = undefined;
      memberHasSavedPaymentMethods = undefined;
      name = undefined;
      shippingAddress = undefined;
      billingAddress = undefined;
      paymentToken = undefined;

      try {
        // identify and authenticate Fastlane members
        const { customerContextId } =
          await identity.lookupCustomerByEmail(email);

        if (customerContextId) {
          const authResponse =
            await identity.triggerAuthenticationFlow(customerContextId);
          console.log('Auth response:', authResponse);

          if (authResponse?.authenticationState === 'succeeded') {
            // save profile data
            memberAuthenticatedSuccessfully = true;
            name = authResponse.profileData.name;
            shippingAddress = authResponse.profileData.shippingAddress;
            paymentToken = authResponse.profileData.card;
            billingAddress = paymentToken?.paymentSource.card.billingAddress;
          }
        } else {
          // user was not recognized
          console.log('No customerContextId');
        }

        // update form UI
        customerSection.querySelector('.summary').innerText = email;
        if (shippingAddress) {
          setShippingSummary(shippingAddress);
        }
        if (paymentToken) {
          // if available, display Fastlane user's selected card with watermark
          memberHasSavedPaymentMethods = true;
          setPaymentSummary(paymentToken);
          paymentWatermark.render('#payment-watermark');
        } else {
          // otherwise render card component
          cardComponent.render('#card-component');
        }
        if (memberAuthenticatedSuccessfully) {
          shippingSection.classList.add('visited');
          if (paymentToken) {
            billingSection.setAttribute('hidden', '');
            paymentSection.classList.add('pinned');
            paymentEditButton.classList.add('pinned');
            setActiveSection(paymentSection);
          } else {
            setActiveSection(billingSection);
          }
        } else {
          setActiveSection(shippingSection);
        }
      } finally {
        // re-enable button once authentication succeeds or fails
        emailSubmitButton.removeAttribute('disabled');
      }
    });

    emailSubmitButton.removeAttribute('disabled');

    document
      .getElementById('email-edit-button')
      .addEventListener('click', () => setActiveSection(customerSection));

    document
      .getElementById('shipping-submit-button')
      .addEventListener('click', () => {
        // extract form values
        const firstName = form.elements['given-name'].value;
        const lastName = form.elements['family-name'].value;
        const streetAddress = form.elements['shipping-address-line1'].value;
        const extendedAddress = form.elements['shipping-address-line2'].value;
        const locality = form.elements['shipping-address-level2'].value;
        const region = form.elements['shipping-address-level1'].value;
        const postalCode = form.elements['shipping-postal-code'].value;
        const countryCodeAlpha2 = form.elements['shipping-country'].value;
        const telCountryCode = form.elements['tel-country-code'].value;
        const telNational = form.elements['tel-national'].value;

        // update state & form UI
        name = {
          firstName,
          lastName,
        };
        shippingAddress = {
          firstName,
          lastName,
          streetAddress,
          extendedAddress,
          locality,
          region,
          postalCode,
          countryCodeAlpha2,
          phoneNumber: telCountryCode + telNational,
        };
        setShippingSummary(shippingAddress);
        setActiveSection(
          memberHasSavedPaymentMethods ? paymentSection : billingSection,
        );
      });

    document
      .getElementById('shipping-edit-button')
      .addEventListener('click', async () => {
        if (memberAuthenticatedSuccessfully) {
          // open Shipping Address Selector for Fastlane members
          const { selectionChanged, selectedAddress } =
            await profile.showShippingAddressSelector();

          if (selectionChanged) {
            // selectedAddress contains the new address
            console.log('New address:', selectedAddress);

            // update state & form UI
            shippingAddress = selectedAddress;
            setShippingSummary(shippingAddress);
          } else {
            // selection modal was dismissed without selection
          }
        } else {
          setActiveSection(shippingSection);
        }
      });

    document
      .getElementById('billing-submit-button')
      .addEventListener('click', () => {
        // extract form values
        const streetAddress = form.elements['billing-address-line1'].value;
        const extendedAddress = form.elements['billing-address-line2'].value;
        const locality = form.elements['billing-address-level2'].value;
        const region = form.elements['billing-address-level1'].value;
        const postalCode = form.elements['billing-postal-code'].value;
        const countryCodeAlpha2 = form.elements['billing-country'].value;

        // update state & form UI
        billingAddress = {
          streetAddress,
          extendedAddress,
          locality,
          region,
          postalCode,
          countryCodeAlpha2,
        };
        setBillingSummary(billingAddress);
        setActiveSection(paymentSection);
      });

    document
      .getElementById('billing-edit-button')
      .addEventListener('click', () => setActiveSection(billingSection));

    paymentEditButton.addEventListener('click', async () => {
      if (memberHasSavedPaymentMethods) {
        // open Card Selector for Fastlane members
        const { selectionChanged, selectedCard } =
          await profile.showCardSelector();

        if (selectionChanged) {
          // selectedCard contains the new card
          console.log('New card:', selectedCard);

          // update state & form UI
          paymentToken = selectedCard;
          setPaymentSummary(paymentToken);
        } else {
          // selection modal was dismissed without selection
        }
      } else {
        setActiveSection(paymentSection);
      }
    });

    checkoutButton.addEventListener('click', async () => {
      // disable button until transaction succeeds or fails
      checkoutButton.setAttribute('disabled', '');

      try {
        // get payment token if using card component
        if (!memberHasSavedPaymentMethods) {
          paymentToken = await cardComponent.getPaymentToken({
            billingAddress,
          });
        }
        console.log('Payment token:', paymentToken);

        // send transaction details to back-end
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        const isShippingRequired = form.elements['shipping-required'].checked;
        const body = JSON.stringify({
          deviceData,
          email,
          name,
          ...(isShippingRequired && { shippingAddress }),
          paymentToken,
        });
        const response = await fetch('transaction', {
          method: 'POST',
          headers,
          body,
        });
        const { result, error } = await response.json();

        if (error) {
          console.error(error);
        } else {
          if (result.success) {
            console.log(`Transaction success: ${result.transaction.id}`);
            alert('Transaction success!');
          } else {
            console.error(result);
          }
        }
      } finally {
        // re-enable button once transaction succeeds or fails
        checkoutButton.removeAttribute('disabled');
      }
    });
  })
  .catch((error) => console.error(error));
