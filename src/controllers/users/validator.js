const Joi = require("joi");

const headers = Joi.object()
  .unknown()
  .keys({
    authorization: Joi.string()
      .max(65535)
      .regex(/^Bearer .+$/)
      .required()
      .description("JWT token"),
  })
  .required();

const password = Joi.string()
  .regex(
    /^(?=(?:.*[A-Z]))(?=(?:.*[a-z]))(?=(?:.*[0-9]))(?=(?:.*[!@#$%^&*_:;<>])).{8,}$/
  )
  .required()
  .description(
    "Password (must contain uppercase & lowercase character & digit, min 8 char.)"
  );

const user_id = Joi.string().max(200).required().description("ID");
const email = Joi.string().email().required().description("Email");
const user = {
  name: Joi.string()
    .regex(/^\w+(?:\s+\w+)*$/)
    .max(30)
    .optional()
    .description("Username (nickname)"),
  login: Joi.string().alphanum().max(30).required(),
  email,
  password,
  captcha_token: Joi.string().description(
    "Token to confirm user is real (recapcha)"
  ),
  ip: Joi.string().ip({ version: ["ipv4", "ipv6"], cidr: "forbidden" }),
};

module.exports = {
  register: Joi.object()
    .unknown()
    .keys({
      body: Joi.object().keys(user).required(),
    }),
  login: Joi.object()
    .unknown()
    .keys({
      body: Joi.object().keys({
        email,
        password,
      }),
    }),
  refreshToken: Joi.object().unknown().keys({
    params: Joi.object(),
    headers,
  }),
  read: Joi.object()
    .unknown()
    .keys({
      params: Joi.object().keys({
        user_id: user_id.optional(),
      }),
      headers,
    }),
  update: Joi.object()
    .unknown()
    .keys({
      body: Joi.object()
        .keys({
          user_id,
          ...user,
        })
        .required(),
      headers,
    }),
  del: Joi.object()
    .unknown()
    .keys({
      params: Joi.object()
        .keys({
          user_id,
        })
        .required(),
      headers,
    }),
  activate: Joi.object()
    .unknown()
    .keys({
      params: Joi.object()
        .keys({
          code: Joi.string().required(),
        })
        .required(),
    }),
};
