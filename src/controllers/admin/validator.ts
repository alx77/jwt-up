import Joi from "joi";

const id = Joi.string().max(200).required().description("Account ID (base64-encoded UUID)");
const status = Joi.number()
  .integer()
  .valid(1, 2, 3)
  .required()
  .description("Account status (1=ACTIVE, 2=BLOCKED, 3=TEMPORARY_BLOCKED)");

export default {
  list: Joi.object()
    .unknown()
    .keys({
      query: Joi.object().keys({
        page: Joi.number().integer().min(1).default(1),
        per_page: Joi.number().integer().min(1).max(100).default(20),
        status: Joi.number().integer().valid(1, 2, 3).optional(),
        q: Joi.string().max(255).optional().description("Search by login or email"),
      }),
    }),
  get: Joi.object()
    .unknown()
    .keys({ params: Joi.object().keys({ id }).required() }),
  updateStatus: Joi.object()
    .unknown()
    .keys({
      params: Joi.object().keys({ id }).required(),
      body: Joi.object().keys({ status }).required(),
    }),
  del: Joi.object()
    .unknown()
    .keys({ params: Joi.object().keys({ id }).required() }),
};
