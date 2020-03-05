const Joi = require("joi");

const headers = Joi.object()
  .unknown()
  .keys({
    authorization: Joi.string()
      .max(65535)
      .regex(/^Bearer .+$/)
      .required()
      .description("JWT token")
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

module.exports = {
  create: Joi.object()
    .unknown()
    .keys({
      body: Joi.object()
        .keys({
          name: Joi.string()
            .alphanum()
            .max(30)
            .optional()
            .description("Username (nickname)"),
          email: Joi.string()
            .email()
            .required()
            .description("Email"),
          password,
          onetime_token: Joi.string().description(
            "Token to confirm user is real (recapcha)"
          ),
          ip: Joi.string().ip({ version: ["ipv4", "ipv6"], cidr: "forbidden" }),
          payload: Joi.object().unknown()
        })
        .required()
    }),
  read: Joi.object()
    .unknown()
    .keys({
      params: Joi.object().keys({
        uid: Joi.string()
          .max(200)
          .required()
          .description("ID")
      }),
      headers
    }),
  readByEmail: Joi.object()
    .unknown()
    .keys({
      params: Joi.object().keys({
        email: Joi.string()
          .email()
          .required()
          .description("Email")
      }),
      headers
    }),
  update: Joi.object()
    .unknown()
    .keys({
      body: Joi.object()
        .keys({
          uid: Joi.string()
            .max(200)
            .required()
            .description("ID"),
          name: Joi.string()
            .alphanum()
            .max(30)
            .optional()
            .description("Username (nickname)"),
          email: Joi.string()
            .email()
            .required()
            .description("Email"),
          password,
          payload: Joi.object().unknown()
        })
        .required(),
      headers
    }),
  del: Joi.object()
    .unknown()
    .keys({
      params: Joi.object()
        .keys({
          uid: Joi.string()
            .max(200)
            .required()
            .description("ID")
        })
        .required(),
      headers
    }),
  list: Joi.object()
    .unknown()
    .keys({
      query: Joi.object()
        .keys({
          page: Joi.number()
            .required()
            .description("Page number (from 0)"),
          size: Joi.number()
            .max(100)
            .default("10")
            .optional()
            .description("Page size (10 by default)")
        })
        .required(),
      headers
    })
};
