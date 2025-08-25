const Joi = require("joi");

module.exports = {
  create: Joi.object().unknown(),
  read: Joi.object().unknown(),
  update: Joi.object().unknown(),
  del: Joi.object().unknown(),
  list: Joi.object().unknown(),
};
