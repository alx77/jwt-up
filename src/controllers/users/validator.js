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
    .alphanum()
    .max(30)
    .optional()
    .description("Username (nickname)"),
  email,
  password,
  captcha_token: Joi.string().description(
    "Token to confirm user is real (recapcha)"
  ),
  ip: Joi.string().ip({ version: ["ipv4", "ipv6"], cidr: "forbidden" }),
  payload: Joi.object().unknown(),
  securables: Joi.object().unknown(),
};

module.exports = {
  create: Joi.object()
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
  read: Joi.object()
    .unknown()
    .keys({
      params: Joi.object().keys({
        user_id,
      }),
      headers,
    }),
  readByEmail: Joi.object()
    .unknown()
    .keys({
      params: Joi.object().keys({
        email,
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
  list: Joi.object()
    .unknown()
    .keys({
      query: Joi.object()
        .keys({
          page: Joi.number()
            .optional()
            .default(0)
            .description("Page number (from 0)"),
          size: Joi.number()
            .max(100)
            .optional()
            .default(10)
            .description("Page size (10 by default)"),
        })
        .required(),
      headers,
    }),
};
