import 'dotenv/config';
import engines from 'consolidate';
import express from 'express';
import cors from 'cors';
import braintree from 'braintree';

const {
  BRAINTREE_MERCHANT_ID,
  BRAINTREE_PRIVATE_KEY,
  BRAINTREE_PUBLIC_KEY,
  DOMAINS,
} = process.env;

let gateway;

/* ######################################################################
 * Token generation helpers
 * ###################################################################### */

function getGateway() {
  if (!gateway) {
    gateway = new braintree.BraintreeGateway({
      environment: braintree.Environment.Sandbox, // use braintree.Environment.Production for production environment
      merchantId: BRAINTREE_MERCHANT_ID,
      privateKey: BRAINTREE_PRIVATE_KEY,
      publicKey: BRAINTREE_PUBLIC_KEY,
    });
  }
  return gateway;
}

function getClientToken(_req, res) {
  try {
    getGateway().clientToken.generate(
      {
        domains: DOMAINS.split(','),
      },
      (error, response) => {
        if (error) {
          console.error(error);
          res.status(500).json({ error: error.message });
          return;
        }
        res.json({ clientToken: response.clientToken });
      },
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

/* ######################################################################
 * Serve checkout page
 * ###################################################################### */

async function renderCheckout(req, res) {
  const isFlexibleIntegration = req.query.flexible !== undefined;

  const locals = {
    title:
      'Fastlane - Braintree SDK Integration' +
      (isFlexibleIntegration ? ' (Flexible)' : ''),
    prerequisiteScripts: `
      <script
        src="https://js.braintreegateway.com/web/3.106.0/js/client.min.js"
        defer
      ></script>
      <script
        src="https://js.braintreegateway.com/web/3.106.0/js/data-collector.min.js"
        defer
      ></script>
      <script
        src="https://js.braintreegateway.com/web/3.106.0/js/fastlane.min.js"
        defer
      ></script>
    `,
    initScriptPath: isFlexibleIntegration
      ? 'init-fastlane-flexible.js'
      : 'init-fastlane.js',
    stylesheetPath: 'styles.css',
  };

  res.render(isFlexibleIntegration ? 'checkout-flexible' : 'checkout', locals);
}

/* ######################################################################
 * Process transactions
 * ###################################################################### */

function createTransaction(req, res) {
  try {
    const { deviceData, email, name, paymentToken, shippingAddress } = req.body;

    getGateway().transaction.sale(
      {
        amount: '10.00',
        paymentMethodNonce: paymentToken.id,
        deviceData,
        customer: {
          ...name,
          email,
        },
        billing: {
          ...paymentToken.paymentSource.card.billingAddress,
        },
        ...(shippingAddress && {
          shipping: {
            ...shippingAddress,
            shippingMethod: 'ground',
          },
        }),
        options: {
          submitForSettlement: true,
        },
      },
      (error, result) => {
        if (error) {
          console.error(error);
          res.status(500).json({ error: error.message });
          return;
        }
        res.json({ result });
      },
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

/* ######################################################################
 * Run the server
 * ###################################################################### */

function configureServer(app) {
  app.engine('html', engines.mustache);
  app.set('view engine', 'html');
  app.set('views', '../shared/views');

  app.enable('strict routing');

  app.use(express.json());
  app.use(cors());

  app.get('/', renderCheckout);
  app.get('/client-token', getClientToken);
  app.post('/transaction', createTransaction);

  app.use(express.static('../../client/html/src'));
}

const app = express();

configureServer(app);

const port = process.env.PORT ?? 8080;

app.listen(port, () => {
  console.log(`Fastlane Sample Application - Server listening at port ${port}`);
});
