const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('koa-oai-router');
const MiddlewarePlugin = require('koa-oai-router-middleware');
const logger = require('koa-logger');
const path = require('path');
const config = require('./config');
const db = require('./db');
const debug = require('debug')('app:webServer');
const Pug = require('koa-pug');
const koaStatic = require('koa-static');
const mount = require('koa-mount');
const process = require('process');
const validate = require('koa-validate');
const cors = require('@koa/cors')({
  credentials: true,
  origin: '*',
});
const utils = require('./utils');

const app = new Koa();
app.proxy = true;

app.use(cors);

if (config.env === 'dev' || process.env.DEBUG === 'true') {
  app.use(logger());
}

app.use(mount('/static', koaStatic(path.join(__dirname, 'static'))));

const pug = new Pug({
  viewPath: path.join(__dirname, 'views'),
  noCache: config.dev,
});
pug.use(app);

const router = new Router({
  apiDoc: path.join(__dirname, 'router.yaml'),
  apiExplorerVisible: true,
  options: {
    middleware: path.join(__dirname, 'controllers'),
  },
});
router.mount(MiddlewarePlugin);
app.use(async (ctx, next) => {
  if (ctx.path.indexOf('/api/') === -1) {
    ctx.state.noPack = true;
  }
  await next();
});

if (config.env === 'dev' || process.env.DEBUG === 'true') {
  app.use(async (ctx, next) => {
    await next();

    console.log('-----BODY-----'); // eslint-disable-line no-console
    if (ctx.state.noPack) {
      console.log('No Pack Body'); // eslint-disable-line no-console
    } else {
      console.log(ctx.body); // eslint-disable-line no-console
    }
  });
}

app.use(async (ctx, next) => {
  try {
    await next();
    if (!ctx.state.noPack) {
      if (
        ctx.body &&
        Number.isInteger(ctx.body.status) &&
        ctx.body.status >= 300
      ) {
        if (ctx.body.message) {
          ctx.body = {
            statusCode: ctx.body.status,
            message: ctx.body.message,
          };
        } else if (ctx.body.error && ctx.body.detail) {
          // Request params error
          ctx.body = {
            statusCode: ctx.body.status,
            message: `${ctx.body.detail.keyword} ${ctx.body.error}`,
          };
        } else {
          ctx.body = {
            statusCode: ctx.body.status,
          };
        }
        ctx.status = 200;
      } else {
        const body = {
          statusCode: 200,
        };

        if (ctx.body !== undefined) {
          body.result = ctx.body;
        }
        ctx.body = body;
        ctx.status = 200;
      }
    }
  } catch (error) {
    if (config.env === 'dev' || process.env.DEBUG === 'true') {
      console.error(error); // eslint-disable-line no-console
      console.error(error.stack); // eslint-disable-line no-console
    }
    ctx.status = 200;
    ctx.body = {
      statusCode: error.statusCode || 500,
      message: error.message,
    };
  }
});

app.use(bodyParser());

if (config.env === 'dev' || process.env.DEBUG === 'true') {
  app.use(async (ctx, next) => {
    console.log('-----QUERY-----'); // eslint-disable-line no-console
    console.log(ctx.query); // eslint-disable-line no-console
    console.log('-----REQUEST-----'); // eslint-disable-line no-console
    console.log(ctx.request.body); // eslint-disable-line no-console

    await next();

    console.log('-----RAW_STATUS-----'); // eslint-disable-line no-console
    console.log(ctx.response.status); // eslint-disable-line no-console
    console.log('-----RAW_BODY-----'); // eslint-disable-line no-console
    if (ctx.state.noPack) {
      console.log('No Pack Body'); // eslint-disable-line no-console
    } else {
      console.log(ctx.body); // eslint-disable-line no-console
    }
  });
}

app.context.sequelize = db.sequelize;
app.context.models = db.models;
app.context.auth = async function auth() {
  const token = this.headers.token || this.query.token;
  this.assert(token, 401);

  const user = await db.models.user.find({
    where: {
      token,
    },
  });
  this.assert(user, 401);

  return user;
};

validate(app);

app.use(router.routes());

const webPort = process.env.webPort ? process.env.webPort : config.webPort;
app.listen(webPort, '0.0.0.0');

debug(`Web Server is listening port ${webPort}`);

utils.schedule.initTimeoutJobs().then(() => {
  debug('All init timeout jobs are set');
});
