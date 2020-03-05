const Joi = require("joi");
const chai = require("chai");
const validator = require("./validator");
const rewire = require("rewire");
const service = rewire("../../services/users");
const bcrypt = require("bcrypt");
const expect = chai.expect;

service.__set__({
  pg: {
    query: async function(q, params = [], resultProcessor) {
      const res = { rows: [1, 2, 3] };
      return resultProcessor ? resultProcessor(res) : res;
    }
  },
  redis: {
    setex: async function(code, delay, user) {
      expect(code)
        .to.be.a("string")
        .with.length(10);
      expect(bcrypt.compareSync("secret", user.password)).to.be.true;
    }
  },
  producer: {
    connect: async function() {},
    send: async function() {}
  }
});

describe(`@users tests`, function() {
  it("@users.1 - Creating user (service)", async () => {
    const response = await service.createUser({
      name: "John",
      email: "a@a.com",
      password: "secret",
      ip: "127.0.0.1",
      payload: {
        familyName: "Doe"
      }
    });
    const { error } = Joi.validate(response, validator.create);
    expect(error).to.be.a("null");
  });
});
