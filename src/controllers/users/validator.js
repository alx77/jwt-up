import Joi from "joi";

const password = Joi.string()
  .regex(
    /^(?=(?:.*[A-Z]))(?=(?:.*[a-z]))(?=(?:.*[0-9]))(?=(?:.*[!@#$%^&*_:;<>])).{8,}$/
  )
  .required()
  .description(
    "Password (must contain uppercase & lowercase character & digit, min 8 char.)"
  );

const user_id = Joi.string().max(200).required().description("ID");
const email = Joi.string().email().required().trim().description("Email");
const brief_user = {
  name: Joi.string()
    .regex(/^\w+(?:\s+\w+)*$/)
    .max(30)
    .trim()
    .optional()
    .description("Username (nickname)"),
  login: Joi.string().alphanum().max(30).trim().required(),
  email,
}
const user = {
  ...brief_user,
  password,
  captcha_token: Joi.string().description(
    "Token to confirm user is real (recapcha)"
  ),
  ip: Joi.string().ip({ version: ["ipv4", "ipv6"], cidr: "forbidden" }),
};

export default {
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
  read: Joi.object()
    .unknown()
    .keys({
      params: Joi.object().keys({
        user_id: user_id.optional(),
      }),
    }),
  update: Joi.object()
    .unknown()
    .keys({
      body: Joi.object()
        .keys({
          user_id,
          ...brief_user,
        })
        .required()
    }),
  del: Joi.object()
    .unknown()
    .keys({
      params: Joi.object()
        .keys({
          user_id,
        })
        .required()
    }),
  activate: Joi.object()
    .unknown()
    .keys({
      params: Joi.object()
        .keys({
          code: Joi.string().required(),
        })
        .required(),
    })
};
