// GET /
exports.index = async function index(ctx) {
  ctx.body = 'Hello World';
};

// GET /page
exports.page = async function page(ctx) {
  ctx.render('page.pug');
};
