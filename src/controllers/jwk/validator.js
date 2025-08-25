const Joi = require("joi");

module.exports = {
  jwk: Joi.object().unknown().keys({
    params: Joi.object(),
  }),
};
