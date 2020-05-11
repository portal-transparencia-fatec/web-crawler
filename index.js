const cron = require('node-cron');
const PuppeterController = require('./app/controller/PuppeterController')

PuppeterController.start()
cron.schedule('0 0 1 * *', () => {
  PuppeterController.start()
});


