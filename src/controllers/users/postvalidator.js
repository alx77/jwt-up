const Joi = require("joi");
const sortValidator = Joi.object().keys({
  field: Joi.string().valid("name", "email", "created_at").required(),
  order: Joi.string().valid("asc", "desc").default("asc"),
});

const filterValidator = Joi.array().items(
  Joi.object().keys({
    field: Joi.string().required(),
    op: Joi.string().valid("=", "!=", "<>", ">", "<", ">=", "<=").required(),
    rule: Joi.string().valid("AND", "OR", "NOT").optional(),
    value: Joi.alternatives()
      .try(
        Joi.alternatives().try(Joi.string(), Joi.number()),
        //Joi.link(() => filterValidator)
      )
      .required(),
  })
);

module.exports = {
  list: Joi.object()
    .unknown()
    .keys({
      sort: Joi.string()
        .optional()
        .description(
          "Format (url-encoded): &sort[field]='field_name'&sort[order]='asc'"
        ),
      query: Joi.object()
        .keys({
          filter: filterValidator
            .optional()
            .description(
              "Format (url-encoded): &filter[field]='field_name'&sort[order]='asc'"
            ),
        })
        .optional(),
    }),
};
